-- Kathy 2026-08-12, two refinements:
--   1. "just check for messages firing les than 8 seconds - this is an auto
--       reply - more than this is a possible copy paste template of an agent"
--   2. "yes always skip first contact - do not include"
--
-- Why (2) is required for (1) to be safe: the Page greeting fires on EVERY new
-- lead, and its latency distribution is min 6s / p25 10s / median 12s / p75 15s.
-- At an 8s cut only 10 of its 190 sends read as automation, so 180 would have
-- counted as "agent present" and muted the AI's first reply to nearly every new
-- ad lead. 462 of 676 W2 replies in 30 days ARE first-contact replies -- 68% of
-- its volume -- so that would have broken the core auto-response product.
-- Excluding first contact removes the failure mode, after which 8s is safe.
--
-- First contact = the first agent outbound in the thread (the Page greeting
-- slot). Anything the agent sends after that counts normally, so a real
-- conversation still stands the AI down immediately.
--
-- Effect: W2 suppression 88 -> 67 messages / 30 days across 24 leads, with 462
-- first-contact replies explicitly protected. Patrick Famini's 2026-08-06
-- thread still catches 13/13.
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
      -- (1) Discount a known template that fired fast enough to be automation.
      --     The same text pasted by hand later still counts as the agent.
      AND NOT (
            lower(btrim(c.message_content)) IN (SELECT phrase FROM public.canned_outbound_phrases)
        AND c.created_at <= COALESCE(
              (SELECT max(i.created_at) FROM public.conversations i
                WHERE i.lead_id = c.lead_id AND i.direction = 'inbound'
                  AND i.created_at < c.created_at),
              c.created_at - interval '1 day')
              + interval '8 seconds'
      )
      -- (2) Never count first contact: the opening outbound is the greeting
      --     slot, and the AI must still answer a brand-new lead.
      AND EXISTS (
        SELECT 1 FROM public.conversations p
        WHERE p.lead_id = c.lead_id AND p.direction = 'outbound'
          AND p.sender = 'agent' AND p.created_at < c.created_at
      )
  );
$$;

COMMENT ON FUNCTION public.agent_active_recently(uuid, integer) IS
  'True when a human agent has been present in this thread within p_minutes (default 10). Discounts (a) a known auto-reply template that arrived within 8s of the lead message -- the same text pasted by hand later still counts -- and (b) the first agent outbound of the thread, which is the greeting slot; the AI must still answer a brand-new lead. Stateless: W2 skips while true and resumes when the agent goes quiet.';

REVOKE ALL ON FUNCTION public.agent_active_recently(uuid, integer) FROM public, anon;
