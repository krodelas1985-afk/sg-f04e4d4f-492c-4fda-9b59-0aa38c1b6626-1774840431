-- W2 must not answer over an agent who is live in the thread.
--
-- Evidence (2026-08-06, lead Patrick Famini 6606bd6e, client Mary Ann): the
-- agent live-chatted for 17 minutes and W2 cut in 11 times, 3-45 seconds after
-- her messages. She apologised to her own customer twice, in-channel:
--   15:02:02  "pasencya na po at naka auto ang reply ng ai assistant.."
--   15:06:15  "sencya na po.. at ang Ai assistant ay sagot ng sagot"
--
-- Scale: 82 W2 messages across 29 leads in 30 days were sent within 10 minutes
-- of a manual agent reply.
--
-- Agent greeting / Meta instant-reply templates must NOT count as agent
-- activity -- the Page sends those automatically on any inbound, and they were
-- inflating an earlier estimate by ~2x. Detected the same way as inbound ad
-- quick-replies: outbound agent text repeating verbatim across many leads. The
-- >40 char floor keeps short genuine replies ("tama po", "wala po sir") from
-- being mistaken for templates. The bias is deliberate: a false "canned" lets
-- the AI talk over a real agent, while a false "manual" only makes it wait.
CREATE MATERIALIZED VIEW public.canned_outbound_phrases AS
SELECT lower(btrim(message_content))  AS phrase,
       count(*)::int                  AS msg_count,
       count(DISTINCT lead_id)::int   AS lead_count
FROM public.conversations
WHERE direction = 'outbound' AND sender = 'agent'
  AND message_content IS NOT NULL AND btrim(message_content) <> ''
GROUP BY 1
HAVING count(DISTINCT lead_id) >= 5
   AND max(length(message_content)) > 40;

CREATE UNIQUE INDEX canned_outbound_phrases_phrase_key
  ON public.canned_outbound_phrases (phrase);

COMMENT ON MATERIALIZED VIEW public.canned_outbound_phrases IS
  'Agent-side templates / Meta instant replies, detected as outbound agent text repeating verbatim across >=5 leads and longer than 40 chars. Excluded from "is an agent live in this thread" checks. Refreshed nightly.';

-- Single definition of the rule. W2 calls this; do not re-derive it in JS.
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
  'True when a human agent has sent a NON-template message to this lead within p_minutes (default 10). W2 skips its reply when true. Stateless: no automation_enabled change, no campaign_id nulling -- the AI simply resumes once the agent goes quiet.';

REVOKE ALL ON public.canned_outbound_phrases FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_active_recently(uuid, integer) FROM public, anon;

-- Nightly refresh now covers both canned views (cron: refresh-canned-phrases-nightly).
CREATE OR REPLACE FUNCTION public.refresh_canned_inbound_phrases()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.canned_inbound_phrases;
  REFRESH MATERIALIZED VIEW public.canned_outbound_phrases;
END;
$$;

COMMENT ON FUNCTION public.refresh_canned_inbound_phrases() IS
  'Refreshes BOTH canned_inbound_phrases (ad quick-replies) and canned_outbound_phrases (agent templates). Nightly via cron job refresh-canned-phrases-nightly.';

-- Replayed against Patrick Famini's 2026-08-06 thread: all 13 AI interruptions
-- return true, i.e. all 13 would have been skipped.
