-- Tally onboarding auto-provisioning.
--
-- Context: `provision_workspace_on_submit()` (trigger `client_onboarding_autoprovision`,
-- AFTER UPDATE) already provisions a workspace for the MOBILE-APP flow, but it returns
-- early when `profile_id IS NULL` -- i.e. it never handled Tally submissions, which have
-- no auth user. This adds a Tally-only path that also notifies BaMo admins.
--
-- Scope decisions (confirmed with product owner 2026-07-13):
--   * Tally submissions only (source = 'tally'). Mobile-app behaviour is left untouched.
--   * Creates the client WORKSPACE only -- no auth login / invite is created here.
--     Admin provisions the client's login after FB page access + Drive folder setup.
--   * Notifies every baymo_admin in-app (push-dispatch pipeline delivers to device).
--
-- The two triggers partition cleanly and cannot double-provision:
--   * mobile_app rows        -> guarded out here (source check); handled by the existing fn.
--   * tally rows (INSERT)    -> existing fn is AFTER UPDATE only, so only this one fires.
--   * tally rows (UPDATE)    -> this BEFORE trigger sets status='approved', so the existing
--                               AFTER-UPDATE trigger's WHEN (new.status='submitted') is false.

CREATE OR REPLACE FUNCTION public.auto_provision_client_from_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_name      text;
BEGIN
  -- Only Tally submissions, only on entering 'submitted', only once.
  IF NEW.source IS DISTINCT FROM 'tally' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'submitted' THEN RETURN NEW; END IF;
  IF NEW.client_id IS NOT NULL THEN RETURN NEW; END IF;

  v_name := COALESCE(
    NULLIF(btrim(NEW.full_name), ''),
    NULLIF(btrim(NEW.company_name), ''),
    NEW.email,
    'New Client'
  );

  -- Reuse an existing workspace with the same email (idempotent on resubmission).
  IF NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE lower(email) = lower(btrim(NEW.email))
    LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO clients (name, company_name, email, phone, business_type)
    VALUES (
      v_name,
      NULLIF(btrim(NEW.company_name), ''),
      NULLIF(btrim(NEW.email), ''),
      NULLIF(btrim(NEW.phone), ''),
      NEW.business_type
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- Link + approve on the same row (BEFORE trigger: mutate NEW, no re-fire).
  NEW.client_id   := v_client_id;
  NEW.status      := 'approved';
  NEW.reviewed_at := now();

  -- Notify every BaMo admin.
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT p.id,
         'client_onboarded',
         'New client onboarded: ' || v_name,
         concat_ws(' · ',
           NULLIF(btrim(NEW.company_name), ''),
           NULLIF(btrim(NEW.email), ''),
           NULLIF(btrim(NEW.phone), '')
         ),
         jsonb_build_object(
           'onboarding_id', NEW.id,
           'client_id',     v_client_id,
           'source',        NEW.source
         )
  FROM profiles p
  WHERE p.role = 'baymo_admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_provision_client ON public.client_onboarding;
CREATE TRIGGER trg_auto_provision_client
BEFORE INSERT OR UPDATE OF status ON public.client_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.auto_provision_client_from_onboarding();
