-- Safe migration: Add missing columns to message_templates table
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS channel text CHECK (channel IN ('email', 'messenger', 'sms'));
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('Introduction', 'Follow-up', 'Qualification', 'Property Offer', 'Closing', 'Call-to-Action'));
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

-- Add trigger to auto-update updated_at (if not exists)
CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_templates_updated_at ON message_templates;
CREATE TRIGGER message_templates_updated_at
BEFORE UPDATE ON message_templates
FOR EACH ROW
EXECUTE FUNCTION update_message_templates_updated_at();