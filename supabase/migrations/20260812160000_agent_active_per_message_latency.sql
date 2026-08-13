-- Kathy 2026-08-12: "even the messages are templated it can be sent by the
-- agent manually".
--
-- The per-PHRASE rule in 20260812150000 ignored a known auto-reply phrase
-- unconditionally. But Mary Ann's greeting is only 88% fast -- the other ~23 of
-- its 190 sends are slow, i.e. she pasted it herself. Those are agent activity,
-- and the previous version let the AI talk straight over them.
--
-- So canned_outbound_phrases now only says "this text is CAPABLE of firing
-- automatically". Whether a PARTICULAR message was the automation is decided by
-- that message's own latency after the lead's message (<=30s).
--
-- Why latency can never stand alone -- fastest genuine agent replies, excluding
-- BaMo and excluding detected auto-replies:
--   Cristy Joy    950 replies   fastest 0.00s   46 within 5s
--   Mary Ann     3475 replies   fastest 0.10s   13 within 5s
--   Joyce Cuenca  350 replies   fastest 0.76s    3 within 5s
--   Arleen Pecho   42 replies   fastest 34s      0 within 5s
-- Humans are frequently mid-typing when the lead's message lands.
--
-- Effect: of 231 template sends, 220 are treated as automation and 11 are
-- correctly reclassified as the agent pasting by hand.
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
      -- Ignore this message ONLY if it is a known auto-reply template AND it
      -- landed fast enough to have been the automation firing. The same text
      -- sent by hand later still counts as the agent being present.
      AND NOT (
            lower(btrim(c.message_content)) IN (SELECT phrase FROM public.canned_outbound_phrases)
        AND c.created_at <= COALESCE(
              (SELECT max(i.created_at) FROM public.conversations i
                WHERE i.lead_id = c.lead_id AND i.direction = 'inbound'
                  AND i.created_at < c.created_at),
              c.created_at - interval '1 day')
              + interval '30 seconds'
      )
  );
$$;

COMMENT ON FUNCTION public.agent_active_recently(uuid, integer) IS
  'True when a human agent has been present in this thread within p_minutes (default 10). An agent message is discounted only when it is BOTH a known auto-reply template (canned_outbound_phrases) AND arrived within 30s of the lead message -- the same template pasted by hand later still counts as the agent being present. Stateless: W2 skips while true and resumes when the agent goes quiet.';

REVOKE ALL ON FUNCTION public.agent_active_recently(uuid, integer) FROM public, anon;
