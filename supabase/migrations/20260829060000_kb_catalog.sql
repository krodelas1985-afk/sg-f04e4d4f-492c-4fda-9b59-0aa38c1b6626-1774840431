-- =============================================================================
-- KB catalog — read-only access to campaign knowledge bases, for the Marketplace
-- CRM project zyfkjxepykwpfzmkxitb
-- =============================================================================
--
-- The Marketplace curator app wants to build a listing from what an agent's
-- Campaign Engine knowledge base already says, instead of retyping it. The
-- Marketplace cannot query this database directly (Identity Standard §27/§32),
-- so the CRM exposes what it is willing to share, and nothing else.
--
-- These three functions ARE that willingness, stated once, in the database:
--
--   kb_catalog_clients()  which clients have usable knowledge bases, and under
--                         which campaigns
--   kb_catalog_list(uuid) the knowledge bases under one campaign, as metadata
--   kb_catalog_get(uuid)  one knowledge base's text
--
-- WHY FUNCTIONS RATHER THAN SQL IN THE EDGE FUNCTION. The Edge Function holds a
-- service key, so whatever query it carries runs with full authority. Putting
-- the queries here means the *shape* of what the Marketplace can read is fixed
-- in the database, reviewable in a migration, and cannot be widened by editing
-- a TypeScript file. The registry interface is built the same way.
--
-- WHAT IS DELIBERATELY NOT EXPOSED. Only `is_active` knowledge bases, and only
-- title/content/provenance. No leads, no conversations, no client contact
-- details, no `proposed_content` awaiting review, no draft or superseded
-- revisions. A knowledge base is written to be read aloud to strangers by an AI
-- — it is the one part of the CRM that is already, in effect, public-facing.
--
-- GRANTS. ⚠️ This database grants anon and authenticated on new objects BY
-- DEFAULT — that is how CRM tables have historically ended up world-readable.
-- Every function below is therefore REVOKEd from PUBLIC/anon/authenticated and
-- granted to service_role alone, which is what the Edge Function runs as.

-- -----------------------------------------------------------------------------
-- 1. Which clients have knowledge bases, and under which campaigns
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kb_catalog_clients()
RETURNS TABLE (
  client_id     uuid,
  client_name   text,
  campaign_id   uuid,
  campaign_name text,
  kb_count      bigint,
  last_updated  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  -- Grouped by campaign because one agent may run several: Cristy has a Sofia
  -- campaign and will have others, and each carries its own knowledge base for
  -- a different property. Picking the client is not enough to pick the facts.
  SELECT k.client_id,
         c.name AS client_name,
         k.campaign_id,
         coalesce(k.campaign_name, '(unnamed campaign)') AS campaign_name,
         count(*) AS kb_count,
         max(k.updated_at) AS last_updated
    FROM public.campaign_knowledge_base AS k
    JOIN public.clients AS c ON c.id = k.client_id
   WHERE k.is_active
     AND coalesce(btrim(k.content), '') <> ''   -- an empty KB is not a source
   GROUP BY k.client_id, c.name, k.campaign_id, k.campaign_name
   ORDER BY c.name, campaign_name;
$function$;

COMMENT ON FUNCTION public.kb_catalog_clients() IS
  'Clients and campaigns holding a non-empty active knowledge base. Read-only, for the Marketplace curator app via bamo-kb-catalog.';

-- -----------------------------------------------------------------------------
-- 2. The knowledge bases under one campaign, as metadata
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kb_catalog_list(p_campaign_id uuid)
RETURNS TABLE (
  kb_id        uuid,
  title        text,
  source_label text,
  scope        text,
  content_chars integer,
  updated_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  -- content_chars rather than content: the picker needs to show which KB is
  -- substantial without shipping 25KB per row to draw a list.
  SELECT k.id, k.title, k.source_label, k.scope,
         length(k.content) AS content_chars, k.updated_at
    FROM public.campaign_knowledge_base AS k
   WHERE k.campaign_id = p_campaign_id
     AND k.is_active
     AND coalesce(btrim(k.content), '') <> ''
   ORDER BY k.updated_at DESC;
$function$;

COMMENT ON FUNCTION public.kb_catalog_list(uuid) IS
  'Active, non-empty knowledge bases under one campaign, as metadata only. Read-only.';

-- -----------------------------------------------------------------------------
-- 3. One knowledge base's text
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kb_catalog_get(p_kb_id uuid)
RETURNS TABLE (
  kb_id        uuid,
  title        text,
  content      text,
  source_label text,
  updated_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  -- `content` only. NOT proposed_content: that is text awaiting review, and
  -- feeding an unreviewed draft into a public listing is the KB-drift problem
  -- with the blast radius turned up.
  SELECT k.id, k.title, k.content, k.source_label, k.updated_at
    FROM public.campaign_knowledge_base AS k
   WHERE k.id = p_kb_id
     AND k.is_active
     AND coalesce(btrim(k.content), '') <> '';
$function$;

COMMENT ON FUNCTION public.kb_catalog_get(uuid) IS
  'One active knowledge base''s approved content. Never proposed_content — unreviewed text must not reach a public listing.';

-- -----------------------------------------------------------------------------
-- 4. Grants — this database is generous by default, so be explicit
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.kb_catalog_clients()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_catalog_list(uuid)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_catalog_get(uuid)      FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.kb_catalog_clients()   TO service_role;
GRANT EXECUTE ON FUNCTION public.kb_catalog_list(uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.kb_catalog_get(uuid)   TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Post-checks
-- -----------------------------------------------------------------------------
DO $post$
BEGIN
  IF has_function_privilege('anon', 'public.kb_catalog_clients()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.kb_catalog_list(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.kb_catalog_get(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'post-check: a kb_catalog function is executable by anon';
  END IF;

  IF has_function_privilege('authenticated', 'public.kb_catalog_clients()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.kb_catalog_list(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.kb_catalog_get(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'post-check: a kb_catalog function is executable by authenticated';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.kb_catalog_get(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'post-check: service_role cannot execute kb_catalog_get — the Edge Function would 502';
  END IF;
END;
$post$;
