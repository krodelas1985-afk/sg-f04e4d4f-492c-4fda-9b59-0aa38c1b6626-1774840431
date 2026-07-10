-- Public self-serve signup (RE Assistant mobile app) needs new users to land as
-- `client_admin` (workspace owner) rather than the legacy `agent` default.
--
-- SECURITY: raw_user_meta_data is fully attacker-controlled at the public
-- auth.signUp endpoint, so the role whitelist here is a privilege gate. It
-- deliberately EXCLUDES 'baymo_admin' — a forged { role: 'baymo_admin' } in
-- signup metadata must never grant platform-admin. baymo_admin is only ever
-- assigned by a trusted operator via a direct UPDATE. 'client_admin' is safe to
-- accept from metadata: it confers no cross-tenant power on its own — a fresh
-- signup has client_id = NULL until auto-provisioned, so RLS (get_my_client_id())
-- scopes it to nothing but its own profile row.
--
-- Legacy values (manager/agent/viewer) stay accepted so admin-created CRM users
-- (which pass role in metadata) keep working unchanged.

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
    CASE
      -- baymo_admin is intentionally NOT in this list (see SECURITY note above)
      WHEN NEW.raw_user_meta_data->>'role' IN ('client_admin', 'manager', 'agent', 'viewer')
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
