-- Phase 3A: when a sequence enrollment becomes unreachable on Messenger
-- (24h window closed -> parked, or send permanently rejected -> paused), create
-- ONE agent task so an unreachable lead is never a silent dead-end. Deduped to at
-- most one open sequence-generated task per lead.
CREATE OR REPLACE FUNCTION public.create_fallback_task_on_unreachable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_lead_name text;
  v_seq_name  text;
  v_title     text;
  v_should    boolean := false;
BEGIN
  IF NEW.state = 'waiting_window' AND OLD.state IS DISTINCT FROM 'waiting_window' THEN
    v_should := true;
    v_title  := 'Messenger window closed — reach lead another way';
  ELSIF NEW.state = 'paused' AND NEW.paused_reason = 'send_failed_fb_rejected'
        AND OLD.state IS DISTINCT FROM 'paused' THEN
    v_should := true;
    v_title  := 'Messenger undeliverable — try another channel';
  END IF;

  IF NOT v_should THEN
    RETURN NEW;
  END IF;

  -- Dedup: one open sequence-generated task per lead at a time
  IF EXISTS (
    SELECT 1 FROM tasks t
     WHERE t.lead_id = NEW.lead_id
       AND t.triggered_by = 'sequence_scheduler'
       AND t.status = 'pending'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_lead_name FROM leads WHERE id = NEW.lead_id;
  SELECT name INTO v_seq_name  FROM sequences WHERE id = NEW.sequence_id;

  INSERT INTO tasks (lead_id, client_id, title, task_type, notes, status, source, triggered_by, due_date)
  VALUES (
    NEW.lead_id, NEW.client_id,
    v_title || COALESCE(' (' || v_lead_name || ')', ''),
    're-engagement',
    'Auto-created by the "' || COALESCE(v_seq_name, 'follow-up') ||
      '" sequence: this lead could not be reached on Messenger (24h window closed or the send was rejected). Follow up by phone or another channel.',
    'pending', 'system', 'sequence_scheduler', CURRENT_DATE
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_seq_enrollment_fallback_task ON public.sequence_enrollments;
CREATE TRIGGER trg_seq_enrollment_fallback_task
  AFTER UPDATE OF state ON public.sequence_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_fallback_task_on_unreachable();
