-- Phase 4: mobile reassignment feed.
--
-- The RE Assistant app shows each agent an in-app activity feed of assignment
-- changes involving them: leads newly assigned TO them, and leads reassigned
-- AWAY to someone else. For the "reassigned away" case the agent can no longer
-- read the lead row (leads RLS hides it once assigned_user_id changes), so a
-- client-side join can't resolve the lead name. This SECURITY DEFINER function
-- resolves the name server-side, scoped strictly to events where the caller is
-- the from- or to-user.

CREATE OR REPLACE FUNCTION public.get_my_assignment_feed(p_limit int DEFAULT 30)
RETURNS TABLE (
  id uuid,
  lead_id uuid,
  lead_name text,
  direction text,   -- 'assigned_to_me' | 'reassigned_away'
  method text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.lead_id,
    l.name AS lead_name,
    CASE
      WHEN e.to_user_id = auth.uid() THEN 'assigned_to_me'
      ELSE 'reassigned_away'
    END AS direction,
    e.method,
    e.created_at
  FROM public.lead_assignment_events e
  LEFT JOIN public.leads l ON l.id = e.lead_id
  WHERE auth.uid() IS NOT NULL
    AND (e.to_user_id = auth.uid() OR e.from_user_id = auth.uid())
    AND e.to_user_id IS DISTINCT FROM e.from_user_id
  ORDER BY e.created_at DESC
  LIMIT least(coalesce(p_limit, 30), 100);
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_assignment_feed(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_assignment_feed(int) TO authenticated;
