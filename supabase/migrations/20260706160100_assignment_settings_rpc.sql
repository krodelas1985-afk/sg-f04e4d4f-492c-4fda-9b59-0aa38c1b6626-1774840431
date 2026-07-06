-- Phase 3: settings access for client_admin.
--
-- The clients table is RLS'd baymo_admin-only (clients_all_admin_only), so a
-- client_admin cannot read or write their own assignment_mode/assignment_sources
-- directly — a plain UPDATE would silently match zero rows. Opening UPDATE on
-- the whole row would expose sensitive columns (fb_page_token, webhook_secret,
-- ads plan), so instead expose exactly these two fields through narrow
-- SECURITY DEFINER RPCs, following the existing get_my_* pattern.

CREATE OR REPLACE FUNCTION public.get_my_assignment_settings()
RETURNS TABLE (assignment_mode text, assignment_sources text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.assignment_mode, c.assignment_sources
  FROM public.clients c
  WHERE c.id = public.get_my_client_id();
$$;

CREATE OR REPLACE FUNCTION public.set_my_assignment_settings(
  p_mode text,
  p_sources text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_role() <> 'client_admin' THEN
    RAISE EXCEPTION 'Only a client admin can change assignment settings';
  END IF;
  IF p_mode NOT IN ('manual', 'round_robin', 'performance') THEN
    RAISE EXCEPTION 'Invalid assignment mode %', p_mode;
  END IF;

  UPDATE public.clients
    SET assignment_mode = p_mode,
        assignment_sources = p_sources
    WHERE id = public.get_my_client_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No client workspace found for this user';
  END IF;
END;
$$;

-- Callable by signed-in users only.
REVOKE EXECUTE ON FUNCTION public.get_my_assignment_settings() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_my_assignment_settings(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_assignment_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_assignment_settings(text, text[]) TO authenticated;
