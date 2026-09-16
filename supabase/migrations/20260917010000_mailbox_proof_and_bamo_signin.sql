-- Sign in with BaMo, CRM side (plan: bamo-ops/BaMo_Sign_In_With_BaMo_Plan.md;
-- Identity Standard v1.5 §56).
--
-- 1. MAILBOX PROOF (§56.4(1), plan R2). The CRM may tell another product "this
--    email is verified" only when the account holder has personally clicked an
--    emailed link. auth.users.email_confirmed_at cannot carry that meaning here:
--    BaMo creates client accounts with the email pre-confirmed, so for the
--    founding clients it records an admin's action, not the person's.
--
--    profiles.mailbox_proven_at / mailbox_proven_email are written ONLY by
--    record_mailbox_proof(), which the /api/auth/verify-link route calls after it
--    has verified the link's token server-side. A guard trigger refuses every
--    change made with a signed-in JWT - including the owner's and a baymo_admin's
--    - so no screen can ever set it by hand. The proven email is stored, so the
--    proof lapses by itself if the account's email is later changed.
--
-- 2. CONSENT ELIGIBILITY (plan R1). bamo_signin_eligibility() answers "may this
--    person sign in to another BaMo product?" for the /oauth/consent page.
--
-- 3. DIRECTORY BY SUBJECT (plan R4). The Marketplace receives the CRM user id as
--    the OIDC subject. account_directory_get_by_subject() turns it into the
--    bamo_account_id - and re-states mailbox proof, so the Marketplace can enforce
--    R1 on its own server even if someone bypassed the consent page.
--
-- Applied with apply_migration (no BEGIN/COMMIT). The CRM has no CI.

-- ---------------------------------------------------------------------------
-- 1. Columns + guard
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mailbox_proven_at    timestamptz,
  ADD COLUMN IF NOT EXISTS mailbox_proven_email text;

COMMENT ON COLUMN public.profiles.mailbox_proven_at IS
  'When the account holder last proved control of their mailbox by clicking an emailed BaMo link (Identity Standard §56.4(1)). Set only by record_mailbox_proof(); never by an admin.';
COMMENT ON COLUMN public.profiles.mailbox_proven_email IS
  'The address that was proven (lower-case). Proof counts only while it equals the account''s current email.';

CREATE OR REPLACE FUNCTION public.guard_mailbox_proof()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  -- Service role / internal jobs have no JWT user; record_mailbox_proof() runs
  -- that way. Every signed-in caller - owner, client_admin, baymo_admin - is
  -- refused, which is the point.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.mailbox_proven_at IS NOT NULL OR NEW.mailbox_proven_email IS NOT NULL THEN
      RAISE EXCEPTION 'Mailbox proof can only be recorded by clicking an emailed link';
    END IF;
  ELSIF NEW.mailbox_proven_at IS DISTINCT FROM OLD.mailbox_proven_at
     OR NEW.mailbox_proven_email IS DISTINCT FROM OLD.mailbox_proven_email THEN
    RAISE EXCEPTION 'Mailbox proof can only be recorded by clicking an emailed link';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_mailbox_proof() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_mailbox_proof ON public.profiles;
CREATE TRIGGER trg_guard_mailbox_proof
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_mailbox_proof();

-- ---------------------------------------------------------------------------
-- 2. Recording proof
-- ---------------------------------------------------------------------------
-- Called by /api/auth/verify-link AFTER a server-side verifyOtp succeeded for
-- this user. Records only when the email passed is the account's current email,
-- so a stale link for an old address proves nothing.
CREATE OR REPLACE FUNCTION public.record_mailbox_proof(p_user_id uuid, p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_current text;
BEGIN
  SELECT lower(u.email) INTO v_current FROM auth.users AS u WHERE u.id = p_user_id;
  IF v_current IS NULL OR v_current <> lower(btrim(coalesce(p_email, ''))) THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
     SET mailbox_proven_at = now(),
         mailbox_proven_email = v_current
   WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_mailbox_proof(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_mailbox_proof(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. May this person sign in to another BaMo product?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bamo_signin_eligibility(p_user_id uuid)
RETURNS TABLE (has_profile boolean, is_active boolean, mailbox_proven boolean, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT (p.id IS NOT NULL),
         coalesce(p.is_active, false),
         (p.mailbox_proven_at IS NOT NULL
          AND p.mailbox_proven_email IS NOT NULL
          AND p.mailbox_proven_email = lower(u.email)),
         u.email::text
    FROM auth.users AS u
    LEFT JOIN public.profiles AS p ON p.id = u.id
   WHERE u.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.bamo_signin_eligibility(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bamo_signin_eligibility(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Directory lookup by OIDC subject (the CRM user id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_directory_get_by_subject(p_crm_user_id uuid)
RETURNS TABLE (
  bamo_account_id uuid,
  email           text,
  full_name       text,
  role            text,
  is_active       boolean,
  mailbox_proven  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p.bamo_account_id,
         u.email::text,
         p.full_name::text,
         p.role::text,
         p.is_active,
         (p.mailbox_proven_at IS NOT NULL
          AND p.mailbox_proven_email = lower(u.email))
    FROM public.profiles AS p
    JOIN auth.users AS u ON u.id = p.id
   WHERE p.id = p_crm_user_id
     AND p.bamo_account_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.account_directory_get_by_subject(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_directory_get_by_subject(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Post-checks - these fail the migration, they do not warn.
-- ---------------------------------------------------------------------------
DO $post$
DECLARE
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.record_mailbox_proof(uuid,text)',
    'public.bamo_signin_eligibility(uuid)',
    'public.account_directory_get_by_subject(uuid)'
  ] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'post-check: % is executable by anon/authenticated', v_fn;
    END IF;
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'post-check: service_role cannot execute %', v_fn;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.profiles'::regclass
                    AND tgname = 'trg_guard_mailbox_proof') THEN
    RAISE EXCEPTION 'post-check: trg_guard_mailbox_proof is missing';
  END IF;

  -- Nobody is proven by this migration. The founding clients' pre-confirmed
  -- emails must not count (§56.4(1)).
  IF EXISTS (SELECT 1 FROM public.profiles WHERE mailbox_proven_at IS NOT NULL) THEN
    RAISE EXCEPTION 'post-check: a profile came out of this migration already proven';
  END IF;
END;
$post$;
