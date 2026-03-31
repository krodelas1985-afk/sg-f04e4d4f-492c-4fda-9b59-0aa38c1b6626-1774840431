-- Safe migration: Add new columns to leads table only if they don't exist
ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS primary_channel text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0;