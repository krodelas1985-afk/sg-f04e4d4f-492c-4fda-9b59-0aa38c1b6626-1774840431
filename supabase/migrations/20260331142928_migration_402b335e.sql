-- Safe migration: Add is_active column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;