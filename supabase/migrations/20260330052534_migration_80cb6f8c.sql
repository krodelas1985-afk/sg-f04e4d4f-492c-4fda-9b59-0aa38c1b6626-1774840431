-- Safe migration: Add new columns to campaigns table
-- All columns are nullable for backward compatibility

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS currency text DEFAULT 'PHP';

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_industries text[];

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS job_titles text[];

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS start_date timestamptz;

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS end_date timestamptz;

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS success_metric text;

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS source_detail text;