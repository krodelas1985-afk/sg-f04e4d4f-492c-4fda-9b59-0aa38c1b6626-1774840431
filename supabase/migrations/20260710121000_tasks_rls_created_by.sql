-- Tasks RLS follow-up: the Phase-5 agent scoping blocked legitimate handoffs.
-- An agent could not (a) create a lead-less task assigned to a teammate, or
-- (b) reassign away a task that had been assigned to them (UPDATE WITH CHECK
-- only accepted rows still assigned to self). Widen the agent clause with
-- created_by = auth.uid(), and relax UPDATE's WITH CHECK to client scope —
-- which rows an agent may touch is already gated by USING.

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT USING (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent'
             OR lead_assigned_to_me(lead_id)
             OR assigned_to = auth.uid()
             OR created_by = auth.uid()))
  );

DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT WITH CHECK (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent'
             OR lead_assigned_to_me(lead_id)
             OR assigned_to = auth.uid()
             OR created_by = auth.uid()))
  );

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE USING (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent'
             OR lead_assigned_to_me(lead_id)
             OR assigned_to = auth.uid()
             OR created_by = auth.uid()))
  ) WITH CHECK (
    get_my_role() = 'baymo_admin'
    OR client_id = get_my_client_id()
  );

DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE USING (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent'
             OR lead_assigned_to_me(lead_id)
             OR assigned_to = auth.uid()
             OR created_by = auth.uid()))
  );
