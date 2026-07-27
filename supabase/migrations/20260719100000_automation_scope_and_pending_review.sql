-- Self-serve automations Phase 0 (1/3): campaign scope model + pending_review status.
-- 3-slot model: 1 General + up to 2 Property/Project-scoped automations per client.
-- New wizard campaigns get a deterministic priority ladder (listing < project < general)
-- so "most specific wins" instead of "oldest campaign wins". Existing campaigns all
-- carry explicit priority values and are untouched (trigger only fills NULLs).

-- Allow the mobile wizard's submit-for-approval state.
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_status_check
  CHECK (status = ANY (ARRAY['draft','pending_review','active','paused','completed']));

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS automation_scope text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_organic_owner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scoped_ref jsonb;  -- {kind:'listing'|'project', listing_id?, title?}

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_automation_scope_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_automation_scope_check
  CHECK (automation_scope = ANY (ARRAY['general','project','listing']));

-- Exactly one organic/direct-traffic owner per client (General when it exists,
-- else one scoped automation that opted in via the wizard toggle).
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_one_organic_owner_per_client
  ON public.campaigns (client_id)
  WHERE is_organic_owner AND status IN ('draft','pending_review','active','paused');

-- Priority ladder for new campaigns that don't set priority explicitly.
CREATE OR REPLACE FUNCTION public.set_campaign_priority_from_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.priority IS NULL THEN
    NEW.priority := CASE NEW.automation_scope
      WHEN 'listing' THEN 100
      WHEN 'project' THEN 200
      ELSE 300
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_priority_from_scope ON public.campaigns;
CREATE TRIGGER trg_campaign_priority_from_scope
  BEFORE INSERT ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_campaign_priority_from_scope();
