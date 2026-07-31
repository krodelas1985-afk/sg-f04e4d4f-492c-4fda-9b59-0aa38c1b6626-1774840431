-- Only follow up leads the campaign acquired AFTER AI follow-up was switched on.
--
-- Without this, enabling follow-up on an established campaign sweeps the entire
-- back catalogue into the ladder - months of old leads suddenly receiving
-- automated messages. Those leads are already covered by the fixed sequences
-- (W4), so they would also be double-handled.
--
-- ai_settings.activated_at is the cutoff, stamped by the provisioning API when a
-- campaign's follow-up is first enabled and preserved across off/on cycles so
-- leads acquired during a pause are not orphaned. NULL means no cutoff, which
-- preserves behaviour for any sequence provisioned before this change.
--
-- Caveat: leads.created_at is the proxy for "acquired by this campaign". A lead
-- created under one campaign and later reassigned keeps its original created_at,
-- so it is judged on when it entered the CRM, not when it joined this campaign.

CREATE OR REPLACE FUNCTION public.enroll_ai_followup_candidates()
 RETURNS TABLE(enrollment_id uuid, lead_id uuid, sequence_id uuid, client_id uuid)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  WITH candidates AS (
    SELECT DISTINCT ON (l.id)
           s.id AS sequence_id, l.id AS lead_id, l.client_id,
           l.last_inbound_at,
           COALESCE(
             (s.ai_settings->'followup_ladder_hours'->>0)::numeric,
             (s.ai_settings->>'first_follow_up_after_hours')::numeric,
             4
           ) AS first_delay_hours
    FROM sequences s
    JOIN campaigns c ON c.id = s.campaign_id AND c.status = 'active'
    JOIN leads l ON l.campaign_id = s.campaign_id
    WHERE s.mode = 'ai_adaptive'
      AND s.is_active = true
      AND l.messenger_id IS NOT NULL
      AND l.automation_enabled = true
      AND COALESCE(l.followup_opted_out, false) = false
      AND l.status NOT IN ('Won','Lost')
      -- only leads acquired after follow-up went live on this campaign
      AND (
        s.ai_settings->>'activated_at' IS NULL
        OR l.created_at >= (s.ai_settings->>'activated_at')::timestamptz
      )
      AND l.last_inbound_at IS NOT NULL
      AND l.last_inbound_at > now() - interval '24 hours'   -- FB 24h window still open
      AND l.last_outbound_at IS NOT NULL
      AND l.last_outbound_at >= l.last_inbound_at            -- last message was ours → stalled
      -- first touch is measured from the LAST INBOUND (window open), not our reply
      AND l.last_inbound_at <= NOW() - (COALESCE(
            (s.ai_settings->'followup_ladder_hours'->>0)::numeric,
            (s.ai_settings->>'first_follow_up_after_hours')::numeric,
            4) * interval '1 hour')
      AND (SELECT count(*) FROM conversations cv WHERE cv.lead_id = l.id AND cv.direction = 'inbound')
            >= COALESCE((s.ai_settings->>'min_inbound_for_followup')::int, 0)
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
           0,
           GREATEST(NOW(), cand.last_inbound_at + cand.first_delay_hours * interval '1 hour'),
           NOW(), NOW()
    FROM candidates cand
    ON CONFLICT (lead_id, sequence_id) WHERE state IN ('active','waiting_window','paused') DO NOTHING
    RETURNING id, lead_id, sequence_id, client_id
  )
  SELECT id, lead_id, sequence_id, client_id FROM ins;
$function$;
