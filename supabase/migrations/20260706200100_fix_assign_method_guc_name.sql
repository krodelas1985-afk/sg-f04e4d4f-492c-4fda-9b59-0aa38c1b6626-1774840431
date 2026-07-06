-- Fix a bug introduced in 20260706200000: the per-lead handoff GUC name
-- 'bamo.assign_method.<hex-uuid>' is invalid — a custom GUC's dotted parts must
-- each be a simple identifier, and the hex uuid part starts with a digit. That
-- makes set_config() raise for every auto-assigned lead (only latent because
-- all clients are currently 'manual'). Use a valid two-part name: bamo.am_<hex>.

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
  -- Per-lead handoff keyed by id. Prefix with a letter so the GUC name's second
  -- part is a valid identifier (a bare hex uuid starts with a digit).
  PERFORM set_config(
    'bamo.am_' || replace(NEW.id::text, '-', ''),
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
    v_method := NULLIF(current_setting('bamo.am_' || replace(NEW.id::text, '-', ''), true), '');
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
