-- Guard: a campaign must not run conversational AI against an empty knowledge base.
--
-- Incident 2026-08-06 — campaign "Areleen Pecho - Vermira"
-- (e4c68343-b802-4a38-a7bd-61d0b37974ff) was set status='active' with
-- conversational_ai_enabled=true while its only KB row
-- (a930ed72-6b75-4ecb-b0bc-e1e0355d7c02) was still review_status='pending' with
-- content=''. W2 ("Workflow 2 - AI Campaign Responder") builds its {{kb_text}}
-- with a COALESCE(string_agg(kb.content ...), '') that has no empty-guard, so
-- every reply for four days ran with an empty KB. The outage was invisible
-- because the campaign's ai_message_instructions hardcode project facts, so the
-- bot still sounded fluent — while quoting two mutually inconsistent prices to
-- live Messenger leads.
--
-- The prior assumption (src/pages/api/kb/approve.ts) was that "the old KB stayed
-- active during review so the bot never ran without a KB". That only holds for a
-- refresh (replaces_kb_id set). A first upload has no predecessor, so there is
-- nothing to fall back to. This closes that gap at the DB layer, which is the
-- only layer every writer shares (CRM API, Ads Manager, n8n, and hand-edits in
-- the Supabase dashboard — the last of which is how the incident row was set).

-- ---------------------------------------------------------------------------
-- 1) Resolver — mirrors W2's kb_text query, plus the review gate.
-- ---------------------------------------------------------------------------
-- Deliberately STRICTER than W2 in one way: it also requires review_status =
-- 'approved'. W2 injects any active row regardless of review status, so an
-- unreviewed row does produce a non-empty kb_text — but content that no human
-- has approved is exactly what we do not want a live campaign speaking from.
-- Keep the campaign_id / scope='client' half of the predicate identical to W2's;
-- if W2's query changes, change this in the same commit or the guard silently
-- stops describing reality.
CREATE OR REPLACE FUNCTION public.campaign_kb_ready(
  p_campaign_id uuid,
  p_client_id   uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_knowledge_base kb
    WHERE (kb.campaign_id = p_campaign_id
           OR (kb.scope = 'client' AND kb.client_id = p_client_id))
      AND kb.is_active = true
      AND kb.type = 'knowledge'
      AND kb.review_status = 'approved'
      AND btrim(coalesce(kb.content, '')) <> ''
  );
$$;

COMMENT ON FUNCTION public.campaign_kb_ready(uuid, uuid) IS
  'True when a campaign resolves to a non-empty, human-approved kb_text. Mirrors '
  'the campaign_id / scope=client predicate in W2''s "Fetch Lead + Campaign + KB" '
  'node and additionally requires review_status=''approved''. Keep in step with W2.';

-- ---------------------------------------------------------------------------
-- 2) Campaign-side guard
-- ---------------------------------------------------------------------------
-- Fires only on the TRANSITION into (active + conversational AI). An already-bad
-- campaign is left writable on purpose: if the check ran unconditionally, the
-- very UPDATE that pauses a broken campaign would itself be rejected, wedging
-- the row. Campaigns already in the bad state are surfaced by the sweep in §4
-- and the CRM banner, not by this trigger.
CREATE OR REPLACE FUNCTION public.assert_campaign_kb_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pending int;
  v_detail  text;
BEGIN
  -- Not entering the dangerous state → nothing to check.
  IF NOT (NEW.status = 'active' AND coalesce(NEW.conversational_ai_enabled, false)) THEN
    RETURN NEW;
  END IF;

  -- Already in the dangerous state before this write → let the edit through.
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND coalesce(OLD.conversational_ai_enabled, false) THEN
    RETURN NEW;
  END IF;

  IF public.campaign_kb_ready(NEW.id, NEW.client_id) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_pending
  FROM public.campaign_knowledge_base kb
  WHERE (kb.campaign_id = NEW.id
         OR (kb.scope = 'client' AND kb.client_id = NEW.client_id))
    AND kb.is_active = true
    AND kb.type = 'knowledge'
    AND kb.review_status <> 'approved';

  v_detail := CASE
    WHEN v_pending > 0 THEN
      v_pending || ' knowledge source(s) exist but are still awaiting review. '
      || 'Approve them in the campaign''s Knowledge Base tab, then activate.'
    ELSE
      'This campaign has no active, approved knowledge source with content. '
      || 'Add and approve one in the campaign''s Knowledge Base tab, then activate.'
  END;

  RAISE EXCEPTION
    'Cannot activate conversational AI for campaign "%": knowledge base is empty. %',
    NEW.name, v_detail
    USING ERRCODE = 'check_violation',
          HINT    = 'campaign_kb_empty';

  RETURN NEW; -- unreachable; keeps the function total for the plpgsql checker
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_campaign_kb_ready ON public.campaigns;
CREATE TRIGGER trg_assert_campaign_kb_ready
  BEFORE INSERT OR UPDATE OF status, conversational_ai_enabled, client_id
  ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.assert_campaign_kb_ready();

-- ---------------------------------------------------------------------------
-- 3) KB-side guard — don't empty the KB out from under a live campaign
-- ---------------------------------------------------------------------------
-- The mirror image of §2: deactivating, blanking, or deleting the last approved
-- source while the campaign is live and answering leads. approve.ts's refresh
-- path is safe by construction (it approves the replacement first, then retires
-- the predecessor), so this only bites the genuinely destructive case.
CREATE OR REPLACE FUNCTION public.assert_kb_not_last_for_live_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campaign record;
BEGIN
  -- NEW is unassigned on DELETE and plpgsql does not promise short-circuit
  -- evaluation, so every NEW reference stays inside a TG_OP = 'UPDATE' branch.
  IF NOT (OLD.is_active AND OLD.type = 'knowledge'
          AND OLD.review_status = 'approved'
          AND btrim(coalesce(OLD.content, '')) <> '') THEN
    -- Didn't count towards kb_text to begin with → nothing can be lost.
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Still counts, and still attached to the same campaign/scope/client →
    -- nothing lost here. (A move to a different campaign is §2's problem.)
    IF NEW.is_active AND NEW.type = 'knowledge'
       AND NEW.review_status = 'approved'
       AND btrim(coalesce(NEW.content, '')) <> ''
       AND NEW.campaign_id = OLD.campaign_id
       AND coalesce(NEW.scope, 'campaign') = coalesce(OLD.scope, 'campaign')
       AND NEW.client_id = OLD.client_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- This row is about to stop counting. Reject if that strands a live AI
  -- campaign with nothing left. Row-level locks are not taken: a concurrent
  -- retire of two sources could in principle race past this, which the §4 sweep
  -- catches within the hour.
  FOR v_campaign IN
    SELECT c.id, c.name, c.client_id
    FROM public.campaigns c
    WHERE c.status = 'active'
      AND coalesce(c.conversational_ai_enabled, false)
      AND (c.id = OLD.campaign_id
           OR (coalesce(OLD.scope, 'campaign') = 'client' AND c.client_id = OLD.client_id))
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.campaign_knowledge_base kb
      WHERE kb.id <> OLD.id
        AND (kb.campaign_id = v_campaign.id
             OR (kb.scope = 'client' AND kb.client_id = v_campaign.client_id))
        AND kb.is_active = true
        AND kb.type = 'knowledge'
        AND kb.review_status = 'approved'
        AND btrim(coalesce(kb.content, '')) <> ''
    ) THEN
      RAISE EXCEPTION
        'Cannot retire knowledge source "%": it is the last approved source for '
        'live AI campaign "%". Pause that campaign''s conversational AI, or approve '
        'a replacement source first.',
        OLD.title, v_campaign.name
        USING ERRCODE = 'check_violation',
              HINT    = 'campaign_kb_last_source';
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_kb_not_last_for_live_campaign ON public.campaign_knowledge_base;
CREATE TRIGGER trg_assert_kb_not_last_for_live_campaign
  BEFORE UPDATE OR DELETE ON public.campaign_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.assert_kb_not_last_for_live_campaign();

-- ---------------------------------------------------------------------------
-- 4) Runtime sweep — catch campaigns already in the bad state
-- ---------------------------------------------------------------------------
-- §2 only guards the transition, and the incident row predates this migration,
-- so something has to find campaigns that are *already* live-with-empty-KB. A
-- scheduled sweep beats instrumenting W2: it fires even on a campaign with no
-- inbound traffic yet, i.e. before the first lead gets a hallucinated answer.
-- In-app notification only, no push — this is an internal ops alert, and
-- push-dispatch's POLICY map has no entry for this type by design.
CREATE OR REPLACE FUNCTION public.sweep_ai_campaigns_missing_kb()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campaign record;
  v_count int := 0;
BEGIN
  FOR v_campaign IN
    SELECT c.id, c.name, c.client_id, cl.name AS client_name
    FROM public.campaigns c
    LEFT JOIN public.clients cl ON cl.id = c.client_id
    WHERE c.status = 'active'
      AND coalesce(c.conversational_ai_enabled, false)
      AND NOT public.campaign_kb_ready(c.id, c.client_id)
  LOOP
    -- One alert per campaign per 24h, so a campaign left broken over a weekend
    -- doesn't bury the notification centre.
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'campaign_kb_empty'
        AND n.data ->> 'campaign_id' = v_campaign.id::text
        AND n.created_at > now() - interval '24 hours'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
    SELECT p.id, v_campaign.client_id, 'campaign_kb_empty',
           'AI is replying with an empty knowledge base',
           coalesce(v_campaign.client_name || ' — ', '') || v_campaign.name
             || ' is active with conversational AI on, but resolves to no approved '
             || 'knowledge. Replies are running on prompt instructions alone.',
           jsonb_build_object('campaign_id', v_campaign.id,
                              'client_id',   v_campaign.client_id)
    FROM public.profiles p
    WHERE p.role = 'baymo_admin' AND coalesce(p.is_active, true);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_ai_campaigns_missing_kb() FROM anon, authenticated;

SELECT cron.unschedule('ai-campaign-kb-sweep')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-campaign-kb-sweep');

SELECT cron.schedule(
  'ai-campaign-kb-sweep',
  '20 * * * *',
  $$ SELECT public.sweep_ai_campaigns_missing_kb(); $$
);
