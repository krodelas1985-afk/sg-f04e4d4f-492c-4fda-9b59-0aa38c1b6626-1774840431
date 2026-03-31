-- Safe migration: Create message_templates table only if it doesn't exist
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  title text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'messenger', 'sms')),
  category text CHECK (category IN ('Introduction', 'Follow-up', 'Qualification', 'Property Offer', 'Closing', 'Call-to-Action')),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);

-- Create trigger to auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_templates_updated_at
BEFORE UPDATE ON message_templates
FOR EACH ROW
EXECUTE FUNCTION update_message_templates_updated_at();