-- Distinguish client buyer lead-gen campaigns from BaMo's own B2B campaigns
-- (selling the BaMo platform to agents/brokers/developers).
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'buyer_leadgen';

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_campaign_type_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_campaign_type_check
  CHECK (campaign_type IN ('buyer_leadgen', 'bamo_b2b'));

COMMENT ON COLUMN public.campaigns.campaign_type IS
  'buyer_leadgen = client campaign targeting property buyers (default); bamo_b2b = BaMo-owned campaign selling the platform to RE professionals';
