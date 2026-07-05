-- One-time data fix: enrollments paused by the old pause-on-inbound behavior become
-- exited with outcome 'replied' so they stop blocking re-enrollment. Permanent-failure
-- pauses (send_failed_fb_rejected) intentionally stay paused.
UPDATE public.sequence_enrollments
   SET state = 'exited', outcome = 'replied',
       completed_at = COALESCE(completed_at, updated_at, NOW()),
       send_lock = false, updated_at = NOW()
 WHERE state = 'paused' AND paused_reason = 'inbound_detected';
