-- Safe migration: Add next_follow_up_date column to leads table if not exists
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up_date date;