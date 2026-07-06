-- Phase 0 security (follow-up): close the INSERT-path privilege escalation
-- that the BEFORE UPDATE trigger in 20260706120000 does not cover.
--
-- Hole: handle_new_user() (AFTER INSERT on auth.users) set the profile role
-- from COALESCE(raw_user_meta_data->>'role', 'client_admin'). raw_user_meta_data
-- is attacker-controlled on a self-service auth.signUp() call (anon key is
-- public), so anyone could self-provision as 'baymo_admin' — which bypasses all
-- per-client scoping and reads every tenant's data.
--
-- Safe to stop trusting metadata for privileged roles because every legitimate
-- user-creation path (api/admin/users/invite, api/admin/clients/[id]/users)
-- re-applies the intended role via a service-role upsert immediately after the
-- auth user is created. handle_new_user therefore only needs to seed a
-- least-privilege role; admins elevate through the trusted server path.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    -- Only non-privileged roles may come from signup metadata; anything else
    -- (baymo_admin, client_admin, absent, invalid) is capped to 'agent'.
    -- Trusted admin flows elevate to client_admin/baymo_admin via service role.
    CASE
      WHEN NEW.raw_user_meta_data->>'role' IN ('manager', 'agent', 'viewer')
        THEN NEW.raw_user_meta_data->>'role'
      ELSE 'agent'
    END,
    true,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Secondary latent hole: the permissive self-insert policy allowed any role.
-- No app code performs a client-side profiles INSERT (handle_new_user, a
-- SECURITY DEFINER trigger, creates the row), so restricting this policy to
-- non-privileged roles only affects the escalation bypass, not real flows.
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO public
WITH CHECK (auth.uid() = id AND role IN ('manager', 'agent', 'viewer'));
