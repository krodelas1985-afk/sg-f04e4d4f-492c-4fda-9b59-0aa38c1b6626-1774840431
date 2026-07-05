-- Shared client-level KB: scope='client' rows apply to ALL campaigns of the client,
-- scope='campaign' (default) rows apply only to their own campaign.
-- W2 (AI Campaign Responder) aggregates both when building the AI prompt.
ALTER TABLE campaign_knowledge_base
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'campaign'
  CHECK (scope IN ('campaign', 'client'));

CREATE INDEX IF NOT EXISTS idx_ckb_client_scope
  ON campaign_knowledge_base (client_id)
  WHERE scope = 'client' AND is_active = true;
