-- reassign_task(): agents hand a task to a teammate via RPC because a plain
-- UPDATE can't — once assigned_to points at the teammate, the new row no
-- longer passes the agent's SELECT policy (not creator, not assignee, no
-- lead), and Postgres rejects the update when reading the row back ("new row
-- violates row-level security"). SECURITY DEFINER sidesteps the read-back
-- while re-implementing the same visibility gate on the OLD row, plus a
-- same-client check on the target. auth.uid() is still the caller inside the
-- definer, so the task_assigned trigger's self-assign suppression works.

CREATE OR REPLACE FUNCTION public.reassign_task(p_task_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task record;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task not found';
  END IF;

  -- caller must be able to see the task today (mirror of tasks_select)
  IF NOT (
    get_my_role() = 'baymo_admin'
    OR (v_task.client_id = get_my_client_id()
        AND (get_my_role() <> 'agent'
             OR lead_assigned_to_me(v_task.lead_id)
             OR v_task.assigned_to = auth.uid()
             OR v_task.created_by = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  -- target must be an active member of the task's client
  IF NOT EXISTS (
    SELECT 1 FROM profiles
     WHERE id = p_user_id AND client_id = v_task.client_id AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'assignee is not an active member of this workspace';
  END IF;

  UPDATE tasks SET assigned_to = p_user_id, updated_at = now() WHERE id = p_task_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reassign_task(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reassign_task(uuid, uuid) TO authenticated;
