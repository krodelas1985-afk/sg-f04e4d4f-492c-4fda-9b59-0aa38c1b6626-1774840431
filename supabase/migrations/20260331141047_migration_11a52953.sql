-- Safe migration: Add missing columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES profiles(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual' CHECK (source IN ('manual', 'campaign', 'system'));

-- Ensure status defaults to 'pending' for new inserts
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'pending';