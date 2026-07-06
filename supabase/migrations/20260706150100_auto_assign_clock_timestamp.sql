-- Fairness fix for batch inserts: now() is frozen for the whole transaction,
-- so several leads inserted in one transaction (e.g. an n8n batch) would tie on
-- last_assigned_at after the first rotation pass and the uuid tie-break would
-- keep picking the same pool member (A,B,A,A... instead of A,B,A,B...).
-- clock_timestamp() advances in real time, so each pick within a transaction
-- strictly orders the rotation.

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
  -- Manual assignment always wins; CRM (authenticated) inserts never auto-assign.
  IF NEW.assigned_user_id IS NOT NULL OR auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT assignment_mode, assignment_sources
    INTO v_mode, v_sources
    FROM public.clients WHERE id = NEW.client_id;

  IF v_mode IS NULL OR v_mode = 'manual' THEN
    RETURN NEW;
  END IF;

  -- Source filter: NULL = all sources; otherwise the source must match.
  IF v_sources IS NOT NULL AND (NEW.source IS NULL OR NOT (NEW.source = ANY (v_sources))) THEN
    RETURN NEW;
  END IF;

  IF v_mode = 'performance' THEN
    -- Weighted least-recently-assigned: elapsed time since last pick, scaled
    -- by weight. Equal weights degrade to plain round-robin.
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
    -- round_robin: least-recently-assigned; never-assigned members first.
    SELECT p.user_id INTO v_pick
    FROM public.lead_assignment_pool p
    JOIN public.profiles pr ON pr.id = p.user_id AND pr.is_active
    WHERE p.client_id = NEW.client_id AND p.is_active
    ORDER BY p.last_assigned_at ASC NULLS FIRST, p.user_id
    LIMIT 1
    FOR UPDATE OF p SKIP LOCKED;
  END IF;

  IF v_pick IS NULL THEN
    RETURN NEW;  -- empty/locked-out pool: lead stays unassigned for manual triage
  END IF;

  UPDATE public.lead_assignment_pool
    SET last_assigned_at = clock_timestamp()
    WHERE client_id = NEW.client_id AND user_id = v_pick;

  NEW.assigned_user_id := v_pick;
  -- Hand the method to the AFTER trigger that writes the audit row.
  PERFORM set_config(
    'bamo.assignment_method',
    CASE v_mode WHEN 'performance' THEN 'auto_performance' ELSE 'auto_round_robin' END,
    true
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_assign_lead() FROM PUBLIC, anon, authenticated;
