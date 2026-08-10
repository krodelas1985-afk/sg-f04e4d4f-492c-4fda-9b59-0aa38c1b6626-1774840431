-- Phase 1 Step 0 (live half) — create an appointment when a viewing signal appears.
--
-- The gap this closes: nothing wrote to public.appointments. W2 detects viewing intent and
-- sets lead_qualifications.viewing_schedule / leads.status='Viewing' /
-- conversation_stage='viewing_set', but none of that became an appointment, so
-- trg_create_viewing_outcome_request never fired and no outcome email could ever be due.
-- Migration 20260810120000 backfilled 36 historical appointments; this is the ongoing path.
--
-- Fires on ANY of the three signals, because they do not always travel together — 5 of the
-- 36 backfilled leads reached status='Viewing' with no viewing_schedule text at all. Where
-- there is no usable date, resolve_viewing_datetime returns confidence 'none' and the lead
-- routes to the "date unknown" email variant rather than being dropped.

create or replace function public.ensure_viewing_appointment(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  l      record;
  vtext  text;
  r      record;
  new_id uuid;
begin
  select id, client_id, name, last_inbound_at
    into l
  from public.leads
  where id = p_lead_id;

  -- No inbound message means no anchor to resolve a relative date against ("bukas" is
  -- meaningless without the day it was said). Nothing to record.
  if not found or l.last_inbound_at is null then
    return null;
  end if;

  select viewing_schedule into vtext
  from public.lead_qualifications
  where lead_id = p_lead_id;

  -- Don't stack appointments. A lead who reschedules twice should not generate three
  -- outcome emails. Skip while a recent viewing appointment is still unanswered.
  --
  -- The 30-day window matters in both directions: it stops the backfilled 36 (all created
  -- today, all suppressed) from producing duplicates if one of their rows is touched again,
  -- while still allowing a lead who genuinely books again months later to be captured.
  if exists (
    select 1
    from public.appointments a
    left join public.viewing_outcome_requests vr on vr.appointment_id = a.id
    where a.lead_id = p_lead_id
      and a.appointment_type = 'viewing'
      and a.created_at > now() - interval '30 days'
      and coalesce(vr.status, 'pending') <> 'answered'
  ) then
    return null;
  end if;

  select * into r from public.resolve_viewing_datetime(vtext, l.last_inbound_at);

  insert into public.appointments
    (client_id, lead_id, appointment_type, scheduled_at, status,
     source_text, resolution_confidence, resolved_from, title)
  values
    (l.client_id, p_lead_id, 'viewing', r.scheduled_at, 'scheduled',
     vtext, r.confidence, 'conversation',
     'Viewing — ' || coalesce(nullif(btrim(l.name), ''), 'lead'))
  returning id into new_id;

  -- trg_create_viewing_outcome_request fires on that insert and creates a PENDING outcome
  -- request, which is what becomes an email the following morning.
  return new_id;
end;
$$;

comment on function public.ensure_viewing_appointment(uuid) is
  'Creates a viewing appointment from the lead''s current viewing signal, resolving the date from lead_qualifications.viewing_schedule against leads.last_inbound_at. No-ops if a recent unanswered viewing appointment already exists.';

-- ---------------------------------------------------------------------------
-- One trigger function per table. A single shared function with
-- `case tg_table_name ... then new.lead_id else new.id end` does NOT work: the
-- expression names both fields, and record field resolution fails on whichever
-- table lacks one ("record new has no field lead_id").
--
-- Deliberately no OLD/NEW comparison in the WHEN clauses: a WHEN referencing OLD
-- errors on INSERT, and re-firing is harmless because ensure_viewing_appointment
-- no-ops when an open appointment already exists.
-- ---------------------------------------------------------------------------
create or replace function public.on_viewing_signal_lq()
returns trigger
language plpgsql
as $$
begin
  perform public.ensure_viewing_appointment(new.lead_id);
  return new;
end;
$$;

create or replace function public.on_viewing_signal_lead()
returns trigger
language plpgsql
as $$
begin
  perform public.ensure_viewing_appointment(new.id);
  return new;
end;
$$;

drop trigger if exists trg_lq_viewing_signal on public.lead_qualifications;
create trigger trg_lq_viewing_signal
  after insert or update of viewing_schedule on public.lead_qualifications
  for each row
  when (new.viewing_schedule is not null)
  execute function public.on_viewing_signal_lq();

drop trigger if exists trg_leads_viewing_signal on public.leads;
create trigger trg_leads_viewing_signal
  after update of status, conversation_stage on public.leads
  for each row
  when (new.status = 'Viewing' or new.conversation_stage = 'viewing_set')
  execute function public.on_viewing_signal_lead();

revoke all on function public.ensure_viewing_appointment(uuid) from anon, authenticated, public;
