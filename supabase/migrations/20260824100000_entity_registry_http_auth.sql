-- Track B item 6 - HTTP interface authentication for the canonical entity registry.
--
-- Identity Standard 53.1 obliges the CRM to expose the registry to Network and
-- Marketplace; 52 governs how. This migration builds the 52 half in the
-- database, so that the Edge Function (`bamo-entity-registry`) never decides
-- authorisation on its own and never holds a caller token:
--
--   1. service token    -> per-caller secret in Vault, named by
--                          bamo_registry_callers.vault_secret_name
--   2. caller allowlist -> bamo_registry_callers, checked before any body parse
--   3. replay protection-> HMAC-SHA256 over {ts}.{nonce}.{body} inside a
--                          freshness window, plus a nonce ledger that makes a
--                          second use of a nonce a primary-key collision
--
-- All three are enforced by verify_bamo_registry_request(). The secret is read
-- from Vault inside Postgres and never leaves it - the same shape as
-- check_push_dispatch_secret(), and for the same reason that function exists:
-- a production service_role JWT already sat public on GitHub once (2026-06-12),
-- so credentials stay on the database side of the wire.
--
-- Rotation is a Vault update; adding or disabling a caller is one UPDATE.
-- Both are data changes, not deploys, as 52 requires.
--
-- Applied with apply_migration, which supplies the transaction (CRM migrations
-- carry no BEGIN/COMMIT of their own). The CRM has no CI: merging this file is
-- version control only, applying it is a separate, deliberate step.

-- ---------------------------------------------------------------------------
-- 1. Caller allowlist  (52 control 2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bamo_registry_callers (
  caller             text PRIMARY KEY
                     CHECK (caller ~ '^[a-z][a-z0-9_]{1,31}$'),
  vault_secret_name  text NOT NULL UNIQUE,
  is_active          boolean NOT NULL DEFAULT false,
  description        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bamo_registry_callers IS
  'Identity Standard 52 control 2: the only caller identities the entity-registry HTTP interface accepts. is_active=false disables a caller without deleting its history or its Vault secret.';

-- The four caller identities 52 names. A row is activated in the same change
-- that mints its token: an active row with no Vault secret would fail every
-- request as `missing_secret` rather than `unknown_caller`, which tells an
-- unauthenticated caller more than it should.
INSERT INTO public.bamo_registry_callers (caller, vault_secret_name, is_active, description) VALUES
  ('network',     'registry_token_network',     false, 'BaMo Network - organization flows (Identity Standard 53.1)'),
  ('marketplace', 'registry_token_marketplace', false, 'BaMo Marketplace - developer/brokerage correlation, from Phase 6'),
  ('crm',         'registry_token_crm',         false, 'CRM server-side callers outside this project'),
  ('admin',       'registry_token_admin',       false, 'Operator tooling / break-glass')
ON CONFLICT (caller) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Nonce ledger  (52 control 3)
-- ---------------------------------------------------------------------------
-- A nonce is single-use per caller. The PRIMARY KEY *is* the replay check:
-- concurrent duplicates collide in the index rather than racing a SELECT.
CREATE TABLE IF NOT EXISTS public.bamo_registry_nonces (
  caller   text NOT NULL,
  nonce    text NOT NULL,
  seen_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (caller, nonce)
);

CREATE INDEX IF NOT EXISTS bamo_registry_nonces_seen_at_idx
  ON public.bamo_registry_nonces (seen_at);

COMMENT ON TABLE public.bamo_registry_nonces IS
  'Single-use nonces for the entity-registry HTTP interface. Retained far longer than the freshness window so a replay inside the window always collides; pruned opportunistically by verify_bamo_registry_request().';

-- ---------------------------------------------------------------------------
-- 3. Authentication log
--    (52: rejected requests must be logged with the presented caller identity)
-- ---------------------------------------------------------------------------
-- Bucketed per minute rather than one row per attempt. The endpoint is
-- internet-reachable by design (verify_jwt=false), so a per-attempt log is a
-- free write amplifier for anyone who finds the URL. `presented_caller` is
-- attacker-controlled, so the verifier normalises anything that is not a
-- well-formed caller id to the single literal '(malformed)' - that bounds the
-- table to (allowlisted callers + 1) x outcomes x operations x minutes.
CREATE TABLE IF NOT EXISTS public.bamo_registry_auth_log (
  presented_caller  text        NOT NULL,
  outcome           text        NOT NULL,
  operation         text        NOT NULL,
  minute_bucket     timestamptz NOT NULL,
  occurrences       integer     NOT NULL DEFAULT 1,
  first_seen_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (presented_caller, outcome, operation, minute_bucket)
);

CREATE INDEX IF NOT EXISTS bamo_registry_auth_log_bucket_idx
  ON public.bamo_registry_auth_log (minute_bucket DESC);

COMMENT ON TABLE public.bamo_registry_auth_log IS
  'Per-minute counts of entity-registry HTTP authentication outcomes, accepted and rejected alike, keyed by the caller identity the request presented.';

-- ---------------------------------------------------------------------------
-- 4. Privileges
-- ---------------------------------------------------------------------------
-- The CRM `public` schema grants anon/authenticated on new tables BY DEFAULT.
-- A precise GRANT does not undo that; only an explicit REVOKE does. The
-- post-check below fails the migration if one is ever missed.
REVOKE ALL ON public.bamo_registry_callers  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.bamo_registry_nonces   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.bamo_registry_auth_log FROM PUBLIC, anon, authenticated;

-- No grant to service_role either: nothing outside the SECURITY DEFINER
-- verifier has business reading the allowlist or the ledger over PostgREST.
-- Operators read these tables from a direct SQL session.

ALTER TABLE public.bamo_registry_callers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bamo_registry_nonces   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bamo_registry_auth_log ENABLE ROW LEVEL SECURITY;
-- Deliberately zero policies: fail-closed. The definer function runs as the
-- table owner and is unaffected.

-- ---------------------------------------------------------------------------
-- 5. The verifier
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_bamo_registry_request(
  p_caller     text,
  p_timestamp  text,
  p_nonce      text,
  p_body       text,
  p_signature  text,
  p_operation  text DEFAULT NULL
)
RETURNS TABLE (authorized boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  -- Freshness window. 300s tolerates ordinary clock drift between two managed
  -- platforms without widening the replay surface beyond the nonce retention.
  c_window_seconds  constant integer  := 300;
  c_nonce_retention constant interval := interval '1 hour';   -- >> the window
  c_log_retention   constant interval := interval '90 days';
  c_max_body_bytes  constant integer  := 16384;

  v_caller      text;
  v_operation   text := left(coalesce(nullif(btrim(coalesce(p_operation, '')), ''), '(none)'), 32);
  v_secret_name text;
  v_secret      text;
  v_ts          bigint;
  v_expected    text;
  v_presented   text := lower(btrim(coalesce(p_signature, '')));
  v_compare_key text;
  v_reason      text;
BEGIN
  -- (2) Caller allowlist FIRST. 52: unknown callers are rejected before any
  -- body parsing - the Edge Function likewise holds the body as opaque text
  -- until this function says yes.
  v_caller := lower(btrim(coalesce(p_caller, '')));
  IF v_caller !~ '^[a-z][a-z0-9_]{1,31}$' THEN
    v_caller := '(malformed)';
    v_reason := 'unknown_caller';
  ELSE
    SELECT c.vault_secret_name INTO v_secret_name
      FROM public.bamo_registry_callers AS c
     WHERE c.caller = v_caller AND c.is_active;
    IF NOT FOUND THEN
      v_reason := 'unknown_caller';
    END IF;
  END IF;

  -- (3a) Nonce shape. Bounded before it can be stored.
  IF v_reason IS NULL AND coalesce(p_nonce, '') !~ '^[A-Za-z0-9_-]{16,128}$' THEN
    v_reason := 'bad_nonce';
  END IF;

  -- (3b) Freshness window.
  IF v_reason IS NULL THEN
    IF coalesce(p_timestamp, '') !~ '^[0-9]{1,12}$' THEN
      v_reason := 'bad_timestamp';
    ELSE
      v_ts := p_timestamp::bigint;
      IF abs(extract(epoch FROM clock_timestamp())::bigint - v_ts) > c_window_seconds THEN
        v_reason := 'stale_timestamp';
      END IF;
    END IF;
  END IF;

  IF v_reason IS NULL AND (p_body IS NULL OR octet_length(p_body) > c_max_body_bytes) THEN
    v_reason := 'bad_body';
  END IF;

  -- (1) Service token, read from Vault at call time so rotation needs no
  -- redeploy of either side.
  IF v_reason IS NULL THEN
    SELECT s.decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets AS s
     WHERE s.name = v_secret_name;
    IF v_secret IS NULL OR btrim(v_secret) = '' THEN
      v_reason := 'missing_secret';
    END IF;
  END IF;

  -- (3c) Signature over exactly {ts}.{nonce}.{body} - the raw body bytes as
  -- sent, never a re-serialised parse of them.
  IF v_reason IS NULL THEN
    v_expected := encode(
      extensions.hmac(p_timestamp || '.' || p_nonce || '.' || p_body, v_secret, 'sha256'),
      'hex'
    );
    -- Double-HMAC compare: `=` on text short-circuits, so compare digests taken
    -- under a key the caller cannot predict. Two extra HMACs, no timing signal.
    v_compare_key := encode(extensions.gen_random_bytes(32), 'hex');
    IF extensions.hmac(v_expected,  v_compare_key, 'sha256')
       IS DISTINCT FROM
       extensions.hmac(v_presented, v_compare_key, 'sha256') THEN
      v_reason := 'bad_signature';
    END IF;
  END IF;

  -- (3d) Single use. The insert IS the check.
  IF v_reason IS NULL THEN
    BEGIN
      INSERT INTO public.bamo_registry_nonces (caller, nonce) VALUES (v_caller, p_nonce);
    EXCEPTION WHEN unique_violation THEN
      v_reason := 'replayed_nonce';
    END;
  END IF;

  -- Housekeeping. Both prunes are index-driven and bounded.
  DELETE FROM public.bamo_registry_nonces
   WHERE seen_at < clock_timestamp() - c_nonce_retention;
  DELETE FROM public.bamo_registry_auth_log
   WHERE minute_bucket < clock_timestamp() - c_log_retention;

  INSERT INTO public.bamo_registry_auth_log AS l
    (presented_caller, outcome, operation, minute_bucket, occurrences, first_seen_at, last_seen_at)
  VALUES
    (v_caller, coalesce(v_reason, 'accepted'), v_operation,
     date_trunc('minute', clock_timestamp()), 1, clock_timestamp(), clock_timestamp())
  ON CONFLICT (presented_caller, outcome, operation, minute_bucket) DO UPDATE
    SET occurrences  = l.occurrences + 1,
        last_seen_at = excluded.last_seen_at;

  RETURN QUERY SELECT (v_reason IS NULL), coalesce(v_reason, 'accepted');
END;
$fn$;

COMMENT ON FUNCTION public.verify_bamo_registry_request(text, text, text, text, text, text) IS
  'Identity Standard 52 in full for the entity-registry HTTP interface: caller allowlist, Vault-held per-caller token, HMAC-SHA256 over {ts}.{nonce}.{body} inside a 300s window, single-use nonce ledger. The returned reason is for the server-side log only - the Edge Function answers a generic 401.';

REVOKE ALL ON FUNCTION public.verify_bamo_registry_request(text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_bamo_registry_request(text, text, text, text, text, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Post-checks - these fail the migration, they do not warn.
-- ---------------------------------------------------------------------------
DO $post$
DECLARE
  v_tables constant text[] := ARRAY[
    'bamo_registry_callers', 'bamo_registry_nonces', 'bamo_registry_auth_log'
  ];
  v_n integer;
  v_t text;
BEGIN
  -- (a) every new table exists, has RLS on, and has zero policies
  FOREACH v_t IN ARRAY v_tables LOOP
    SELECT count(*) INTO v_n
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_t AND c.relrowsecurity;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'post-check: public.% missing or RLS not enabled', v_t;
    END IF;

    SELECT count(*) INTO v_n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = v_t;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'post-check: public.% must have zero policies (fail-closed), found %', v_t, v_n;
    END IF;
  END LOOP;

  -- (b) the CRM default-grant trap: no anon/authenticated privilege anywhere
  SELECT count(*) INTO v_n
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name = ANY (v_tables)
     AND grantee IN ('anon', 'authenticated', 'PUBLIC');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'post-check: % anon/authenticated/PUBLIC grants remain on the registry auth tables', v_n;
  END IF;

  -- (c) the verifier is definer, pinned search_path, and not anon-executable
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'verify_bamo_registry_request'
     AND p.prosecdef
     -- SET search_path TO '' is stored as the literal `search_path=""`, not
     -- `search_path=` - an @> ARRAY['search_path='] test silently never matches.
     AND p.proconfig @> ARRAY['search_path=""'];
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'post-check: verify_bamo_registry_request must be SECURITY DEFINER with an empty search_path';
  END IF;

  IF has_function_privilege('anon', 'public.verify_bamo_registry_request(text,text,text,text,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.verify_bamo_registry_request(text,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'post-check: verify_bamo_registry_request is executable by anon/authenticated';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.verify_bamo_registry_request(text,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'post-check: service_role cannot execute verify_bamo_registry_request';
  END IF;

  -- (d) the three registry functions the interface fronts are still definer
  --     functions with a pinned search_path, and still not anon-reachable
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('search_bamo_entities', 'resolve_bamo_entity', 'request_bamo_entity')
     AND p.prosecdef
     AND p.proconfig @> ARRAY['search_path=""'];
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'post-check: expected 3 definer registry functions with pinned search_path, found %', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('search_bamo_entities', 'resolve_bamo_entity', 'request_bamo_entity')
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'post-check: % registry function(s) are anon/authenticated-executable', v_n;
  END IF;

  -- (e) 33: canonical_name must never acquire a unique constraint
  SELECT count(*) INTO v_n
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
   WHERE c.relname = 'bamo_entity_registry' AND i.indisunique AND a.attname = 'canonical_name';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'post-check: canonical_name must not be unique (Identity Standard 33)';
  END IF;

  -- (f) the allowlist is seeded, and nothing is active without a Vault secret
  SELECT count(*) INTO v_n FROM public.bamo_registry_callers;
  IF v_n < 4 THEN
    RAISE EXCEPTION 'post-check: expected the 4 caller identities, found %', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.bamo_registry_callers c
   WHERE c.is_active
     AND NOT EXISTS (SELECT 1 FROM vault.secrets s WHERE s.name = c.vault_secret_name);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'post-check: % active caller(s) have no Vault secret', v_n;
  END IF;
END;
$post$;
