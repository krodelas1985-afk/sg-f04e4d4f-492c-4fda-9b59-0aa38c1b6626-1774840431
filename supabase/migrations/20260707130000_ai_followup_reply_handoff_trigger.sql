-- AI Follow-Up §7: a lead reply IS the goal. Exit any ACTIVE ai_adaptive
-- enrollment on inbound (hands the live thread to W2) and log the handoff.
-- Scoped to mode='ai_adaptive' so fixed-sequence (W4) exit logic is untouched.
-- Runs alongside the existing waiting_window exit trigger. Inert until W6 creates enrollments.

CREATE OR REPLACE FUNCTION public.exit_active_ai_followup_on_inbound()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  WITH exited AS (
    UPDATE sequence_enrollments se
       SET state = 'exited', outcome = 'replied', completed_at = NOW(),
           send_lock = false, updated_at = NOW()
      FROM sequences s
     WHERE se.sequence_id = s.id
       AND s.mode = 'ai_adaptive'
       AND se.lead_id = NEW.lead_id
       AND se.state = 'active'
    RETURNING se.id AS enrollment_id, se.lead_id, se.client_id
  )
  INSERT INTO follow_up_decisions
    (enrollment_id, lead_id, client_id, decision, reason, goal_status, window_open)
  SELECT enrollment_id, lead_id, client_id,
         'answer_pending', 'lead replied — handed to live AI (W2)', 'progressing', true
    FROM exited;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_conversations_inbound_exit_active_ai ON public.conversations;
CREATE TRIGGER trg_conversations_inbound_exit_active_ai
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  WHEN (NEW.direction = 'inbound')
  EXECUTE FUNCTION public.exit_active_ai_followup_on_inbound();
