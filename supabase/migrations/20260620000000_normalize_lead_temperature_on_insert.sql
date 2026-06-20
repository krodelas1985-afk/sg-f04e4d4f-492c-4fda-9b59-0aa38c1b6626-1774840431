-- Harden lead_temperature casing against INSERTs (previously BEFORE UPDATE only).
-- messenger.ts inserted lowercase "cold", which violated leads_temperature_chk
-- (allows only 'New'|'Hot'|'Warm'|'Cold'), so new-lead INSERTs were silently
-- rejected and inbound messages dropped. The normalization function is unchanged
-- (NEW-only, OLD-safe: it just initcap()s the value); we only widen the trigger
-- to also fire on INSERT.
DROP TRIGGER IF EXISTS trg_normalize_and_guard_temperature ON public.leads;
CREATE TRIGGER trg_normalize_and_guard_temperature
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION normalize_and_guard_lead_temperature();
