-- Phase 0 security: prevent privilege escalation via profiles UPDATE.
--
-- The profiles_update RLS policy allows a user to update their own row
-- (auth.uid() = id). Because there is no column-level restriction, any
-- authenticated user (e.g. an agent) could set their own role to
-- 'baymo_admin' or move themselves to another client_id. RLS cannot easily
-- express "any column except role/client_id", so we enforce it with a
-- BEFORE UPDATE trigger.
--
-- Rules:
--   * Backend/service-role contexts (auth.uid() IS NULL) pass through — the
--     admin API routes do their own authorization.
--   * baymo_admin may change anything.
--   * Nobody may change their OWN role.
--   * Only client_admin may change another user's role, only within their own
--     client, and only to an allowed (non-baymo_admin) role.
--   * Only baymo_admin may move a user between clients (change client_id).

CREATE OR REPLACE FUNCTION public.enforce_profile_field_locks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role   text := public.get_my_role();
  my_client uuid := public.get_my_client_id();
BEGIN
  -- Service-role / backend contexts have no authenticated user.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- baymo_admin may change anything.
  IF my_role = 'baymo_admin' THEN
    RETURN NEW;
  END IF;

  -- Role changes.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NEW.id = auth.uid() THEN
      RAISE EXCEPTION 'You cannot change your own role';
    END IF;
    IF my_role <> 'client_admin' OR OLD.client_id IS DISTINCT FROM my_client THEN
      RAISE EXCEPTION 'Not permitted to change this user''s role';
    END IF;
    IF NEW.role NOT IN ('client_admin', 'manager', 'agent', 'viewer') THEN
      RAISE EXCEPTION 'Cannot assign role %', NEW.role;
    END IF;
  END IF;

  -- Client reassignment: baymo_admin only (already returned above).
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Not permitted to change client assignment';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_field_locks ON public.profiles;

CREATE TRIGGER trg_enforce_profile_field_locks
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_field_locks();
