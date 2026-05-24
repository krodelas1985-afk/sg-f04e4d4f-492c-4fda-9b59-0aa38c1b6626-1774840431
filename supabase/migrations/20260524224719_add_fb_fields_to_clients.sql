-- Add Facebook Page Token and Page ID fields to clients table
-- fb_page_token: the long-lived Page Access Token used to send/receive Messenger messages
-- fb_page_id: the Facebook Page ID used to route incoming webhooks to the correct client

ALTER TABLE clients ADD COLUMN IF NOT EXISTS fb_page_token text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS fb_page_id text;

-- Index for fast lookup when routing incoming Facebook Messenger webhooks
CREATE UNIQUE INDEX IF NOT EXISTS clients_fb_page_id_idx ON clients (fb_page_id)
  WHERE fb_page_id IS NOT NULL;
