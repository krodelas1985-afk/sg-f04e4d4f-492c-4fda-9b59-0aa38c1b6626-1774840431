-- Phase 3 (mobile Calendar): allow a generic 'event' appointment type and an
-- optional title. Events (e.g. "Team meeting", "Open house") aren't tied to a
-- lead/contact, so title carries their label; viewings/calls keep using
-- contact_name as before.

alter table public.appointments
  drop constraint if exists appointments_appointment_type_check;

alter table public.appointments
  add constraint appointments_appointment_type_check
  check (appointment_type = any (array['viewing'::text, 'call'::text, 'event'::text]));

alter table public.appointments
  add column if not exists title text;
