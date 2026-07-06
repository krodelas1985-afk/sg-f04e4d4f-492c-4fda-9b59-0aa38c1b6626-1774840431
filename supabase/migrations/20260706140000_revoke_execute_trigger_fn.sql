-- Phase 0 security (hygiene): the enforce_profile_field_locks() trigger function
-- is SECURITY DEFINER and, by default, EXECUTE is granted to PUBLIC — so it is
-- exposed as a callable RPC (/rest/v1/rpc/enforce_profile_field_locks) to anon
-- and authenticated roles. Direct calls error (NEW/OLD are only bound in a
-- trigger context) so there is no exploit, but there is no reason to expose it.
-- Revoking EXECUTE does not affect trigger firing — triggers run as the table
-- owner regardless of the invoking role's privileges.

REVOKE EXECUTE ON FUNCTION public.enforce_profile_field_locks() FROM PUBLIC, anon, authenticated;
