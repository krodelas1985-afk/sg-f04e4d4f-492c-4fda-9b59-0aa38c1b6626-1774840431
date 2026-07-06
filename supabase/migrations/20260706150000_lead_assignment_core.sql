-- Phase 1: lead assignment core.
--
-- Adds per-client assignment settings, the agent rotation pool, an assignment
-- audit table, and a BEFORE INSERT trigger on leads that auto-assigns
-- unassigned leads arriving through automated intake (n8n W1, webhooks).
--
-- Rules (per plan of record):
--   * Auto-assign fires ONLY when the insert has no authenticated user
--     (auth.uid() IS NULL = service-role/backend). Leads added by a logged-in
--     person in the CRM are never auto-assigned, regardless of source label.
--   * Auto-assign fires ONLY when the lead arrives unassigned.
--   * Per-client mode: 'manual' (default, off) | 'round_robin' | 'performance'.
--   * Per-client source filter: assignment_sources NULL = all sources;
--     otherwise the lead's source must be in the list.
--   * round_robin  = least-recently-assigned pool member.
--   * performance  = weighted least-recently-assigned (elapsed * weight);
--     weights default 1.0 (= fair rotation) until Phase 2 scoring updates them.
--   * Picker uses FOR UPDATE SKIP LOCKED so concurrent intake inserts cannot
--     double-pick the same pool row.

-- ── 1. Client settings ───────────────────────────────────────────────────────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS assignment_mode text NOT NULL DEFAULT 'manual'
    CONSTRAINT clients_assignment_mode_chk
    CHECK (assignment_mode IN ('manual', 'round_robin', 'performance')),
  ADD COLUMN IF NOT EXISTS assignment_sources text[] DEFAULT NULL;

COMMENT ON COLUMN public.clients.assignment_mode IS
  'Lead auto-assignment: manual (off) | round_robin (fair rotation) | performance (weighted rotation)';
COMMENT ON COLUMN public.clients.assignment_sources IS
  'Sources eligible for auto-assignment. NULL = all sources.';

-- ── 2. Rotation pool ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lead_assignment_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  -- Distribution weight. 1.0 = equal share. Phase 2 performance scoring writes
  -- values in [0.5, 2.0]; the floor guarantees no pool member is starved.
  weight numeric NOT NULL DEFAULT 1.0 CHECK (weight >= 0.5 AND weight <= 2.0),
  last_assigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);

COMMENT ON TABLE public.lead_assignment_pool IS
  'Which users participate in a client''s lead auto-assignment rotation.';

-- Pool rows must reference a user of the same client (and never baymo_admin).
CREATE OR REPLACE FUNCTION public.validate_assignment_pool_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  SELECT client_id, role INTO p FROM public.profiles WHERE id = NEW.user_id;
  IF p IS NULL THEN
    RAISE EXCEPTION 'Pool member % has no profile', NEW.user_id;
  END IF;
  IF p.client_id IS DISTINCT FROM NEW.client_id THEN
    RAISE EXCEPTION 'Pool member must belong to the same client';
  END IF;
  IF p.role = 'baymo_admin' THEN
    RAISE EXCEPTION 'baymo_admin cannot join an assignment pool';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_assignment_pool_member() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_assignment_pool_member ON public.lead_assignment_pool;
CREATE TRIGGER trg_validate_assignment_pool_member
BEFORE INSERT OR UPDATE ON public.lead_assignment_pool
FOR EACH ROW EXECUTE FUNCTION public.validate_assignment_pool_member();

-- ── 3. Assignment audit trail ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lead_assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  from_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  method text NOT NULL CHECK (method IN ('manual', 'auto_round_robin', 'auto_performance', 'system')),
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lead_assignment_events IS
  'Audit trail of lead assignment changes (manual and automatic). Written by triggers only.';

CREATE INDEX IF NOT EXISTS idx_assignment_events_client_time
  ON public.lead_assignment_events (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_events_to_user
  ON public.lead_assignment_events (to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_events_lead
  ON public.lead_assignment_events (lead_id);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.lead_assignment_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_events ENABLE ROW LEVEL SECURITY;

-- Pool: whole client can read (agents may see who is in rotation);
-- only baymo_admin / client_admin manage it.
CREATE POLICY pool_select ON public.lead_assignment_pool
  FOR SELECT USING (
    get_my_role() = 'baymo_admin' OR client_id = get_my_client_id()
  );
CREATE POLICY pool_insert ON public.lead_assignment_pool
  FOR INSERT WITH CHECK (
    get_my_role() = 'baymo_admin'
    OR (get_my_role() = 'client_admin' AND client_id = get_my_client_id())
  );
CREATE POLICY pool_update ON public.lead_assignment_pool
  FOR UPDATE USING (
    get_my_role() = 'baymo_admin'
    OR (get_my_role() = 'client_admin' AND client_id = get_my_client_id())
  );
CREATE POLICY pool_delete ON public.lead_assignment_pool
  FOR DELETE USING (
    get_my_role() = 'baymo_admin'
    OR (get_my_role() = 'client_admin' AND client_id = get_my_client_id())
  );

-- Events: admins/managers see the client's history; agents only events that
-- involve them. No INSERT/UPDATE/DELETE policies — only triggers write here.
CREATE POLICY assignment_events_select ON public.lead_assignment_events
  FOR SELECT USING (
    get_my_role() = 'baymo_admin'
    OR (
      client_id = get_my_client_id()
      AND (
        get_my_role() <> 'agent'
        OR to_user_id = auth.uid()
        OR from_user_id = auth.uid()
      )
    )
  );

-- ── 5. Auto-assignment (BEFORE INSERT on leads) ──────────────────────────────

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
      extract(epoch FROM (now() - COALESCE(p.last_assigned_at, 'epoch'::timestamptz))) * p.weight DESC,
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
    SET last_assigned_at = now()
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

DROP TRIGGER IF EXISTS trg_auto_assign_lead ON public.leads;
CREATE TRIGGER trg_auto_assign_lead
BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_lead();

-- ── 6. Audit logging (AFTER INSERT / AFTER UPDATE on leads) ─────────────────

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
    v_method := NULLIF(current_setting('bamo.assignment_method', true), '');
    PERFORM set_config('bamo.assignment_method', '', true);
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

DROP TRIGGER IF EXISTS trg_log_lead_assignment_ins ON public.leads;
CREATE TRIGGER trg_log_lead_assignment_ins
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_assignment();

DROP TRIGGER IF EXISTS trg_log_lead_assignment_upd ON public.leads;
CREATE TRIGGER trg_log_lead_assignment_upd
AFTER UPDATE OF assigned_user_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_assignment();
