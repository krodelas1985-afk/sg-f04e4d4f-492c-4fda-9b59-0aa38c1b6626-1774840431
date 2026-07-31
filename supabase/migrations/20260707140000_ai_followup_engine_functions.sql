-- AI Follow-Up Engine (W6) DB core: opt-out flag + Stage A/B/D functions.
-- Safe/inert: only touches ai_adaptive sequences (none live yet). n8n (service role /
-- direct Postgres) calls these; REVOKEd from PUBLIC so PostgREST anon/authenticated can't.
-- (Final form — folds in the in-window eligibility gate + numeric interval fixes.)

-- 0) Persistent opt-out + a dedicated task origin for W6
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS followup_opted_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_opted_out_at timestamptz;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_triggered_by_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_triggered_by_check
  CHECK (triggered_by = ANY (ARRAY['manual','campaign','baymo','system','sequence_scheduler','followup_engine']));

-- ── Stage A: scan + enroll eligible stalled Messenger leads (in-window only) ────
CREATE OR REPLACE FUNCTION public.enroll_ai_followup_candidates()
RETURNS TABLE(enrollment_id uuid, lead_id uuid, sequence_id uuid, client_id uuid)
LANGUAGE sql SET search_path TO 'public' AS $function$
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
      AND (SELECT count(*) FROM conversations cv WHERE cv.lead_id = l.id AND cv.direction = 'inbound') < 4
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

-- ── Stage B: atomic fetch-and-lock of due evaluations + full context bundle ────
CREATE OR REPLACE FUNCTION public.fetch_due_ai_followups(p_limit int DEFAULT 25)
RETURNS TABLE(enrollment_id uuid, lead_id uuid, client_id uuid, messenger_id text, fb_page_token text, context jsonb)
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_now_hm text := to_char(timezone('Asia/Manila', now()), 'HH24:MI');
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT se.id
    FROM sequence_enrollments se
    JOIN sequences s ON s.id = se.sequence_id AND s.mode='ai_adaptive' AND s.is_active=true
    JOIN campaigns c ON c.id = s.campaign_id AND c.status='active'
    JOIN leads l ON l.id = se.lead_id
    WHERE se.state='active' AND se.send_lock=false
      AND se.next_action_at IS NOT NULL AND se.next_action_at <= NOW()
      AND l.automation_enabled = true
      AND COALESCE(l.followup_opted_out,false) = false
      AND l.status NOT IN ('Won','Lost')
      AND CASE
            WHEN COALESCE(s.send_window_start,'08:00') <= COALESCE(s.send_window_end,'20:00')
              THEN v_now_hm >= COALESCE(s.send_window_start,'08:00') AND v_now_hm <= COALESCE(s.send_window_end,'20:00')
            ELSE v_now_hm >= COALESCE(s.send_window_start,'08:00') OR v_now_hm <= COALESCE(s.send_window_end,'20:00')
          END
    ORDER BY se.next_action_at ASC
    LIMIT p_limit
    FOR UPDATE OF se SKIP LOCKED
  ),
  locked AS (
    UPDATE sequence_enrollments se SET send_lock=true, updated_at=NOW()
    WHERE se.id IN (SELECT id FROM due)
    RETURNING se.*
  )
  SELECT
    en.id, en.lead_id, en.client_id, l.messenger_id, cl.fb_page_token,
    jsonb_build_object(
      'goal', COALESCE(s.ai_settings->>'goal','book_viewing'),
      'tone', COALESCE(s.ai_settings->>'tone','friendly'),
      'language', COALESCE(s.ai_settings->>'language','auto'),
      'custom_instructions', COALESCE(s.ai_settings->>'custom_instructions',''),
      'max_touches_per_pass', COALESCE((s.ai_settings->>'max_touches_per_pass')::int, 3),
      'escalate_after_touches', COALESCE((s.ai_settings->>'escalate_after_touches')::int, 3),
      'touch_count', en.touch_count,
      'pass_number', en.pass_number,
      'hours_since_inbound', ROUND(EXTRACT(EPOCH FROM (now() - l.last_inbound_at))/3600.0, 1),
      'window_open', (l.last_inbound_at IS NOT NULL AND l.last_inbound_at > now() - interval '24 hours'),
      'window_closing', (l.last_inbound_at IS NOT NULL AND l.last_inbound_at <= now() - interval '22 hours'),
      'lead', jsonb_build_object(
        'name', l.name, 'temperature', l.lead_temperature, 'status', l.status,
        'conversation_stage', l.conversation_stage, 'viewing_stage', l.viewing_stage,
        'last_question_asked', l.last_question_asked, 'questions_asked', l.questions_asked
      ),
      'campaign', jsonb_build_object('target_action', c.target_action, 'tone', c.tone),
      'qualifications', to_jsonb(q.*),
      'memory', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('type', m.memory_type, 'label', m.memory_label, 'value', m.value_text)
                         ORDER BY m.importance_score DESC NULLS LAST)
        FROM lead_memory m WHERE m.lead_id = l.id AND m.is_active = true), '[]'::jsonb),
      'kb_knowledge', COALESCE((
        SELECT string_agg(kb.content, E'\n---\n')
        FROM campaign_knowledge_base kb
        WHERE kb.is_active = true AND COALESCE(kb.type,'knowledge') <> 'instruction'
          AND (kb.campaign_id = c.id OR (kb.scope = 'client' AND kb.client_id = l.client_id))), ''),
      'kb_instructions', COALESCE((
        SELECT string_agg(kb.content, E'\n')
        FROM campaign_knowledge_base kb
        WHERE kb.is_active = true AND kb.type = 'instruction'
          AND (kb.campaign_id = c.id OR (kb.scope = 'client' AND kb.client_id = l.client_id))), ''),
      'recent_messages', COALESCE((
        SELECT jsonb_agg(msg ORDER BY (msg->>'created_at') ASC) FROM (
          SELECT jsonb_build_object('direction', cv.direction, 'sender', cv.sender,
                                    'content', cv.message_content, 'created_at', cv.created_at) AS msg
          FROM conversations cv WHERE cv.lead_id = l.id
          ORDER BY cv.created_at DESC LIMIT 10
        ) t), '[]'::jsonb),
      'prior_decisions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('decision', d.decision, 'reason', d.reason, 'message', d.message_sent, 'at', d.created_at)
                         ORDER BY d.created_at ASC)
        FROM follow_up_decisions d WHERE d.enrollment_id = en.id), '[]'::jsonb)
    ) AS context
  FROM locked en
  JOIN sequences s ON s.id = en.sequence_id
  JOIN campaigns c ON c.id = s.campaign_id
  JOIN leads l ON l.id = en.lead_id
  JOIN clients cl ON cl.id = en.client_id
  LEFT JOIN lead_qualifications q ON q.lead_id = l.id;
END;
$function$;

-- ── Stage D: apply the resolved action atomically (state + decision log in one place) ──
CREATE OR REPLACE FUNCTION public.apply_ai_followup_decision(
  p_enrollment_id uuid, p_action text, p_message text DEFAULT NULL, p_reason text DEFAULT NULL,
  p_goal_status text DEFAULT NULL, p_next_check_hours numeric DEFAULT 6, p_window_open boolean DEFAULT true,
  p_opted_out boolean DEFAULT false, p_context jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_lead_id uuid; v_client_id uuid; v_seq_name text; v_lead_name text; v_log_decision text;
  v_interval interval := GREATEST(p_next_check_hours, 1) * interval '1 hour';
BEGIN
  SELECT se.lead_id, se.client_id, s.name INTO v_lead_id, v_client_id, v_seq_name
  FROM sequence_enrollments se JOIN sequences s ON s.id = se.sequence_id
  WHERE se.id = p_enrollment_id;
  IF v_lead_id IS NULL THEN RETURN; END IF;

  IF p_action = 'send' THEN
    UPDATE sequence_enrollments
       SET touch_count = touch_count + 1, next_action_at = now() + v_interval,
           last_step_at = now(), send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'send';
  ELSIF p_action = 'wait' THEN
    UPDATE sequence_enrollments
       SET next_action_at = now() + v_interval, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'wait';
  ELSIF p_action = 'park_window' THEN
    UPDATE sequence_enrollments
       SET state = 'waiting_window', next_action_at = NULL, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'wait';
  ELSIF p_action = 'paused_rejected' THEN
    UPDATE sequence_enrollments
       SET state = 'paused', paused_reason = 'send_failed_fb_rejected',
           next_action_at = NULL, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'stop';
  ELSIF p_action = 'escalate' THEN
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

  IF p_action = 'escalate' THEN
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

-- Keep these off the public PostgREST surface; n8n uses a privileged/direct connection.
REVOKE ALL ON FUNCTION public.enroll_ai_followup_candidates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fetch_due_ai_followups(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_ai_followup_decision(uuid,text,text,text,text,numeric,boolean,boolean,jsonb) FROM PUBLIC;
