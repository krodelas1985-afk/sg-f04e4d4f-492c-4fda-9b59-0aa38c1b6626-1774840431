-- AI Follow-Up: deterministic touch ladder + minimum-inbound enrolment gate.
--
-- Three changes, all driven by pilot findings on 2026-07-31:
--
-- 1. TIMING IS NO LONGER THE MODEL'S JOB. next_check_hours from the LLM was
--    setting next_action_at with no awareness of either the send window or the
--    Messenger 24h window. In one day that lost three separate touches (a "wait
--    3h" landing 15 min past window close, and a "wait 24h" landing 18h after
--    the FB window shut). Scheduling is deterministic arithmetic and belongs in
--    the guard layer. The model still decides send/wait/escalate/stop and writes
--    the copy; it no longer picks when.
--
--    ai_settings.followup_ladder_hours = [2,3,5,10] means touches at cumulative
--    +2h, +5h, +10h, +20h from the lead's LAST INBOUND — which is also when the
--    FB 24h window opens, so the whole ladder is trivially checkable against it
--    (+20h leaves 4h of headroom).
--
-- 2. FIRST TOUCH IS ANCHORED TO last_inbound_at, not last_outbound_at. Anchoring
--    every step to the same instant the FB window opens is what makes (1) sound.
--
-- 3. MINIMUM inbound gate. The original heuristic was a MAXIMUM (<4 inbound) on
--    the theory that a chatty lead doesn't need chasing. On B2B that is exactly
--    backwards: a broker weighing a subscription talks more, not less, and the
--    engaged ones are the ones worth pursuing. min_inbound_for_followup=3 skips
--    one-word tyre-kickers instead. Both bounds coexist; defaults preserve
--    existing buyer behaviour exactly (min 0, max 4).
--
-- Legacy path is intact: a sequence with no followup_ladder_hours keeps the old
-- now() + next_check_hours scheduling.

-- ---------------------------------------------------------------- enrolment --
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

-- ------------------------------------------------------------------- apply --
CREATE OR REPLACE FUNCTION public.apply_ai_followup_decision(p_enrollment_id uuid, p_action text, p_message text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_goal_status text DEFAULT NULL::text, p_next_check_hours numeric DEFAULT 6, p_window_open boolean DEFAULT true, p_opted_out boolean DEFAULT false, p_context jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_id uuid; v_client_id uuid; v_seq_name text; v_lead_name text; v_log_decision text;
  v_touch_count int; v_anchor timestamptz; v_ws text; v_we text;
  v_ladder numeric[]; v_next_idx int; v_cum numeric;
  v_target timestamptz; v_local timestamp; v_action text := p_action;
  v_interval interval := GREATEST(p_next_check_hours, 1) * interval '1 hour';
BEGIN
  SELECT se.lead_id, se.client_id, s.name, se.touch_count, l.last_inbound_at,
         COALESCE(s.send_window_start,'08:00'), COALESCE(s.send_window_end,'20:00'),
         ARRAY(SELECT x::numeric FROM jsonb_array_elements_text(
                 COALESCE(s.ai_settings->'followup_ladder_hours','[]'::jsonb)) x)
    INTO v_lead_id, v_client_id, v_seq_name, v_touch_count, v_anchor, v_ws, v_we, v_ladder
  FROM sequence_enrollments se
  JOIN sequences s ON s.id = se.sequence_id
  JOIN leads l ON l.id = se.lead_id
  WHERE se.id = p_enrollment_id;
  IF v_lead_id IS NULL THEN RETURN; END IF;

  -- Deterministic ladder scheduling. Only for send/wait: the other actions are
  -- terminal and clear next_action_at anyway.
  IF array_length(v_ladder,1) IS NOT NULL AND v_action IN ('send','wait') AND v_anchor IS NOT NULL THEN
    -- index of the touch we are scheduling next (1-based)
    v_next_idx := CASE WHEN v_action = 'send' THEN v_touch_count + 2 ELSE v_touch_count + 1 END;

    IF v_next_idx > array_length(v_ladder,1) THEN
      -- ladder exhausted → nothing further to schedule; close the pass out
      v_action := 'exhausted_ladder';
    ELSE
      SELECT sum(v) INTO v_cum FROM unnest(v_ladder[1:v_next_idx]) v;
      v_target := v_anchor + v_cum * interval '1 hour';

      -- clamp into the Manila send window
      v_local := timezone('Asia/Manila', v_target);
      IF v_local::time < v_ws::time THEN
        v_local := v_local::date + v_ws::time;
      ELSIF v_local::time > v_we::time THEN
        v_local := (v_local::date + 1) + v_ws::time;
      END IF;
      v_target := timezone('Asia/Manila', v_local);

      -- a touch scheduled past the FB 24h window can never be delivered
      IF v_target >= v_anchor + interval '24 hours' THEN
        v_action := 'park_window';
      END IF;
    END IF;
  ELSE
    v_target := now() + v_interval;
  END IF;

  IF v_action = 'send' THEN
    UPDATE sequence_enrollments
       SET touch_count = touch_count + 1, next_action_at = v_target,
           last_step_at = now(), send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'send';
  ELSIF v_action = 'wait' THEN
    UPDATE sequence_enrollments
       SET next_action_at = v_target, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'wait';
  ELSIF v_action = 'park_window' THEN
    -- a send that already went out must still be counted before parking
    UPDATE sequence_enrollments
       SET touch_count = touch_count + CASE WHEN p_action = 'send' THEN 1 ELSE 0 END,
           state = 'waiting_window', next_action_at = NULL, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := CASE WHEN p_action = 'send' THEN 'send' ELSE 'wait' END;
  ELSIF v_action = 'exhausted_ladder' THEN
    UPDATE sequence_enrollments
       SET touch_count = touch_count + CASE WHEN p_action = 'send' THEN 1 ELSE 0 END,
           state = 'exited', outcome = 'exhausted', completed_at = now(),
           next_action_at = NULL, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := CASE WHEN p_action = 'send' THEN 'send' ELSE 'stop' END;
  ELSIF v_action = 'paused_rejected' THEN
    UPDATE sequence_enrollments
       SET state = 'paused', paused_reason = 'send_failed_fb_rejected',
           next_action_at = NULL, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'stop';
  ELSIF v_action = 'escalate' THEN
    UPDATE sequence_enrollments
       SET state = 'exited', outcome = 'escalated', completed_at = now(),
           send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'escalate';
  ELSE
    UPDATE sequence_enrollments
       SET state = 'exited', outcome = CASE WHEN p_opted_out THEN 'opted_out' ELSE 'exhausted' END,
           completed_at = now(), send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'stop';
  END IF;

  IF p_opted_out THEN
    UPDATE leads SET followup_opted_out = true, followup_opted_out_at = now()
    WHERE id = v_lead_id AND followup_opted_out = false;
  END IF;

  INSERT INTO follow_up_decisions
    (enrollment_id, lead_id, client_id, decision, reason, message_sent, goal_status, window_open, context_snapshot)
  VALUES
    (p_enrollment_id, v_lead_id, v_client_id, v_log_decision, p_reason,
     CASE WHEN p_action='send' THEN p_message ELSE NULL END, p_goal_status, p_window_open, p_context);

  IF v_action = 'escalate' THEN
    IF NOT EXISTS (SELECT 1 FROM tasks t WHERE t.lead_id = v_lead_id
                     AND t.triggered_by = 'followup_engine' AND t.status = 'pending') THEN
      SELECT name INTO v_lead_name FROM leads WHERE id = v_lead_id;
      INSERT INTO tasks (lead_id, client_id, title, task_type, notes, status, source, triggered_by, due_date)
      VALUES (v_lead_id, v_client_id,
        'Hot lead — BaMo follow-up flagged buying intent' || COALESCE(' (' || v_lead_name || ')', ''),
        're-engagement',
        COALESCE(p_reason, 'BaMo AI follow-up detected buying intent and escalated for a human handoff.'),
        'pending', 'system', 'followup_engine', CURRENT_DATE);
    END IF;
  END IF;
END;
$function$;
