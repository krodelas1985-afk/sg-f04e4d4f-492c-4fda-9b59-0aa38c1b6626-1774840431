-- =============================================================================
-- Track B item 6 — the canonical BaMo entity registry
-- =============================================================================
--
-- Identity Standard §31–§35 and §53. This is a **CRM-side deliverable that BaMo
-- Network depends on** (§53.1) — not Marketplace-only work.
--
-- WHAT PROBLEM IT SOLVES (§32). Organizations get created independently in
-- Network and Marketplace. Without a canonical registry:
--
--     Network creates SMDC     = ENT-100
--     Marketplace creates SMDC = ENT-900
--
-- ...and `bamo_entity_id` stops meaning anything. One row here is the single
-- canonical answer to "which real-world company is this".
--
-- AN ENTITY IS NOT AN ACCOUNT (§31, §34). `bamo_account_id` correlates a person's
-- logins across products; `bamo_entity_id` correlates a real-world organization.
-- A developer company has one entity id and possibly several staff accounts.
-- They are never interchangeable and neither is ever an authorization key.
--
-- FOUR THINGS THIS IS CAREFUL ABOUT:
--
-- 1. NAMES DO NOT MERGE ENTITIES (§33). "Do not auto-merge organizations solely
--    because names are similar." `canonical_name` therefore carries NO unique
--    constraint — two genuinely distinct companies may share a name, and
--    forcing uniqueness would silently collapse them. Matching is
--    admin-assisted; `search_bamo_entities` ranks candidates and a human picks.
--
-- 2. IDs ARE PERMANENTLY RETIRED (§55.3). Nothing here deletes a row. Retiring
--    an entity is a status change, and a superseded entity keeps its id and
--    points at its successor rather than being freed.
--
-- 3. DEGRADED MODE IS THE CONSUMER'S JOB, BUT THIS SIDE MUST NOT FIGHT IT
--    (§53.2). When the registry is unreachable, Network and Marketplace create
--    the local organization with `bamo_entity_id = NULL` and correlate later.
--    A NULL is a valid, expected state — never an error shown to a user. So
--    nothing here is designed to be on a signup's critical path.
--
-- 4. THE CRM IS CUSTODIAN, NOT OWNER (§53.3). The registry lives here because
--    the CRM is the existing trusted backend. When BaMo Core arrives it moves,
--    and these `bamo_entity_id` values are adopted unchanged.
--
-- ⚠️ SCOPE. This migration is the registry and its **in-database** interface.
-- The HTTP interface that Network calls is a separate deliverable and must meet
-- §52 authentication in full (Vault service token, caller allowlist, replay
-- protection) before it ships. These functions are service_role only, so
-- nothing is reachable from a browser at any key in the meantime.
-- =============================================================================


-- =============================================================================
-- SECTION 1 - The registry
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bamo_entity_registry (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type           text NOT NULL,
  canonical_name        text NOT NULL,
  status                text NOT NULL DEFAULT 'active',
  -- Registration identifiers are the only safe automatic match (§33).
  registration_number   text,
  country_code          text NOT NULL DEFAULT 'PH',
  -- §22/§55.3: a merged-away entity keeps its id and records its successor.
  superseded_by_entity_id uuid REFERENCES public.bamo_entity_registry(id) ON DELETE RESTRICT,
  notes                 text,
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bamo_entity_registry_type_chk
    CHECK (entity_type IN ('developer', 'brokerage', 'agency', 'company', 'other')),
  CONSTRAINT bamo_entity_registry_status_chk
    CHECK (status IN ('active', 'inactive', 'superseded')),
  CONSTRAINT bamo_entity_registry_name_not_blank
    CHECK (length(btrim(canonical_name)) > 0),
  -- A superseded entity names its successor, and only a superseded one does.
  CONSTRAINT bamo_entity_registry_supersede_coherent
    CHECK ((status = 'superseded') = (superseded_by_entity_id IS NOT NULL)),
  CONSTRAINT bamo_entity_registry_no_self_supersede
    CHECK (superseded_by_entity_id IS DISTINCT FROM id)
);

-- Registration numbers ARE unique where present: unlike a name, a SEC/DTI
-- number identifies exactly one company, so a collision is a real duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS bamo_entity_registry_registration_key
  ON public.bamo_entity_registry (country_code, upper(btrim(registration_number)))
  WHERE registration_number IS NOT NULL AND btrim(registration_number) <> '';

CREATE INDEX IF NOT EXISTS bamo_entity_registry_name_idx
  ON public.bamo_entity_registry (lower(canonical_name));
CREATE INDEX IF NOT EXISTS bamo_entity_registry_active_idx
  ON public.bamo_entity_registry (entity_type, lower(canonical_name))
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS bamo_entity_registry_superseded_by_idx
  ON public.bamo_entity_registry (superseded_by_entity_id);
CREATE INDEX IF NOT EXISTS bamo_entity_registry_created_by_idx
  ON public.bamo_entity_registry (created_by_profile_id);

COMMENT ON TABLE public.bamo_entity_registry IS
  'Canonical BaMo entity registry (Identity Standard §32). One row per real-world organization; its id is the bamo_entity_id every product correlates against. The CRM is custodian, not owner (§53.3). canonical_name is deliberately NOT unique - names never merge entities (§33).';
COMMENT ON COLUMN public.bamo_entity_registry.superseded_by_entity_id IS
  'Set when this entity was merged away. The id is never reassigned or deleted (§55.3) - it stays resolvable and points at its successor.';


-- =============================================================================
-- SECTION 2 - Interface (§53.1)
-- =============================================================================
-- Three operations: search, resolve, request-create. All service_role only.

-- Search. Ranks exact registration match first, then exact name, then prefix,
-- then substring - so an admin picking from the list sees the safest candidate
-- at the top. It only ever SUGGESTS; nothing here auto-merges (§33).
CREATE OR REPLACE FUNCTION public.search_bamo_entities(
  p_query        text,
  p_entity_type  text DEFAULT NULL,
  p_limit        int  DEFAULT 20
)
RETURNS TABLE (
  bamo_entity_id uuid,
  entity_type    text,
  canonical_name text,
  status         text,
  registration_number text,
  match_quality  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.id, r.entity_type, r.canonical_name, r.status, r.registration_number,
         CASE
           WHEN r.registration_number IS NOT NULL
            AND upper(btrim(r.registration_number)) = upper(btrim(p_query)) THEN 'registration'
           WHEN lower(r.canonical_name) = lower(btrim(p_query))             THEN 'exact_name'
           WHEN lower(r.canonical_name) LIKE lower(btrim(p_query)) || '%'   THEN 'prefix'
           ELSE 'partial'
         END
    FROM public.bamo_entity_registry AS r
   WHERE (p_entity_type IS NULL OR r.entity_type = p_entity_type)
     AND btrim(coalesce(p_query, '')) <> ''
     AND (
       lower(r.canonical_name) LIKE '%' || lower(btrim(p_query)) || '%'
       OR (r.registration_number IS NOT NULL
           AND upper(btrim(r.registration_number)) = upper(btrim(p_query)))
     )
   ORDER BY
     CASE
       WHEN r.registration_number IS NOT NULL
        AND upper(btrim(r.registration_number)) = upper(btrim(p_query)) THEN 0
       WHEN lower(r.canonical_name) = lower(btrim(p_query))             THEN 1
       WHEN lower(r.canonical_name) LIKE lower(btrim(p_query)) || '%'   THEN 2
       ELSE 3
     END,
     (r.status = 'active') DESC,
     r.canonical_name
   LIMIT least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- Resolve. Follows a supersession chain so a stale id kept by another product
-- still answers correctly (§22). Bounded, because a cycle would otherwise spin
-- forever - and the constraints above cannot prevent a long cycle, only a
-- self-reference.
CREATE OR REPLACE FUNCTION public.resolve_bamo_entity(p_entity_id uuid)
RETURNS TABLE (
  bamo_entity_id      uuid,
  entity_type         text,
  canonical_name      text,
  status              text,
  registration_number text,
  requested_entity_id uuid,
  was_superseded      boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id    uuid := p_entity_id;
  v_next  uuid;
  v_hops  int := 0;
BEGIN
  IF p_entity_id IS NULL THEN RETURN; END IF;

  LOOP
    SELECT r.superseded_by_entity_id INTO v_next
      FROM public.bamo_entity_registry AS r WHERE r.id = v_id;
    IF NOT FOUND THEN RETURN; END IF;
    EXIT WHEN v_next IS NULL;

    v_hops := v_hops + 1;
    IF v_hops > 16 THEN
      RAISE EXCEPTION 'supersession chain from % exceeds 16 hops; registry is cyclic', p_entity_id
        USING ERRCODE = '55000';
    END IF;
    v_id := v_next;
  END LOOP;

  RETURN QUERY
    SELECT r.id, r.entity_type, r.canonical_name, r.status, r.registration_number,
           p_entity_id, (v_hops > 0)
      FROM public.bamo_entity_registry AS r WHERE r.id = v_id;
END;
$$;

-- Request creation. Idempotent on registration number: if a company with that
-- registration is already canonical, its existing id comes back rather than a
-- second row being minted. Name alone never dedupes (§33).
CREATE OR REPLACE FUNCTION public.request_bamo_entity(
  p_entity_type         text,
  p_canonical_name      text,
  p_registration_number text DEFAULT NULL,
  p_country_code        text DEFAULT 'PH',
  p_created_by_profile_id uuid DEFAULT NULL,
  p_notes               text DEFAULT NULL
)
RETURNS TABLE (bamo_entity_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing uuid;
  v_new      uuid;
  v_reg      text := nullif(btrim(coalesce(p_registration_number, '')), '');
BEGIN
  IF btrim(coalesce(p_canonical_name, '')) = '' THEN
    RAISE EXCEPTION 'canonical_name is required' USING ERRCODE = '22023';
  END IF;

  IF v_reg IS NOT NULL THEN
    SELECT r.id INTO v_existing
      FROM public.bamo_entity_registry AS r
     WHERE r.country_code = coalesce(p_country_code, 'PH')
       AND upper(btrim(r.registration_number)) = upper(v_reg);
    IF v_existing IS NOT NULL THEN
      RETURN QUERY SELECT v_existing, false;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.bamo_entity_registry
    (entity_type, canonical_name, registration_number, country_code,
     created_by_profile_id, notes)
  VALUES (p_entity_type, btrim(p_canonical_name), v_reg,
          coalesce(p_country_code, 'PH'), p_created_by_profile_id, p_notes)
  RETURNING id INTO v_new;

  RETURN QUERY SELECT v_new, true;
END;
$$;


-- =============================================================================
-- SECTION 3 - Grants and RLS
-- =============================================================================
ALTER TABLE public.bamo_entity_registry ENABLE ROW LEVEL SECURITY;

-- CRITICAL: the CRM's public schema grants anon/authenticated on new tables by
-- DEFAULT (Supabase default privileges). Strip that first, then grant precisely
-- - or a registry of company registration data is anon-reachable at the grant
-- level. (The post-check below fails the migration if this is skipped.)
REVOKE ALL ON public.bamo_entity_registry FROM PUBLIC, anon, authenticated;

-- BaMo staff may read the registry from the CRM UI. Nobody edits it through
-- the table - creation and supersession go through the functions, so that
-- every change has a code path that can enforce §33.
CREATE POLICY bamo_entity_registry_admin_read ON public.bamo_entity_registry
  FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) = 'baymo_admin');

GRANT SELECT ON public.bamo_entity_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bamo_entity_registry TO service_role;

REVOKE ALL ON FUNCTION public.search_bamo_entities(text, text, int)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_bamo_entity(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_bamo_entity(text, text, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.search_bamo_entities(text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_bamo_entity(uuid)             TO service_role;
GRANT EXECUTE ON FUNCTION public.request_bamo_entity(text, text, text, text, uuid, text) TO service_role;


-- =============================================================================
-- SECTION 4 - Post-checks
-- =============================================================================
DO $$
DECLARE v_bad text;
BEGIN
  IF to_regclass('public.bamo_entity_registry') IS NULL THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: registry table missing.';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.bamo_entity_registry'::regclass) THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: RLS is not enabled on the registry.';
  END IF;

  -- The registry must not be reachable by anonymous traffic at all.
  IF has_table_privilege('anon', 'public.bamo_entity_registry', 'SELECT, INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: anon holds privileges on the registry.';
  END IF;

  -- Nothing may write it directly - creation goes through the functions.
  IF has_table_privilege('authenticated', 'public.bamo_entity_registry', 'INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: authenticated can write the registry directly.';
  END IF;

  SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('search_bamo_entities', 'resolve_bamo_entity', 'request_bamo_entity')
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: registry function(s) reachable by an application role: %', v_bad;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('search_bamo_entities', 'resolve_bamo_entity', 'request_bamo_entity')
     AND p.prosecdef AND p.proconfig IS NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: definer function(s) without search_path: %', v_bad;
  END IF;

  -- §33: names must never be forced unique, or two real companies sharing a
  -- name would be silently collapsed into one entity.
  IF EXISTS (
    SELECT 1 FROM pg_index i
     WHERE i.indrelid = 'public.bamo_entity_registry'::regclass
       AND i.indisunique
       AND pg_get_indexdef(i.indexrelid) ILIKE '%canonical_name%'
       AND pg_get_indexdef(i.indexrelid) NOT ILIKE '%registration_number%'
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: canonical_name is uniquely indexed - names must not merge entities (Standard 33).';
  END IF;

  RAISE NOTICE 'Track B item 6 post-checks passed.';
END $$;
