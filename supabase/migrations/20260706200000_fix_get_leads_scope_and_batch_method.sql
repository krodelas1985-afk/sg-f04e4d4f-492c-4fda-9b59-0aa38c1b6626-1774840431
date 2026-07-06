-- Cross-check fixes for the lead assignment build.
--
-- FINDING 1 (critical): get_leads_with_details guarded with
--   IF p_client_id != get_my_client_id() THEN RAISE ...
-- For an unauthenticated caller get_my_client_id() is NULL, so the comparison
-- is NULL (not TRUE) and the guard is skipped — anon could pass any client_id
-- and read that tenant's leads (plus latest message + next task via the
-- subqueries). The function is also SECURITY DEFINER with no agent scoping, so
-- an 'agent' saw the whole client pipeline, defeating P1/P5.
-- Fix: NULL-safe authorization (baymo_admin → any client; others → must match
-- their own non-null client; anyone else → raise) and agent row scoping in the
-- WHERE (agents see only leads assigned to them), matching the leads RLS.
--
-- FINDING 2 (minor): auto_assign_lead handed the method to log_lead_assignment
-- via a single transaction GUC (bamo.assignment_method). In one multi-row
-- INSERT, Postgres runs all BEFORE-row triggers before any AFTER-row trigger,
-- so the last BEFORE overwrites the GUC and the AFTER rows read the wrong (or
-- cleared) value — batch inserts mislabeled auto rows as 'system'. The
-- assignment itself was always correct; only the audit method label was wrong.
-- Fix: key the handoff GUC by lead id so each row keeps its own method.

-- ── Finding 1 ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_leads_with_details(
  p_client_id uuid,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_status text DEFAULT NULL::text,
  p_stage text DEFAULT NULL::text,
  p_source text DEFAULT NULL::text,
  p_assigned_user_id uuid DEFAULT NULL::uuid,
  p_campaign_id uuid DEFAULT NULL::uuid,
  p_search text DEFAULT NULL::text,
  p_sort_by text DEFAULT 'created_at'::text,
  p_sort_dir text DEFAULT 'desc'::text,
  p_quality text DEFAULT NULL::text,
  p_lead_type text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, client_id uuid, campaign_id uuid, assigned_user_id uuid, name text, phone text, email text, company text, source text, source_override boolean, status text, lead_temperature text, lead_score integer, lead_quality text, lead_quality_source text, lead_quality_reason text, lead_quality_updated_at timestamp with time zone, budget_min numeric, budget_max numeric, preferred_location text, property_type text, bedrooms integer, lead_type text, next_follow_up_date date, last_contacted_at timestamp with time zone, last_inbound_at timestamp with time zone, metadata jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, agent_name text, agent_role text, campaign_name text, last_message text, next_task_title text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := get_my_role();
BEGIN
  -- NULL-safe authorization: baymo_admin may query any client; everyone else
  -- must match their own (non-null) client. Unauthenticated/anon (both NULL)
  -- falls through to the exception.
  IF v_role = 'baymo_admin' THEN
    NULL;
  ELSIF get_my_client_id() IS NOT NULL AND p_client_id = get_my_client_id() THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Unauthorized: client_id does not match authenticated user';
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.client_id, l.campaign_id, l.assigned_user_id,
    l.name, l.phone, l.email, l.company,
    l.source, l.source_override, l.status,
    l.lead_temperature, l.lead_score,
    l.lead_quality, l.lead_quality_source,
    l.lead_quality_reason, l.lead_quality_updated_at,
    lq.budget_min, lq.budget_max,
    lq.preferred_location[1], lq.property_type, lq.bedrooms,
    l.lead_type, l.next_follow_up_date, l.last_contacted_at,
    l.last_inbound_at,
    l.metadata, l.created_at, l.updated_at,
    p.full_name AS agent_name,
    p.role AS agent_role,
    c.name AS campaign_name,
    COALESCE(
      (SELECT cv.message_content FROM conversations cv
         WHERE cv.lead_id = l.id ORDER BY cv.created_at DESC LIMIT 1),
      'No messages'
    ) AS last_message,
    COALESCE(
      (SELECT tk.title FROM tasks tk
         WHERE tk.lead_id = l.id AND tk.status != 'completed'
         ORDER BY tk.due_date ASC LIMIT 1),
      'No pending tasks'
    ) AS next_task_title
  FROM leads l
  LEFT JOIN profiles p ON p.id = l.assigned_user_id
  LEFT JOIN campaigns c ON c.id = l.campaign_id
  LEFT JOIN lead_qualifications lq ON lq.lead_id = l.id
  WHERE l.client_id = p_client_id
    -- Agent scoping: agents see only leads assigned to them (mirrors leads RLS).
    AND (v_role <> 'agent' OR l.assigned_user_id = auth.uid())
    AND (p_status IS NULL OR l.status = p_status)
    AND (p_stage IS NULL OR l.lead_temperature = p_stage)
    AND (p_quality IS NULL OR l.lead_quality = p_quality)
    AND (p_lead_type IS NULL OR l.lead_type = p_lead_type)
    AND (p_source IS NULL OR l.source = p_source)
    AND (p_assigned_user_id IS NULL OR l.assigned_user_id = p_assigned_user_id)
    AND (
      p_campaign_id IS NULL
      OR (p_campaign_id = '00000000-0000-0000-0000-000000000000' AND l.campaign_id IS NULL)
      OR l.campaign_id = p_campaign_id
    )
    AND (
      p_search IS NULL OR
      COALESCE(l.name, '') ILIKE '%' || p_search || '%' OR
      COALESCE(l.phone, '') ILIKE '%' || p_search || '%' OR
      COALESCE(l.email, '') ILIKE '%' || p_search || '%' OR
      COALESCE(l.company, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY
    CASE WHEN p_sort_by = 'last_inbound_at'   AND p_sort_dir = 'asc'  THEN l.last_inbound_at   END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'last_inbound_at'   AND p_sort_dir = 'desc' THEN l.last_inbound_at   END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'last_contacted_at' AND p_sort_dir = 'asc'  THEN l.last_contacted_at END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'last_contacted_at' AND p_sort_dir = 'desc' THEN l.last_contacted_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'lead_score'        AND p_sort_dir = 'asc'  THEN l.lead_score        END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'lead_score'        AND p_sort_dir = 'desc' THEN l.lead_score        END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'created_at'        AND p_sort_dir = 'asc'  THEN l.created_at        END ASC  NULLS LAST,
    l.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- ── Finding 2 ────────────────────────────────────────────────────────────────
-- Per-lead GUC handoff so a multi-row INSERT labels each auto event correctly.
CREATE OR REPLACE FUNCTION public.auto_assign_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text;
  v_sources text[];
  v_pick uuid;
BEGIN
  IF NEW.assigned_user_id IS NOT NULL OR auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT assignment_mode, assignment_sources
    INTO v_mode, v_sources
    FROM public.clients WHERE id = NEW.client_id;

  IF v_mode IS NULL OR v_mode = 'manual' THEN
    RETURN NEW;
  END IF;

  IF v_sources IS NOT NULL AND (NEW.source IS NULL OR NOT (NEW.source = ANY (v_sources))) THEN
    RETURN NEW;
  END IF;

  IF v_mode = 'performance' THEN
    SELECT p.user_id INTO v_pick
    FROM public.lead_assignment_pool p
    JOIN public.profiles pr ON pr.id = p.user_id AND pr.is_active
    WHERE p.client_id = NEW.client_id AND p.is_active
    ORDER BY
      extract(epoch FROM (clock_timestamp() - COALESCE(p.last_assigned_at, 'epoch'::timestamptz))) * p.weight DESC,
      p.user_id
    LIMIT 1
    FOR UPDATE OF p SKIP LOCKED;
  ELSE
    SELECT p.user_id INTO v_pick
    FROM public.lead_assignment_pool p
    JOIN public.profiles pr ON pr.id = p.user_id AND pr.is_active
    WHERE p.client_id = NEW.client_id AND p.is_active
    ORDER BY p.last_assigned_at ASC NULLS FIRST, p.user_id
    LIMIT 1
    FOR UPDATE OF p SKIP LOCKED;
  END IF;

  IF v_pick IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.lead_assignment_pool
    SET last_assigned_at = clock_timestamp()
    WHERE client_id = NEW.client_id AND user_id = v_pick;

  NEW.assigned_user_id := v_pick;
  -- Per-lead handoff: keyed by NEW.id (populated by the column default before
  -- BEFORE triggers run) so batch multi-row inserts don't clobber each other.
  PERFORM set_config(
    'bamo.assign_method.' || replace(NEW.id::text, '-', ''),
    CASE v_mode WHEN 'performance' THEN 'auto_performance' ELSE 'auto_round_robin' END,
    true
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_assign_lead() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_lead_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_user_id IS NULL THEN
      RETURN NEW;
    END IF;
    v_method := NULLIF(current_setting('bamo.assign_method.' || replace(NEW.id::text, '-', ''), true), '');
    IF v_method IS NULL THEN
      v_method := CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'manual' END;
    END IF;
    INSERT INTO public.lead_assignment_events (lead_id, client_id, from_user_id, to_user_id, method, actor_id)
    VALUES (NEW.id, NEW.client_id, NULL, NEW.assigned_user_id, v_method, auth.uid());
  ELSE
    IF NEW.assigned_user_id IS NOT DISTINCT FROM OLD.assigned_user_id THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.lead_assignment_events (lead_id, client_id, from_user_id, to_user_id, method, actor_id)
    VALUES (
      NEW.id, NEW.client_id, OLD.assigned_user_id, NEW.assigned_user_id,
      CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'manual' END,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_lead_assignment() FROM PUBLIC, anon, authenticated;
