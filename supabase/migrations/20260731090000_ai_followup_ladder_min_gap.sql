-- Ladder touches falling in quiet hours all clamp to the same window opening.
-- Simulated against a 20:00 inbound, touches 1/2/3 every one resolved to 07:00
-- the next morning - three messages inside 45 minutes on consecutive 15-min
-- ticks, which is precisely the pattern that gets a Page restricted.
--
-- Enforce a floor gap from the previous touch (ai_settings.min_gap_hours,
-- default 1h) and re-clamp into the send window afterwards, since the floor can
-- push a touch back outside it. Also carries last_step_at through the
-- park_window / exhausted_ladder branches, which previously dropped it.
--
-- Full function body is maintained in 20260731080000; this supersedes it.

CREATE OR REPLACE FUNCTION public.apply_ai_followup_decision(p_enrollment_id uuid, p_action text, p_message text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_goal_status text DEFAULT NULL::text, p_next_check_hours numeric DEFAULT 6, p_window_open boolean DEFAULT true, p_opted_out boolean DEFAULT false, p_context jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_id uuid; v_client_id uuid; v_seq_name text; v_lead_name text; v_log_decision text;
  v_touch_count int; v_anchor timestamptz; v_ws text; v_we text; v_last_step timestamptz;
  v_ladder numeric[]; v_next_idx int; v_cum numeric; v_min_gap numeric;
  v_target timestamptz; v_local timestamp; v_action text := p_action;
  v_interval interval := GREATEST(p_next_check_hours, 1) * interval '1 hour';
BEGIN
  SELECT se.lead_id, se.client_id, s.name, se.touch_count, l.last_inbound_at, se.last_step_at,
         COALESCE(s.send_window_start,'08:00'), COALESCE(s.send_window_end,'20:00'),
         ARRAY(SELECT x::numeric FROM jsonb_array_elements_text(
                 COALESCE(s.ai_settings->'followup_ladder_hours','[]'::jsonb)) x),
         COALESCE((s.ai_settings->>'min_gap_hours')::numeric, 1)
    INTO v_lead_id, v_client_id, v_seq_name, v_touch_count, v_anchor, v_last_step, v_ws, v_we, v_ladder, v_min_gap
  FROM sequence_enrollments se
  JOIN sequences s ON s.id = se.sequence_id
  JOIN leads l ON l.id = se.lead_id
  WHERE se.id = p_enrollment_id;
  IF v_lead_id IS NULL THEN RETURN; END IF;

  IF array_length(v_ladder,1) IS NOT NULL AND v_action IN ('send','wait') AND v_anchor IS NOT NULL THEN
    v_next_idx := CASE WHEN v_action = 'send' THEN v_touch_count + 2 ELSE v_touch_count + 1 END;

    IF v_next_idx > array_length(v_ladder,1) THEN
      v_action := 'exhausted_ladder';
    ELSE
      SELECT sum(v) INTO v_cum FROM unnest(v_ladder[1:v_next_idx]) v;
      v_target := v_anchor + v_cum * interval '1 hour';

      v_local := timezone('Asia/Manila', v_target);
      IF v_local::time < v_ws::time THEN
        v_local := v_local::date + v_ws::time;
      ELSIF v_local::time > v_we::time THEN
        v_local := (v_local::date + 1) + v_ws::time;
      END IF;
      v_target := timezone('Asia/Manila', v_local);

      IF p_action = 'send' THEN
        v_target := GREATEST(v_target, now() + v_min_gap * interval '1 hour');
      ELSIF v_last_step IS NOT NULL THEN
        v_target := GREATEST(v_target, v_last_step + v_min_gap * interval '1 hour');
      END IF;
      v_local := timezone('Asia/Manila', v_target);
      IF v_local::time < v_ws::time THEN
        v_local := v_local::date + v_ws::time;
      ELSIF v_local::time > v_we::time THEN
        v_local := (v_local::date + 1) + v_ws::time;
      END IF;
      v_target := timezone('Asia/Manila', v_local);

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
    UPDATE sequence_enrollments
       SET touch_count = touch_count + CASE WHEN p_action = 'send' THEN 1 ELSE 0 END,
           last_step_at = CASE WHEN p_action = 'send' THEN now() ELSE last_step_at END,
           state = 'waiting_window', next_action_at = NULL, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := CASE WHEN p_action = 'send' THEN 'send' ELSE 'wait' END;
  ELSIF v_action = 'exhausted_ladder' THEN
    UPDATE sequence_enrollments
       SET touch_count = touch_count + CASE WHEN p_action = 'send' THEN 1 ELSE 0 END,
           last_step_at = CASE WHEN p_action = 'send' THEN now() ELSE last_step_at END,
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
