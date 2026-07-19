-- Self-serve automations Phase 2a: clients build campaigns in the mobile wizard,
-- but only a baymo_admin may ACTIVATE one (manual review gate). Campaigns RLS
-- already lets client members insert/update their own rows, so without this
-- trigger a client could set status='active' themselves and skip review.
-- Service-role / n8n connections have no auth context (get_my_role() is null)
-- and are unaffected.
CREATE OR REPLACE FUNCTION public.enforce_selfserve_campaign_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_role text := get_my_role();
BEGIN
  IF v_role IS NULL OR v_role = 'baymo_admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending_review') THEN
      RAISE EXCEPTION 'Only the BaMo team can activate an automation (submit it for review instead)';
    END IF;
    NEW.is_active := false;
  ELSE
    IF NEW.status = 'active' AND OLD.status <> 'active' THEN
      RAISE EXCEPTION 'Only the BaMo team can activate an automation';
    END IF;
    IF NEW.is_active AND NOT OLD.is_active THEN
      RAISE EXCEPTION 'Only the BaMo team can activate an automation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_selfserve_campaign_guard ON public.campaigns;
CREATE TRIGGER trg_selfserve_campaign_guard
  BEFORE INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_selfserve_campaign_guard();
