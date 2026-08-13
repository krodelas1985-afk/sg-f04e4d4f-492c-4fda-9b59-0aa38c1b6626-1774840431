-- Phase 0 of bamo-ops/BaMo_Objection_Handling_and_Hot_Ladder_Plan.md
-- Read-only additions. No behaviour change until W2/W5 consume these.
--
-- Context: W5's Run Cascade evaluated `objection` as step 1, above the viewing
-- check, so a single lead_memory row demoted deeply-engaged leads to Cold --
-- including four with a booked viewing. All 50 active objection rows carry the
-- same label ('hesitation') and never expire. These views are the data layer for
-- the corrected ladder: objection demotes only on shallow engagement, and only
-- to Warm.

-- 1. Canned / one-click phrases: inbound text repeating verbatim across >= 5 distinct
--    leads. These are FB ad quick-replies, not typed engagement.
--    Currently 51 phrases covering ~30% of all inbound messages.
CREATE MATERIALIZED VIEW public.canned_inbound_phrases AS
SELECT lower(btrim(message_content))  AS phrase,
       count(*)::int                  AS msg_count,
       count(DISTINCT lead_id)::int   AS lead_count
FROM public.conversations
WHERE direction = 'inbound'
  AND message_content IS NOT NULL
  AND btrim(message_content) <> ''
GROUP BY 1
HAVING count(DISTINCT lead_id) >= 5;

CREATE UNIQUE INDEX canned_inbound_phrases_phrase_key
  ON public.canned_inbound_phrases (phrase);

COMMENT ON MATERIALIZED VIEW public.canned_inbound_phrases IS
  'Ad quick-reply / one-click phrases, detected as inbound text repeating verbatim across >=5 leads. Refreshed nightly by refresh_canned_inbound_phrases(). Source of truth for "canned" -- do not re-derive this predicate elsewhere.';

-- 2. Per-lead engagement counts. SINGLE definition of genuine_inbound; W2 and W5
--    must both join this view rather than re-deriving the netting in JS/SQL.
--    (The kb_text predicate already lives in three places -- do not repeat that.)
CREATE VIEW public.lead_engagement_counts
WITH (security_invoker = on) AS
SELECT c.lead_id,
       count(*)::int AS inbound_count,
       count(*) FILTER (WHERE cp.phrase IS NOT NULL)::int AS canned_inbound_count,
       GREATEST(0, count(*) - count(*) FILTER (WHERE cp.phrase IS NOT NULL))::int AS genuine_inbound
FROM public.conversations c
LEFT JOIN public.canned_inbound_phrases cp
       ON cp.phrase = lower(btrim(c.message_content))
WHERE c.direction = 'inbound'
GROUP BY c.lead_id;

COMMENT ON VIEW public.lead_engagement_counts IS
  'genuine_inbound = inbound_count - canned_inbound_count. Drives the shallow-engagement test and Tier B corroboration in W5. One definition only. SERVICE ROLE ONLY - not exposed to anon or authenticated.';

-- 3. Per-lead objection counts. hard_refusal is excluded from the rebuttal budget
--    and surfaced separately -- it bypasses the counter and stops the AI outright.
CREATE VIEW public.lead_objection_counts
WITH (security_invoker = on) AS
SELECT lead_id,
       count(*) FILTER (WHERE COALESCE(memory_label,'') <> 'hard_refusal')::int AS objection_count,
       bool_or(memory_label = 'hard_refusal') AS has_hard_refusal
FROM public.lead_memory
WHERE memory_type = 'objection' AND is_active
GROUP BY lead_id;

COMMENT ON VIEW public.lead_objection_counts IS
  'objection_count counts every active objection event lifetime, legacy "hesitation" rows included (Kathy 2026-08-12). has_hard_refusal bypasses the counter. SERVICE ROLE ONLY.';

-- 4. Nightly refresh. Plain (non-CONCURRENT) REFRESH: the view is ~51 rows over a
--    3.4k-row scan, sub-second, and CONCURRENTLY cannot run inside a transaction
--    (which is how both pg_cron and a function body execute it).
CREATE OR REPLACE FUNCTION public.refresh_canned_inbound_phrases()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.canned_inbound_phrases;
END;
$$;

-- 5. Lock down. Supabase grants EXECUTE to anon by default, and a matview cannot
--    carry RLS. lead_engagement_counts is security_invoker and joins the matview,
--    so an authenticated SELECT would fail with a confusing permission error on
--    the *joined* relation -- close it explicitly rather than leave it half-open.
--    If a client-facing surface ever needs these, add a SECURITY DEFINER RPC with
--    a NULL-safe tenant guard, not a grant.
REVOKE ALL ON public.canned_inbound_phrases FROM anon, authenticated;
REVOKE ALL ON public.lead_engagement_counts FROM anon, authenticated;
REVOKE ALL ON public.lead_objection_counts  FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_canned_inbound_phrases() FROM public, anon, authenticated;

-- 6. Nightly at 18:00 UTC = 02:00 Manila, matching the other nightly jobs and
--    comfortably before W5's morning decay pass.
--    Applied live as cron jobid 8:
--      SELECT cron.schedule('refresh-canned-phrases-nightly', '0 18 * * *',
--                           'select public.refresh_canned_inbound_phrases()');
