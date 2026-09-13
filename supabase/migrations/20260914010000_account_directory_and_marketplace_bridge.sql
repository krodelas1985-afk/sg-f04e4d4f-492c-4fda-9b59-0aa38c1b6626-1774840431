-- Identity Standard v1.4 (2026-09-13) - the CRM's two pieces of agent setup and
-- the mobile app's Marketplace listings.
--
-- 1. ACCOUNT DIRECTORY (§17.4). When a Marketplace curator sets up a BaMo client,
--    the person's email, name and bamo_account_id must come from the CRM through
--    a §52-authenticated lookup - never typed or pasted. The
--    `bamo-account-directory` Edge Function fronts the two functions below with
--    the same verify_bamo_registry_request() the entity registry and the KB
--    catalog use (caller `marketplace`, already active).
--
--    What is shared is fixed HERE, not in TypeScript: BaMo professionals only
--    (client_admin, agent), and nothing a curator does not need to create an
--    account and a profile. No phone, WhatsApp, avatar, or client_id - the
--    Marketplace keeps raw CRM ids out of its schema entirely.
--
-- 2. BRIDGE SIGNER (§57). The mobile app's Listings tab asks the CRM, and the
--    CRM's `marketplace-listings` Edge Function asks the Marketplace's
--    `crm-bridge` for that person's listings over a §52-signed request. The
--    token (`marketplace_bridge_token`) is held in THIS project's Vault and the
--    HMAC is computed in Postgres, so the secret never leaves the database - the
--    same reason verify_bamo_registry_request() reads its tokens in-database.
--    The token does not exist yet; minting it is a deliberate post-deploy step,
--    and until then the function raises and the app says the bridge is not
--    configured.
--
-- Applied with apply_migration (CRM migrations carry no BEGIN/COMMIT). The CRM
-- has no CI: merging this file is version control, applying it is a separate
-- step.

-- ---------------------------------------------------------------------------
-- 1. Directory
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_directory_list()
RETURNS TABLE (
  bamo_account_id   uuid,
  full_name         text,
  email             text,
  role              text,
  client_name       text,
  prc_number        text,
  company           text,
  service_area      text,
  location_city     text,
  location_province text,
  is_active         boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  -- The login email (auth.users) is the one the Marketplace account is created
  -- under; profiles.email is only a fallback.
  SELECT p.bamo_account_id,
         p.full_name::text,
         coalesce(u.email::text, p.email::text),
         p.role::text,
         c.name::text,
         p.prc_number::text,
         p.company::text,
         p.service_area::text,
         p.location_city::text,
         p.location_province::text,
         p.is_active
    FROM public.profiles AS p
    LEFT JOIN auth.users   AS u ON u.id = p.id
    LEFT JOIN public.clients AS c ON c.id = p.client_id
   WHERE p.role IN ('client_admin', 'agent')
     AND p.bamo_account_id IS NOT NULL
     AND p.is_active
   ORDER BY c.name NULLS LAST, p.full_name;
$$;

COMMENT ON FUNCTION public.account_directory_list() IS
  'Identity Standard §17.4: active BaMo professionals for Marketplace agent setup, via bamo-account-directory. Service role only; the shape of what is shared is fixed here.';

-- One person, active or not, so the caller can say "inactive" rather than "not found".
CREATE OR REPLACE FUNCTION public.account_directory_get(p_bamo_account_id uuid)
RETURNS TABLE (
  bamo_account_id   uuid,
  full_name         text,
  email             text,
  role              text,
  client_name       text,
  prc_number        text,
  company           text,
  service_area      text,
  location_city     text,
  location_province text,
  is_active         boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p.bamo_account_id,
         p.full_name::text,
         coalesce(u.email::text, p.email::text),
         p.role::text,
         c.name::text,
         p.prc_number::text,
         p.company::text,
         p.service_area::text,
         p.location_city::text,
         p.location_province::text,
         p.is_active
    FROM public.profiles AS p
    LEFT JOIN auth.users   AS u ON u.id = p.id
    LEFT JOIN public.clients AS c ON c.id = p.client_id
   WHERE p.bamo_account_id = p_bamo_account_id
     AND p.role IN ('client_admin', 'agent');
$$;

COMMENT ON FUNCTION public.account_directory_get(uuid) IS
  'Identity Standard §17.4: one BaMo professional by bamo_account_id, re-read at the moment of Marketplace setup. Service role only.';

REVOKE ALL ON FUNCTION public.account_directory_list()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.account_directory_get(uuid)  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_directory_list()    TO service_role;
GRANT EXECUTE ON FUNCTION public.account_directory_get(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Bridge signer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sign_marketplace_bridge_request(
  p_timestamp text,
  p_nonce     text,
  p_body      text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_secret text;
BEGIN
  -- The same bounds the Marketplace verifier enforces, so a request this signs
  -- is never refused over its shape.
  IF coalesce(p_timestamp, '') !~ '^[0-9]{1,12}$'
     OR coalesce(p_nonce, '') !~ '^[A-Za-z0-9_-]{16,128}$'
     OR p_body IS NULL
     OR octet_length(p_body) > 16384 THEN
    RAISE EXCEPTION 'malformed bridge request' USING ERRCODE = '22023';
  END IF;

  SELECT s.decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets AS s
   WHERE s.name = 'marketplace_bridge_token';

  IF v_secret IS NULL OR btrim(v_secret) = '' THEN
    RAISE EXCEPTION 'marketplace_bridge_token is not in Vault' USING ERRCODE = 'P0001';
  END IF;

  RETURN encode(
    extensions.hmac(p_timestamp || '.' || p_nonce || '.' || p_body, v_secret, 'sha256'),
    'hex'
  );
END;
$$;

COMMENT ON FUNCTION public.sign_marketplace_bridge_request(text, text, text) IS
  'Identity Standard §52/§57: HMAC-SHA256 over {ts}.{nonce}.{body} with the Vault-held marketplace_bridge_token, for the marketplace-listings Edge Function. The token never leaves the database. Service role only.';

REVOKE ALL ON FUNCTION public.sign_marketplace_bridge_request(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_marketplace_bridge_request(text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Post-checks - these fail the migration, they do not warn.
-- ---------------------------------------------------------------------------
DO $post$
DECLARE
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.account_directory_list()',
    'public.account_directory_get(uuid)',
    'public.sign_marketplace_bridge_request(text,text,text)'
  ] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'post-check: % is executable by anon/authenticated', v_fn;
    END IF;
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'post-check: service_role cannot execute %', v_fn;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('account_directory_list', 'account_directory_get', 'sign_marketplace_bridge_request')
         AND p.prosecdef
         AND p.proconfig @> ARRAY['search_path=""']) <> 3 THEN
    RAISE EXCEPTION 'post-check: expected 3 SECURITY DEFINER functions with an empty search_path';
  END IF;
END;
$post$;
