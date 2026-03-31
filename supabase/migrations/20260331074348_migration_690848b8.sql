-- Safe migration: Add new columns to conversations table only if they don't exist
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sender_id uuid REFERENCES profiles(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS attachment_type text;