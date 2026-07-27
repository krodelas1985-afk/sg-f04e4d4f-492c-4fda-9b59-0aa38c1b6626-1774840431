-- Add 'Unqualified' as a manual, client-set lead disposition on the status axis.
-- (Applied to prod 2026-07-26 via MCP apply_migration `add_unqualified_lead_status`.)
--
-- Rationale: temperature (Hot/Warm/Cold) is AI-driven and W2 overwrites it every inbound
-- message, so a disqualification cannot live there. `status` is the human pipeline axis and
-- is never rewritten per-message -> the correct home for "Unqualified".
--
-- Entering Unqualified pauses AI automation (automation_enabled=false), detaches the campaign,
-- and unenrolls active campaign-states + sequence-enrollments -- mirroring
-- unenroll_lead_on_automation_off(). The existing trg_leads_automation_off_unenroll does NOT
-- fire here (this UPDATE targets `status`, not `automation_enabled`), so the side-effects are
-- performed inline. Manual-only: no n8n workflow writes this value; the CRM lead detail sets
-- status_source='manual'. Sticky + reversible -- moving the lead back to another status does
-- NOT auto-resume automation (re-enabling AI is a separate, deliberate action).

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_chk;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_chk
  CHECK (status = ANY (ARRAY['New','In Contact','Qualifying','Qualified','Viewing','Negotiating','Nurture','Won','Lost','Unqualified']));

CREATE OR REPLACE FUNCTION public.pause_automation_on_unqualified()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.automation_enabled := false;
  NEW.campaign_id := NULL;
  NEW.status_updated_at := now();
  IF NEW.status_source IS NULL THEN NEW.status_source := 'manual'; END IF;

  UPDATE lead_campaign_states
     SET state = 'stopped',
         paused_reason = COALESCE(paused_reason, 'Lead marked Unqualified'),
         updated_at = now()
   WHERE lead_id = NEW.id AND state IN ('active','paused');

  UPDATE sequence_enrollments
     SET state = 'exited', outcome = 'unqualified', completed_at = now(),
         send_lock = false, updated_at = now()
   WHERE lead_id = NEW.id AND state IN ('active','waiting_window','paused');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_status_unqualified ON public.leads;
CREATE TRIGGER trg_status_unqualified
  BEFORE UPDATE OF status ON public.leads
  FOR EACH ROW
  WHEN (NEW.status = 'Unqualified' AND OLD.status IS DISTINCT FROM 'Unqualified')
  EXECUTE FUNCTION public.pause_automation_on_unqualified();
