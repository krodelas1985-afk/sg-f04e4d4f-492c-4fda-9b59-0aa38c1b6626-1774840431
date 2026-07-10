-- ============================================================================
-- Tasks foundation (Phase 1 of dashboard/tasks/digest plan) — make the shared
-- tasks table usable as the mobile app's Task section.
--
--  1. lead_id becomes nullable: manual self-tasks and BaMo daily-check tasks
--     don't always relate to a lead. Agent RLS still holds: with a NULL lead,
--     lead_assigned_to_me(NULL) is false, so an agent only sees such a task
--     when assigned_to = auth.uid() (mobile always sets assigned_to on create).
--  2. status gains 'deferred' (+ deferred_until date); a nightly Manila-
--     midnight sweep flips due deferred tasks back to pending.
--  3. source gains 'baymo' (BaMo daily-check tasks, distinct from sequence
--     'system' tasks); task_type gains 'takeover' (Phase 3) and 'general'.
--  4. get_my_team_members() RPC feeds the mobile Assign picker (profiles RLS
--     doesn't let agents enumerate teammates).
--  5. task_assigned notification on insert/reassign, following the Phase 0
--     notifications pattern (SECURITY DEFINER, exception-wrapped, never blocks
--     the task write). Push gating: notification_preferences.tasks (default
--     on); push-dispatch POLICY entry ships with the next edge-fn deploy —
--     until then the type is in-app only by design (unknown type => no push).
-- ============================================================================

-- ── 1. lead_id nullable ──────────────────────────────────────────────────────
ALTER TABLE public.tasks ALTER COLUMN lead_id DROP NOT NULL;

-- ── 2. status / source / task_type constraint updates ───────────────────────
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check
  CHECK (status = ANY (ARRAY['pending','completed','overdue','cancelled','deferred']));

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_source_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_source_check
  CHECK (source = ANY (ARRAY['manual','campaign','system','baymo']));

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type = ANY (ARRAY['follow-up','send-listings','viewing-reminder','re-engagement',
                                'follow_up','Call','Email','Follow-up','Meeting','Other',
                                'takeover','general']));

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deferred_until date;

-- Supporting indexes for the mobile queries (my tasks by status/due date).
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status_due
  ON public.tasks (assigned_to, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_client_status_due
  ON public.tasks (client_id, status, due_date);

-- ── 3. Deferred → pending sweep at Manila midnight ───────────────────────────
CREATE OR REPLACE FUNCTION public.run_deferred_task_sweep()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tasks
     SET status = 'pending',
         due_date = deferred_until,
         updated_at = now()
   WHERE status = 'deferred'
     AND deferred_until IS NOT NULL
     AND deferred_until <= (now() AT TIME ZONE 'Asia/Manila')::date;
$$;

-- 16:05 UTC = 00:05 Asia/Manila
SELECT cron.schedule('tasks-deferred-sweep', '5 16 * * *',
  $$select public.run_deferred_task_sweep()$$);

-- ── 4. Team-members RPC for the Assign picker ────────────────────────────────
-- Active profiles of the caller's client (agents can't read teammate profiles
-- directly under profiles RLS). Names/roles only — no emails or phones.
CREATE OR REPLACE FUNCTION public.get_my_team_members()
RETURNS TABLE (id uuid, full_name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.role
    FROM public.profiles p
   WHERE p.client_id = get_my_client_id()
     AND p.client_id IS NOT NULL
     AND p.is_active IS TRUE
   ORDER BY p.full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_team_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_members() TO authenticated;

-- ── 5. task_assigned notification ────────────────────────────────────────────
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS tasks boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), CASE WHEN tg_op = 'INSERT' THEN new.created_by END);
  v_lead_name text;
  v_body text;
BEGIN
  IF new.assigned_to IS NULL THEN
    RETURN new;
  END IF;
  -- only on a real (re)assignment, and never for self-assignment
  IF tg_op = 'UPDATE' AND old.assigned_to IS NOT DISTINCT FROM new.assigned_to THEN
    RETURN new;
  END IF;
  IF new.assigned_to = v_actor THEN
    RETURN new;
  END IF;

  IF new.lead_id IS NOT NULL THEN
    SELECT name INTO v_lead_name FROM public.leads WHERE id = new.lead_id;
  END IF;
  v_body := new.title || COALESCE(' — ' || v_lead_name, '');

  PERFORM public.create_notification(
    new.assigned_to, new.client_id, 'task_assigned',
    'New task assigned to you',
    v_body,
    jsonb_build_object('task_id', new.id, 'lead_id', new.lead_id, 'route', '/tasks'));

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;  -- never block the task write
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned_ins ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned_ins
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

DROP TRIGGER IF EXISTS trg_notify_task_assigned_upd ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned_upd
  AFTER UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();
