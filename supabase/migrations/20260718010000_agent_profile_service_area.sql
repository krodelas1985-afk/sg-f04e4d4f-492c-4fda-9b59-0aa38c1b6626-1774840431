-- Agent Profile: free-text servicing area (Kathy 2026-07-18),
-- complements the structured location_province/location_city home-base fields.
alter table public.profiles
  add column if not exists service_area text;
