-- Agent takeover: when an agent disables automation on a lead, kick the lead
-- out of ALL campaigns (stop active/paused states, clear campaign_id).
CREATE OR REPLACE FUNCTION public.unenroll_lead_on_automation_off()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE lead_campaign_states
    SET state = 'stopped',
        paused_reason = COALESCE(paused_reason, 'AI disabled by agent'),
        updated_at = now()
  WHERE lead_id = NEW.id AND state IN ('active','paused');
  NEW.campaign_id := NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_leads_automation_off_unenroll ON public.leads;
CREATE TRIGGER trg_leads_automation_off_unenroll
  BEFORE UPDATE OF automation_enabled ON public.leads
  FOR EACH ROW
  WHEN (NEW.automation_enabled = false AND OLD.automation_enabled = true)
  EXECUTE FUNCTION unenroll_lead_on_automation_off();
