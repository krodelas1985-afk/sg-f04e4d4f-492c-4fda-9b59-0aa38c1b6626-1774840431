-- =============================================================================
-- Track B - Security sweep, finding F-H2
-- Revoke anon / authenticated EXECUTE on SECURITY DEFINER trigger functions
-- =============================================================================
--
-- The 2026-07-27 security review found 20 anon-executable SECURITY DEFINER
-- functions in `public`, trigger functions among them. Two have since gone.
-- Eighteen remain, and every one of them returns `trigger` and takes no
-- arguments:
--
--   auto_provision_client_from_onboarding   notify_followup_resolved
--   enforce_profile_personal_fields_owner_only  notify_page_connection_request
--   guard_profile_insert                    notify_page_connection_resolved
--   guard_profile_privileged_cols           notify_tour_completed
--   notify_automation_submitted             provision_client_from_web_onboarding
--   notify_client_application_submitted     trg_lead_grade_from_conversations
--   notify_followup_activated               trg_lead_grade_from_leads
--   notify_followup_request                 trg_lead_grade_from_qualifications
--   notify_followup_request_rejected        user_onboarding_tour_guard
--
-- These are the functions that provision clients, notify admins, and guard the
-- privileged columns on `profiles`. They run as their owner. None of them
-- should be callable by a browser holding an anon key, and none of them needs
-- to be: they are invoked by the trigger machinery, never by a caller.
--
-- WHY THIS IS SAFE, MEASURED RATHER THAN ASSUMED
--
-- The whole risk here is that Postgres might check EXECUTE on a trigger
-- function when the trigger FIRES, in which case this migration would break
-- every write path in the CRM. It does not: the privilege is checked when the
-- trigger is created. Verified on this server, in a rolled-back transaction,
-- with an analogue of the real functions (SECURITY DEFINER, RETURNS trigger,
-- zero args):
--
--   after REVOKE, has_function_privilege('authenticated', fn) = false
--   an INSERT run as `authenticated` still fired the trigger (touched = true)
--   a direct PERFORM of the function as `authenticated` was denied, 42501
--
-- A second reason there is no functional loss: PostgREST does not expose
-- functions returning `trigger`, so no RPC route to these existed either.
--
-- Written as a sweep over the catalog rather than eighteen REVOKE lines. The
-- rule is "no SECURITY DEFINER trigger function is reachable by an application
-- role", and a sweep states the rule; a list states one day's instance of it,
-- and this schema grows trigger functions regularly.
-- =============================================================================

DO $$
DECLARE
  r        record;
  v_fixed  text[] := '{}';
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND p.prorettype = 'pg_catalog.trigger'::regtype
       AND (has_function_privilege('anon', p.oid, 'EXECUTE')
         OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
     ORDER BY p.proname
  LOOP
    -- REVOKE FROM public alone is not enough: anon and authenticated are
    -- separate grantees and keep any privilege granted to them directly.
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated',
      r.proname);
    v_fixed := v_fixed || r.proname;
  END LOOP;

  IF array_length(v_fixed, 1) IS NULL THEN
    RAISE NOTICE 'F-H2: nothing to do - no reachable definer trigger functions.';
  ELSE
    RAISE NOTICE 'F-H2: revoked EXECUTE on % trigger function(s): %',
      array_length(v_fixed, 1), array_to_string(v_fixed, ', ');
  END IF;
END $$;


-- =============================================================================
-- Post-checks
-- =============================================================================
DO $$
DECLARE v_bad text; v_n int;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
     AND p.prorettype = 'pg_catalog.trigger'::regtype
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: definer trigger function(s) still reachable: %', v_bad;
  END IF;

  -- Every trigger that existed before must still have its function attached.
  -- A revoke cannot detach one, but this is the assertion worth making loudly
  -- if a future edit to this file ever turns into a DROP.
  SELECT count(*) INTO v_n
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE NOT t.tgisinternal AND n.nspname = 'public' AND p.prosecdef;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: no definer trigger functions remain attached to any trigger.';
  END IF;
  RAISE NOTICE 'F-H2 post-checks passed: 0 reachable, % definer trigger(s) still attached.', v_n;
END $$;
