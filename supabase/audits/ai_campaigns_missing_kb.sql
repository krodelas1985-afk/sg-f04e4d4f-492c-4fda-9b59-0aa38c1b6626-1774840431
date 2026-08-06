-- Read-only audit: which live campaigns are running conversational AI against
-- an empty or unreviewed knowledge base?
--
-- Run after applying 20260806100000_campaign_kb_empty_guard.sql (it uses
-- campaign_kb_ready()). Safe to run any time — no writes.
--
-- `w2_chars` is what W2 would actually inject as {{kb_text}} right now: it does
-- NOT filter on review_status, so an unreviewed row still reaches the AI.
-- `approved_chars` is what a human has signed off on. The incident shape is
-- w2_chars = 0; the near-miss shape is w2_chars > 0 with approved_chars = 0.

SELECT
  c.id                AS campaign_id,
  cl.name             AS client,
  c.name              AS campaign,
  c.status,
  c.conversational_ai_enabled,
  public.campaign_kb_ready(c.id, c.client_id) AS kb_ready,
  kb.w2_chars,
  kb.approved_chars,
  kb.approved_rows,
  kb.pending_rows,
  kb.pending_titles
FROM public.campaigns c
LEFT JOIN public.clients cl ON cl.id = c.client_id
CROSS JOIN LATERAL (
  SELECT
    coalesce(sum(length(coalesce(k.content, ''))), 0)                       AS w2_chars,
    coalesce(sum(length(coalesce(k.content, '')))
      FILTER (WHERE k.review_status = 'approved'), 0)                       AS approved_chars,
    count(*) FILTER (WHERE k.review_status = 'approved'
                       AND btrim(coalesce(k.content, '')) <> '')            AS approved_rows,
    count(*) FILTER (WHERE k.review_status <> 'approved')                   AS pending_rows,
    string_agg(k.title, ', ') FILTER (WHERE k.review_status <> 'approved')  AS pending_titles
  FROM public.campaign_knowledge_base k
  WHERE (k.campaign_id = c.id
         OR (k.scope = 'client' AND k.client_id = c.client_id))
    AND k.is_active = true
    AND k.type = 'knowledge'
) kb
WHERE c.status = 'active'
  AND coalesce(c.conversational_ai_enabled, false)
ORDER BY kb_ready, kb.w2_chars, cl.name, c.name;
