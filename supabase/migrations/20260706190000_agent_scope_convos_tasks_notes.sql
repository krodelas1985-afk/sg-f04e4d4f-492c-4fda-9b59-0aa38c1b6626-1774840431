-- Phase 5: scope conversations / tasks / lead_notes to an agent's own leads.
--
-- These three were client-wide, so an 'agent' could read every other agent's
-- lead conversations, tasks, and notes within the brokerage. Mirror the leads /
-- appointments pattern: baymo_admin sees all; managers/client_admin see the
-- whole client; agents see only rows whose parent lead is assigned to them
-- (all three tables have lead_id NOT NULL). tasks additionally lets an agent
-- see/act on a task explicitly assigned to them.
--
-- Non-agent CRM flows are unaffected (get_my_role() <> 'agent'), and service-
-- role writers (n8n, BaMo AI, webhooks) bypass RLS entirely.

-- Assignment check as owner, so it doesn't re-trigger leads RLS. Boolean about
-- the caller's own assignment — no data leak.
CREATE OR REPLACE FUNCTION public.lead_assigned_to_me(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leads
    WHERE id = p_lead_id AND assigned_user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.lead_assigned_to_me(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_assigned_to_me(uuid) TO authenticated;

-- ── conversations ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS conversations_select ON public.conversations;
CREATE POLICY conversations_select ON public.conversations
  FOR SELECT USING (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent' OR lead_assigned_to_me(lead_id)))
  );

DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert ON public.conversations
  FOR INSERT WITH CHECK (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent' OR lead_assigned_to_me(lead_id)))
  );

DROP POLICY IF EXISTS conversations_update ON public.conversations;
CREATE POLICY conversations_update ON public.conversations
  FOR UPDATE USING (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent' OR lead_assigned_to_me(lead_id)))
  ) WITH CHECK (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent' OR lead_assigned_to_me(lead_id)))
  );

-- ── lead_notes ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS lead_notes_select ON public.lead_notes;
CREATE POLICY lead_notes_select ON public.lead_notes
  FOR SELECT USING (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent' OR lead_assigned_to_me(lead_id)))
  );

DROP POLICY IF EXISTS lead_notes_insert ON public.lead_notes;
CREATE POLICY lead_notes_insert ON public.lead_notes
  FOR INSERT WITH CHECK (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent' OR lead_assigned_to_me(lead_id)))
  );

DROP POLICY IF EXISTS lead_notes_update ON public.lead_notes;
CREATE POLICY lead_notes_update ON public.lead_notes
  FOR UPDATE USING (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent' OR lead_assigned_to_me(lead_id)))
  ) WITH CHECK (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent' OR lead_assigned_to_me(lead_id)))
  );

DROP POLICY IF EXISTS lead_notes_delete ON public.lead_notes;
CREATE POLICY lead_notes_delete ON public.lead_notes
  FOR DELETE USING (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent' OR lead_assigned_to_me(lead_id)))
  );

-- ── tasks (also honors a task assigned directly to the agent) ────────────────
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT USING (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent'
             OR lead_assigned_to_me(lead_id)
             OR assigned_to = auth.uid()))
  );

DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT WITH CHECK (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent'
             OR lead_assigned_to_me(lead_id)
             OR assigned_to = auth.uid()))
  );

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE USING (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent'
             OR lead_assigned_to_me(lead_id)
             OR assigned_to = auth.uid()))
  ) WITH CHECK (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent'
             OR lead_assigned_to_me(lead_id)
             OR assigned_to = auth.uid()))
  );

DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE USING (
    get_my_role() = 'baymo_admin'
    OR (client_id = get_my_client_id()
        AND (get_my_role() <> 'agent'
             OR lead_assigned_to_me(lead_id)
             OR assigned_to = auth.uid()))
  );

-- Supporting index for the assignment lookups the policies drive.
CREATE INDEX IF NOT EXISTS idx_leads_assigned_user ON public.leads (assigned_user_id);
