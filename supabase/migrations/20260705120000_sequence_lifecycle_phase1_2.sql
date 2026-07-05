-- Sequence follow-up lifecycle (Phase 1+2)
-- 1) Sequence-level delivery/lifecycle settings
ALTER TABLE public.sequences
  ADD COLUMN IF NOT EXISTS send_window_start text DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS send_window_end   text DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS reenroll_cooldown_days integer DEFAULT 14,
  ADD COLUMN IF NOT EXISTS max_passes integer DEFAULT 3;

-- 2) Enrollment lifecycle columns
ALTER TABLE public.sequence_enrollments
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS pass_number integer NOT NULL DEFAULT 1;

-- 3) waiting_window state (parked: FB 24h window closed, waiting for the lead's next inbound)
ALTER TABLE public.sequence_enrollments DROP CONSTRAINT IF EXISTS sequence_enrollments_state_check;
ALTER TABLE public.sequence_enrollments ADD CONSTRAINT sequence_enrollments_state_check
  CHECK (state = ANY (ARRAY['active'::text,'paused'::text,'completed'::text,'exited'::text,'waiting_window'::text]));

-- 4) Re-enrollment: only one LIVE enrollment per (lead, sequence); completed/exited rows are history
ALTER TABLE public.sequence_enrollments DROP CONSTRAINT IF EXISTS sequence_enrollments_lead_id_sequence_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS sequence_enrollments_live_uniq
  ON public.sequence_enrollments (lead_id, sequence_id)
  WHERE state IN ('active','waiting_window','paused');

-- 5) A lead inbound reopens the conversation: exit parked enrollments (W2/agent owns the convo now;
--    re-enrollment rules start a fresh pass after the cooldown if the lead goes silent again)
CREATE OR REPLACE FUNCTION public.exit_waiting_enrollments_on_inbound()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE sequence_enrollments
     SET state = 'exited', outcome = 'window_reopened', completed_at = NOW(),
         send_lock = false, updated_at = NOW()
   WHERE lead_id = NEW.lead_id AND state = 'waiting_window';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_conversations_inbound_exit_waiting ON public.conversations;
CREATE TRIGGER trg_conversations_inbound_exit_waiting
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  WHEN (NEW.direction = 'inbound')
  EXECUTE FUNCTION public.exit_waiting_enrollments_on_inbound();

-- 6) Agent takeover now also stops sequence enrollments (was campaigns only)
CREATE OR REPLACE FUNCTION public.unenroll_lead_on_automation_off()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE lead_campaign_states
    SET state = 'stopped',
        paused_reason = COALESCE(paused_reason, 'AI disabled by agent'),
        updated_at = now()
  WHERE lead_id = NEW.id AND state IN ('active','paused');
  UPDATE sequence_enrollments
    SET state = 'exited', outcome = 'automation_disabled', completed_at = now(),
        send_lock = false, updated_at = now()
  WHERE lead_id = NEW.id AND state IN ('active','waiting_window','paused');
  NEW.campaign_id := NULL;
  RETURN NEW;
END;
$function$;
