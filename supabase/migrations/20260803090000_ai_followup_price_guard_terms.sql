-- AI Follow-Up: expose a per-sequence price-quote allowlist to W6.
--
-- On 2026-08-03 the engine sent a lead this: "the monthly amortization starts at
-- around ₱62,923.40 for 20 months". That number is real but it is a DOWN PAYMENT
-- installment from a different development, relabelled as an amortization -- an
-- overstatement of roughly 50% sitting in a real buyer's inbox.
--
-- Root cause is that "Sofia Expanded" is a house model sold across 8 developments
-- at 8 different prices. The KB now labels every figure with its development and
-- its kind (§3 down payment vs §4 amortization), but prompt text alone is not a
-- guarantee. This adds the data half of a deterministic guard: W6 blocks any
-- message containing a peso figure unless the message also names one of the
-- allowed developments/units for that sequence.
--
-- Empty or absent price_guard_terms = guard disabled, so this is inert for
-- sequences that do not configure it (e.g. the B2B campaign, which quotes BaMo
-- pricing rather than per-development property pricing).

CREATE OR REPLACE FUNCTION public.fetch_due_ai_followups(p_limit integer DEFAULT 25)
 RETURNS TABLE(enrollment_id uuid, lead_id uuid, client_id uuid, messenger_id text, fb_page_token text, context jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now_hm text := to_char(timezone('Asia/Manila', now()), 'HH24:MI');
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT se.id
    FROM sequence_enrollments se
    JOIN sequences s ON s.id = se.sequence_id AND s.mode='ai_adaptive' AND s.is_active=true
    JOIN campaigns c ON c.id = s.campaign_id
      AND c.status='active'
      AND c.conversational_ai_enabled = true
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
      -- Names that must appear alongside any peso figure. Empty = guard off.
      'price_guard_terms', COALESCE(s.ai_settings->'price_guard_terms', '[]'::jsonb),
      'touch_count', en.touch_count,
      'pass_number', en.pass_number,
      'hours_since_inbound', ROUND(EXTRACT(EPOCH FROM (now() - l.last_inbound_at))/3600.0, 1),
      'window_open', (l.last_inbound_at IS NOT NULL AND l.last_inbound_at > now() - interval '24 hours'),
      'window_closing', (l.last_inbound_at IS NOT NULL AND l.last_inbound_at <= now() - interval '22 hours'),
      -- whose assistant this is, on this client's Page
      'client_name', cl.name,
      'lead', jsonb_build_object(
        'name', l.name, 'temperature', l.lead_temperature, 'status', l.status,
        'conversation_stage', l.conversation_stage, 'viewing_stage', l.viewing_stage,
        'last_question_asked', l.last_question_asked, 'questions_asked', l.questions_asked
      ),
      'campaign', jsonb_build_object(
        'target_action', c.target_action,
        'tone', c.tone,
        'campaign_type', COALESCE(c.campaign_type, 'buyer'),
        'ai_instruction', COALESCE(c.ai_instruction, ''),
        'additional_instructions', COALESCE(c.additional_instructions, '')
      ),
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

-- Cristy: Sofia Expanded is one house model across 8 developments, each with its
-- own TCP. A peso figure is meaningless without the development name.
UPDATE sequences SET ai_settings = ai_settings || jsonb_build_object(
  'price_guard_terms', jsonb_build_array(
    'Valley Verde','Residences Lipa','Villa Verde','El Puerto Real','Catalina Lake',
    'Edinburgh','Lipa Royale','Bauan Grand','Monte Verde'))
WHERE mode='ai_adaptive'
  AND campaign_id = (SELECT id FROM campaigns WHERE name = 'CJA - Campaign _ Sofia Expanded');

-- Mary Ann / Vermira: one project, several unit types at different prices.
UPDATE sequences SET ai_settings = ai_settings || jsonb_build_object(
  'price_guard_terms', jsonb_build_array('Mira','Mireio','Vermira'))
WHERE mode='ai_adaptive'
  AND campaign_id = (SELECT id FROM campaigns WHERE name = 'Test 1'
                     AND client_id = (SELECT id FROM clients WHERE name ILIKE '%mary ann%' LIMIT 1));
