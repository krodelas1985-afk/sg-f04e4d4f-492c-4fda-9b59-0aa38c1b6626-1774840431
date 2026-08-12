-- Supersedes the detection rule in 20260812140000.
--
-- Kathy 2026-08-12: "we should not rely on a templated messages because agents
-- has their own - we can measure it by the speed of responses."
--
-- Correct, and the data proved the first version wrong. Repetition ALONE tagged
-- 96 phrases as templates, but only a handful are Page auto-replies; the other
-- ~92 are agents manually pasting their own canned material (location lists,
-- price blocks, open-house invites, website links). Those ARE agent activity and
-- must pause the AI -- the first version wrongly ignored them.
--
-- Median latency after the lead's message separates the two cleanly:
--   "Good day! I'm Mary Ann Mendoza Caringal..."  190 sends, median     12s  auto
--   "Thank you for your Interest ... thru ads"    190 sends, median    214s  pasted
--   "Here po ang mga location ntn"                 65 sends, median   2674s  pasted
--   open-house invite                              33 sends, median 260906s  blast
--
-- Latency alone is NOT sufficient either: in the Patrick Famini thread the agent
-- typed genuine replies 8-15s after the lead, so a flat "fast = automated" rule
-- would resurrect the very bug this fixes. An auto-reply is both REPEATED across
-- leads AND consistently fast. A human can be fast, but not fast and identical
-- across many different conversations.
--
-- Result: 4 auto-reply phrases (231 sends) instead of 96, one of which is
-- Facebook's stock text "Hi, thanks for contacting us. We've received your
-- message and appreciate...". W2 suppression rises 82 -> 88 messages / 30 days.
DROP MATERIALIZED VIEW IF EXISTS public.canned_outbound_phrases CASCADE;

CREATE MATERIALIZED VIEW public.canned_outbound_phrases AS
WITH seq AS (
  SELECT lead_id, created_at, direction, sender, message_content,
         max(CASE WHEN direction = 'inbound' THEN created_at END)
           OVER (PARTITION BY lead_id ORDER BY created_at
                 ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_inbound
  FROM public.conversations
), agent_msgs AS (
  SELECT lower(btrim(message_content)) AS phrase, lead_id,
         extract(epoch FROM (created_at - prev_inbound)) AS secs
  FROM seq
  WHERE direction = 'outbound' AND sender = 'agent'
    AND message_content IS NOT NULL AND btrim(message_content) <> ''
    AND message_content NOT IN ('[image]', '[video]')
    AND prev_inbound IS NOT NULL
)
SELECT phrase,
       count(*)::int                                                 AS msg_count,
       count(DISTINCT lead_id)::int                                  AS lead_count,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY secs))::int AS median_reply_secs
FROM agent_msgs
GROUP BY phrase
HAVING count(DISTINCT lead_id) >= 5
   AND percentile_cont(0.5) WITHIN GROUP (ORDER BY secs) <= 20;

CREATE UNIQUE INDEX canned_outbound_phrases_phrase_key
  ON public.canned_outbound_phrases (phrase);

COMMENT ON MATERIALIZED VIEW public.canned_outbound_phrases IS
  'Page AUTO-REPLIES only: outbound agent text that both repeats across >=5 leads AND has median latency <=20s after the lead message. Repetition alone is not enough -- agents paste their own canned material manually, and that counts as agent activity. Latency alone is not enough -- humans type fast too. Excluded from agent_active_recently(). Refreshed nightly.';

-- Recreate the predicate dropped by CASCADE. Body unchanged from 20260812140000.
CREATE OR REPLACE FUNCTION public.agent_active_recently(p_lead_id uuid, p_minutes integer DEFAULT 10)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.lead_id = p_lead_id
      AND c.direction = 'outbound'
      AND c.sender = 'agent'
      AND c.created_at > now() - make_interval(mins => p_minutes)
      AND c.message_content IS NOT NULL
      AND c.message_content NOT IN ('[image]', '[video]')
      AND lower(btrim(c.message_content)) NOT IN (SELECT phrase FROM public.canned_outbound_phrases)
  );
$$;

COMMENT ON FUNCTION public.agent_active_recently(uuid, integer) IS
  'True when a human agent has sent a non-auto-reply message to this lead within p_minutes (default 10). W2 skips its reply when true. Stateless: no automation_enabled change, no campaign_id nulling -- the AI resumes once the agent goes quiet.';

REVOKE ALL ON public.canned_outbound_phrases FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_active_recently(uuid, integer) FROM public, anon;

-- Replayed against Patrick Famini's 2026-08-06 thread: still 13/13 skipped.
