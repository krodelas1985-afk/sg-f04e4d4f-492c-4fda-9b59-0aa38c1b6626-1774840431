-- AI Follow-Up: make the inbound-message eligibility ceiling configurable.
--
-- enroll_ai_followup_candidates() hardcoded "fewer than 4 inbound messages" as
-- a proxy for "engaged a little, then went quiet". That heuristic is wrong for
-- BaMo's own B2B client-acquisition campaign: a broker weighing a subscription
-- exchanges far more messages than a homebuyer, so the most valuable prospects
-- were the ones being excluded.
--
-- Adds ai_settings.max_inbound_for_followup, defaulting to 4 so every existing
-- (buyer) sequence keeps its current behaviour exactly. Only sequences that
-- explicitly set a higher value change.

CREATE OR REPLACE FUNCTION public.enroll_ai_followup_candidates()
 RETURNS TABLE(enrollment_id uuid, lead_id uuid, sequence_id uuid, client_id uuid)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  WITH candidates AS (
    SELECT DISTINCT ON (l.id)
           s.id AS sequence_id, l.id AS lead_id, l.client_id,
           s.reenroll_cooldown_days, s.max_passes
    FROM sequences s
    JOIN campaigns c ON c.id = s.campaign_id AND c.status = 'active'
    JOIN leads l ON l.campaign_id = s.campaign_id
    WHERE s.mode = 'ai_adaptive'
      AND s.is_active = true
      AND l.messenger_id IS NOT NULL
      AND l.automation_enabled = true
      AND COALESCE(l.followup_opted_out, false) = false
      AND l.status NOT IN ('Won','Lost')
      AND l.last_inbound_at IS NOT NULL
      AND l.last_inbound_at > now() - interval '24 hours'   -- FB 24h window still open (v1 in-window only)
      AND l.last_outbound_at IS NOT NULL
      AND l.last_outbound_at >= l.last_inbound_at            -- last message was ours → stalled
      AND l.last_outbound_at <= NOW() - make_interval(hours => COALESCE((s.ai_settings->>'first_follow_up_after_hours')::int, 4))
      AND (SELECT count(*) FROM conversations cv WHERE cv.lead_id = l.id AND cv.direction = 'inbound')
            < COALESCE((s.ai_settings->>'max_inbound_for_followup')::int, 4)
      AND NOT EXISTS (
        SELECT 1 FROM sequence_enrollments se2
        WHERE se2.lead_id = l.id AND se2.state IN ('active','waiting_window','paused')
      )
      AND (SELECT count(*) FROM sequence_enrollments se3
           WHERE se3.lead_id = l.id AND se3.sequence_id = s.id) < s.max_passes
      AND NOT EXISTS (
        SELECT 1 FROM sequence_enrollments se4
        WHERE se4.lead_id = l.id AND se4.sequence_id = s.id
          AND COALESCE(se4.completed_at, se4.enrolled_at) > NOW() - make_interval(days => s.reenroll_cooldown_days)
      )
  ),
  ins AS (
    INSERT INTO sequence_enrollments
      (lead_id, sequence_id, client_id, state, current_step, pass_number, touch_count, next_action_at, enrolled_at, started_at)
    SELECT cand.lead_id, cand.sequence_id, cand.client_id, 'active', 1,
           1 + (SELECT count(*) FROM sequence_enrollments se5
                WHERE se5.lead_id = cand.lead_id AND se5.sequence_id = cand.sequence_id),
           0, NOW(), NOW(), NOW()
    FROM candidates cand
    ON CONFLICT (lead_id, sequence_id) WHERE state IN ('active','waiting_window','paused') DO NOTHING
    RETURNING id, lead_id, sequence_id, client_id
  )
  SELECT id, lead_id, sequence_id, client_id FROM ins;
$function$;
