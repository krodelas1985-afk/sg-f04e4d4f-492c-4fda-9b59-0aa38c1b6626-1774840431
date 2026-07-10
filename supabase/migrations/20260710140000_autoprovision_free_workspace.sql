-- Phase B2: auto-provision a free workspace when a user submits onboarding.
--
-- Public self-serve signup means no BaMo admin approval step. The moment a user
-- finishes the onboarding wizard (status -> 'submitted'), we create their client
-- workspace on the 'free' plan, link their profile to it, and mark the onboarding
-- 'approved'. Feature access (Campaign Engine, ads, etc.) is gated later by plan.
--
-- RLS note: the user's own_update policy WITH CHECK only permits status in
-- ('in_progress','submitted') — a client can submit but cannot self-approve. So
-- provisioning must run in a SECURITY DEFINER trigger. This is an AFTER trigger:
-- the user's write to 'submitted' passes WITH CHECK and commits; the trigger's
-- own privileged UPDATE to 'approved' bypasses RLS (runs as function owner). An
-- equivalent BEFORE trigger would fail because rewriting status to 'approved'
-- would then be rejected by the user's WITH CHECK.

-- 1. Freemium tier column. Existing pilot clients default to 'free'; billing isn't
--    built yet, so Kathy can bump specific clients later. No restrictive CHECK —
--    the tier vocabulary (starter/pro/business/…) is still being decided.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

COMMENT ON COLUMN public.clients.plan IS
  'Freemium subscription tier. Default free; paid tiers unlock Campaign Engine, ads, etc. Vocabulary TBD.';

-- 2. Provisioning trigger function.
CREATE OR REPLACE FUNCTION public.provision_workspace_on_submit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id       uuid;
  v_existing_client uuid;
  v_name            text;
BEGIN
  IF NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotency: if this profile already belongs to a workspace (e.g. an
  -- admin-provisioned client, or a resubmit), just link + approve — never create
  -- a second client.
  SELECT client_id INTO v_existing_client FROM public.profiles WHERE id = NEW.profile_id;
  IF v_existing_client IS NOT NULL THEN
    UPDATE public.client_onboarding
      SET client_id = v_existing_client, status = 'approved', reviewed_at = now()
      WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  v_name := COALESCE(
    NULLIF(btrim(NEW.company_name), ''),
    NULLIF(btrim(NEW.full_name), ''),
    'My Workspace'
  );

  INSERT INTO public.clients (name, company_name, email, phone, business_type, plan, is_active)
  VALUES (v_name, NEW.company_name, NEW.email, NEW.phone, NEW.business_type, 'free', true)
  RETURNING id INTO v_client_id;

  UPDATE public.profiles SET client_id = v_client_id WHERE id = NEW.profile_id;

  UPDATE public.client_onboarding
    SET client_id = v_client_id, status = 'approved', reviewed_at = now()
    WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

-- 3. Fire only on the in_progress -> submitted transition. The trigger's internal
--    UPDATE sets status='approved', so the WHEN guard prevents re-entry.
DROP TRIGGER IF EXISTS client_onboarding_autoprovision ON public.client_onboarding;
CREATE TRIGGER client_onboarding_autoprovision
  AFTER UPDATE ON public.client_onboarding
  FOR EACH ROW
  WHEN (NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted')
  EXECUTE FUNCTION public.provision_workspace_on_submit();
