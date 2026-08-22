-- =============================================================================
-- Track B item 5 — mint bamo_account_id for the CRM's accounts
-- =============================================================================
--
-- Identity Standard §12–§16, §55.1. `public.profiles` is the CRM's product
-- account table: its `id` IS the `auth.users` id, so §14's "unique index on
-- auth_user_id" is already satisfied by the primary key.
--
-- Done now, while there are nine rows and no cross-product links exist at all,
-- because the alternative is reconciling identities by email later — which
-- Rule 9 forbids outright (an email collision must never auto-link accounts).
--
-- THREE RULES THIS MIGRATION IS BOUND BY:
--
-- 1. `bamo_account_id` IS A CORRELATION ID, NEVER AN AUTHORIZATION KEY
--    (Rule 11 / §8). No policy here references it, and none ever may. The
--    Marketplace standards linter has a dedicated check (L3) for exactly this;
--    the CRM has no equivalent, so it is a review responsibility on this side.
--
-- 2. A SUPPLIED VALUE IS PASSED THROUGH, NEVER REPLACED (§15). When another
--    product provisions an account here it sends its own minted id. The trigger
--    below only fills a NULL — overwriting would fork one BaMo identity into
--    two, which is the precise failure §32 exists to prevent for entities.
--
-- 3. IDs ARE PERMANENTLY RETIRED ONCE ISSUED (§55.3). A closed account's id is
--    never reassigned. Nothing here deletes or recycles one.
--
-- origin_product = 'admin', not 'crm' (§55.1). All nine existing profiles were
-- created by BaMo staff through administrative provisioning. §55.1 reserves
-- 'crm' for accounts that originated through a CRM-side self-service flow —
-- the distinction is deliberate, because 'admin' marks BaMo-managed client
-- accounts with different support, billing and lifecycle expectations.
-- ⚠️ The parked self-serve signup path must pass 'crm' explicitly when it ships.
-- =============================================================================


-- =============================================================================
-- SECTION 1 - Columns
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bamo_account_id uuid,
  ADD COLUMN IF NOT EXISTS origin_product  text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.profiles'::regclass
       AND conname = 'profiles_origin_product_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_origin_product_chk
      CHECK (origin_product IS NULL
             OR origin_product IN ('crm', 'marketplace', 'network', 'admin'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.bamo_account_id IS
  'Cross-product correlation ID (Identity Standard §7). NEVER an authorization key - authorization is always by local auth.uid(). Permanently retired once issued (§55.3).';
COMMENT ON COLUMN public.profiles.origin_product IS
  'Where the BaMo account originated: crm | marketplace | network | admin. Audit metadata only - never authorization proof (§16). ''admin'' means BaMo staff provisioned it (§55.1).';

-- §13: one BaMo account may map to at most one profile here, while unlimited
-- NULLs remain allowed for rows not yet minted.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_bamo_account_id_key
  ON public.profiles (bamo_account_id)
  WHERE bamo_account_id IS NOT NULL;


-- =============================================================================
-- SECTION 2 - Mint for the existing accounts
-- =============================================================================
UPDATE public.profiles
   SET bamo_account_id = gen_random_uuid(),
       origin_product  = coalesce(origin_product, 'admin')
 WHERE bamo_account_id IS NULL;


-- =============================================================================
-- SECTION 3 - Keep it filled going forward
-- =============================================================================
-- Without this, every profile created after today drifts back to NULL and the
-- backfill has to be repeated. Fills only when absent, so a provisioning call
-- carrying an id from another product keeps it (§15).
CREATE OR REPLACE FUNCTION public.mint_bamo_account_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.bamo_account_id IS NULL THEN
    NEW.bamo_account_id := gen_random_uuid();
  END IF;

  -- Every account created here today is BaMo-provisioned. When self-serve
  -- signup ships it must set 'crm' itself rather than inheriting this.
  IF NEW.origin_product IS NULL THEN
    NEW.origin_product := 'admin';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions are never reachable by an application role (the F-H2
-- finding closed on 2026-08-19 was exactly this class).
REVOKE ALL ON FUNCTION public.mint_bamo_account_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mint_bamo_account_id ON public.profiles;
CREATE TRIGGER trg_mint_bamo_account_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.mint_bamo_account_id();


-- =============================================================================
-- SECTION 4 - Post-checks
-- =============================================================================
DO $$
DECLARE v_n int; v_null int; v_dupes int; v_bad text;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE bamo_account_id IS NULL)
    INTO v_n, v_null FROM public.profiles;
  IF v_null > 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: % of % profiles still have no bamo_account_id.', v_null, v_n;
  END IF;

  SELECT count(*) INTO v_dupes FROM (
    SELECT bamo_account_id FROM public.profiles
     WHERE bamo_account_id IS NOT NULL
     GROUP BY bamo_account_id HAVING count(*) > 1) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: % duplicated bamo_account_id value(s).', v_dupes;
  END IF;

  SELECT count(*) INTO v_null FROM public.profiles WHERE origin_product IS NULL;
  IF v_null > 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: % profiles have no origin_product.', v_null;
  END IF;

  -- Rule 11: the correlation ID must not appear in any authorization predicate.
  SELECT string_agg(schemaname || '.' || tablename || ' / ' || policyname, ', ') INTO v_bad
    FROM pg_policies
   WHERE (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ILIKE '%bamo_account_id%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: bamo_account_id used in policy predicate(s): %', v_bad;
  END IF;

  IF has_function_privilege('anon', 'public.mint_bamo_account_id()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.mint_bamo_account_id()', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: the minting trigger function is reachable by an application role.';
  END IF;

  RAISE NOTICE 'Track B item 5 post-checks passed: % profiles carry a unique bamo_account_id.', v_n;
END $$;
