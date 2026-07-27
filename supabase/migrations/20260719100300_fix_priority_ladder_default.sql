-- campaigns.priority has DEFAULT 10, so the original NULL-only check never fired.
-- Final ladder (lower wins): listing=1, project=2, general=10 (column default).
-- Explicit non-default priorities are always respected.
CREATE OR REPLACE FUNCTION public.set_campaign_priority_from_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.automation_scope IN ('listing','project')
     AND (NEW.priority IS NULL OR NEW.priority = 10) THEN
    NEW.priority := CASE NEW.automation_scope WHEN 'listing' THEN 1 ELSE 2 END;
  ELSIF NEW.priority IS NULL THEN
    NEW.priority := 10;
  END IF;
  RETURN NEW;
END;
$$;
