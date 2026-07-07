-- ============================================================================
-- Notifications Phase 0 — backend foundation for the RE AI Assistant mobile app
-- Events: lead assigned, hot/warm lead, appointment booked, appointment/viewing
-- reminders (24h + 1h). In-app inbox is the source of truth; push is layered on
-- top by the `push-dispatch` edge function (deployed separately).
--
-- SAFETY: every trigger that hangs off leads/appointments is AFTER-timing and
-- wrapped in an EXCEPTION handler so a fault here can NEVER block a lead or
-- appointment write (see the 2026-06 lead-insert-trigger incident). All writer
-- functions are SECURITY DEFINER so they can insert into notifications (which
-- has no client INSERT policy) regardless of the invoking role.
-- ============================================================================

-- ── 1. Tables ───────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  client_id  uuid references public.clients(id) on delete cascade,
  type       text not null,                       -- lead_assigned | lead_reassigned_away | lead_hot | lead_warm | appointment_booked | appointment_reminder_day | appointment_reminder_hour
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,  -- { lead_id, appointment_id, route, ... }
  read_at    timestamptz,
  pushed_at  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx  on public.notifications (user_id) where read_at is null;
create index if not exists notifications_unpushed_idx     on public.notifications (created_at) where pushed_at is null;

create table if not exists public.push_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform        text,          -- 'android' | 'ios'
  device_id       text,
  updated_at      timestamptz not null default now(),
  unique (user_id, device_id)
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

create table if not exists public.notification_preferences (
  user_id               uuid primary key references public.profiles(id) on delete cascade,
  lead_assigned         boolean not null default true,
  lead_hot              boolean not null default true,
  lead_warm             boolean not null default true,   -- decision: Warm ON by default
  appointment_reminders boolean not null default true,
  ads_updates           boolean not null default true,
  quiet_hours           boolean not null default true,   -- 9pm–7am PHT hold (Hot + 1h reminders punch through)
  updated_at            timestamptz not null default now()
);

-- ── 2. RLS ──────────────────────────────────────────────────────────────────

alter table public.notifications           enable row level security;
alter table public.push_tokens             enable row level security;
alter table public.notification_preferences enable row level security;

-- notifications: read + mark-read own rows only; NO insert policy (writers are
-- SECURITY DEFINER trigger fns / service role, never the client).
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- push_tokens: full CRUD on own rows.
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notification_preferences: read/write own row.
drop policy if exists notif_prefs_own on public.notification_preferences;
create policy notif_prefs_own on public.notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 3. Recipient resolution ─────────────────────────────────────────────────
-- assigned agent if the lead is assigned; otherwise every active client_admin +
-- manager of the client (the client_admin owner is always in that set, so an
-- unassigned client with no sub-users still routes everything to the owner).
create or replace function public.resolve_lead_recipients(p_client_id uuid, p_assigned uuid)
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select p_assigned
  where p_assigned is not null
  union
  select id from public.profiles
   where p_assigned is null
     and client_id = p_client_id
     and is_active is true
     and role in ('client_admin', 'manager');
$$;

-- Small internal helper: create one notification row (bypasses RLS via definer).
create or replace function public.create_notification(
  p_user_id uuid, p_client_id uuid, p_type text, p_title text, p_body text, p_data jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, client_id, type, title, body, data)
  values (p_user_id, p_client_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
$$;

-- ── 4. Lead assignment notifications ────────────────────────────────────────
-- Companion to trg_log_lead_assignment_* (fires on the same events). New
-- assignee → lead_assigned (push). Previous assignee → lead_reassigned_away
-- (in-app only; push-dispatch does not push this type).
create or replace function public.notify_lead_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := coalesce(new.name, 'a lead');
begin
  -- newly assigned (and not a self no-op)
  if new.assigned_user_id is not null
     and new.assigned_user_id is distinct from (case when tg_op = 'UPDATE' then old.assigned_user_id end) then
    perform public.create_notification(
      new.assigned_user_id, new.client_id, 'lead_assigned',
      'New lead assigned to you',
      v_name || ' was assigned to you.',
      jsonb_build_object('lead_id', new.id, 'route', '/lead/' || new.id));
  end if;

  -- reassigned away from the previous owner
  if tg_op = 'UPDATE'
     and old.assigned_user_id is not null
     and old.assigned_user_id is distinct from new.assigned_user_id then
    perform public.create_notification(
      old.assigned_user_id, new.client_id, 'lead_reassigned_away',
      'Lead reassigned',
      v_name || ' was reassigned to someone else.',
      jsonb_build_object('lead_id', new.id, 'route', '/activity'));
  end if;

  return new;
exception when others then
  return new;  -- never block the lead write
end;
$$;

drop trigger if exists trg_notify_lead_assignment_ins on public.leads;
create trigger trg_notify_lead_assignment_ins
  after insert on public.leads
  for each row execute function public.notify_lead_assignment();

drop trigger if exists trg_notify_lead_assignment_upd on public.leads;
create trigger trg_notify_lead_assignment_upd
  after update of assigned_user_id on public.leads
  for each row execute function public.notify_lead_assignment();

-- ── 5. Hot / Warm temperature notifications ─────────────────────────────────
-- Fires only on a real transition INTO Hot/Warm (values already normalized by
-- the BEFORE trigger). 12h per-lead-per-type cooldown so W2 re-scoring on every
-- inbound message can't spam the agent.
create or replace function public.notify_lead_temperature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type  text;
  v_title text;
  v_name  text := coalesce(new.name, 'A lead');
  r       uuid;
begin
  if new.lead_temperature not in ('Hot', 'Warm') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.lead_temperature is not distinct from new.lead_temperature then
    return new;  -- no transition
  end if;

  if new.lead_temperature = 'Hot' then
    v_type := 'lead_hot';  v_title := '🔥 Hot lead';
  else
    v_type := 'lead_warm'; v_title := 'Warm lead';
  end if;

  -- cooldown
  if exists (
    select 1 from public.notifications
     where type = v_type
       and data->>'lead_id' = new.id::text
       and created_at > now() - interval '12 hours'
  ) then
    return new;
  end if;

  for r in select public.resolve_lead_recipients(new.client_id, new.assigned_user_id) loop
    perform public.create_notification(
      r, new.client_id, v_type, v_title,
      v_name || ' is now ' || new.lead_temperature || '.',
      jsonb_build_object('lead_id', new.id, 'route', '/lead/' || new.id));
  end loop;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_notify_lead_temperature on public.leads;
create trigger trg_notify_lead_temperature
  after insert or update of lead_temperature on public.leads
  for each row execute function public.notify_lead_temperature();

-- ── 6. Appointment "booked for you" notification ────────────────────────────
-- Only meaningful when someone other than the lead's assigned agent creates the
-- appointment (e.g. an admin books a viewing for the agent). Self-service
-- appointments (no linked lead, or creator == assignee) rely on reminders only.
create or replace function public.notify_appointment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignee uuid;
  v_kind text := case when new.appointment_type = 'viewing' then 'viewing' else 'call' end;
begin
  if new.lead_id is null then
    return new;
  end if;
  select assigned_user_id into v_assignee from public.leads where id = new.lead_id;
  if v_assignee is null or v_assignee = new.created_by then
    return new;
  end if;

  perform public.create_notification(
    v_assignee, new.client_id, 'appointment_booked',
    'New ' || v_kind || ' scheduled',
    coalesce(new.contact_name, 'A ' || v_kind) || ' on ' ||
      to_char(new.scheduled_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM'),
    jsonb_build_object('appointment_id', new.id, 'lead_id', new.lead_id, 'route', '/(tabs)/calendar'));

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_notify_appointment_created on public.appointments;
create trigger trg_notify_appointment_created
  after insert on public.appointments
  for each row execute function public.notify_appointment_created();

-- ── 7. Appointment / viewing reminders (pg_cron sweep) ──────────────────────
alter table public.appointments add column if not exists reminded_day_at  timestamptz;
alter table public.appointments add column if not exists reminded_hour_at timestamptz;

-- Day reminder fires once when an appointment enters the [now+1h, now+24h]
-- window AND was booked with >=24h lead time. Same-day bookings therefore skip
-- straight to the 1h reminder (decision #3). Hour reminder fires once in the
-- final hour. Recipient = created_by (the agent who owns the appointment).
create or replace function public.run_appointment_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec   record;
  v_kind text;
  v_where text;
begin
  -- 24h / day-before reminders
  for rec in
    select * from public.appointments
     where status = 'scheduled'
       and reminded_day_at is null
       and scheduled_at >  now() + interval '1 hour'
       and scheduled_at <= now() + interval '24 hours'
       and scheduled_at - created_at >= interval '24 hours'
     for update skip locked
  loop
    v_kind  := case when rec.appointment_type = 'viewing' then 'Viewing' else 'Phone appointment' end;
    v_where := case when rec.appointment_type = 'viewing' and rec.location is not null
                    then ' at ' || rec.location else '' end;
    perform public.create_notification(
      rec.created_by, rec.client_id, 'appointment_reminder_day',
      v_kind || ' tomorrow',
      v_kind || ' with ' || coalesce(rec.contact_name, 'your contact') || ' ' ||
        to_char(rec.scheduled_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM') || v_where || '.',
      jsonb_build_object('appointment_id', rec.id, 'lead_id', rec.lead_id, 'route', '/(tabs)/calendar'));
    update public.appointments set reminded_day_at = now() where id = rec.id;
  end loop;

  -- 1h reminders
  for rec in
    select * from public.appointments
     where status = 'scheduled'
       and reminded_hour_at is null
       and scheduled_at >  now()
       and scheduled_at <= now() + interval '1 hour'
     for update skip locked
  loop
    v_kind  := case when rec.appointment_type = 'viewing' then 'Viewing' else 'Phone appointment' end;
    v_where := case when rec.appointment_type = 'viewing' and rec.location is not null
                    then ' at ' || rec.location else '' end;
    perform public.create_notification(
      rec.created_by, rec.client_id, 'appointment_reminder_hour',
      v_kind || ' in 1 hour',
      v_kind || ' with ' || coalesce(rec.contact_name, 'your contact') || ' at ' ||
        to_char(rec.scheduled_at at time zone 'Asia/Manila', 'HH12:MI AM') || v_where || '.',
      jsonb_build_object('appointment_id', rec.id, 'lead_id', rec.lead_id, 'route', '/(tabs)/calendar'));
    update public.appointments set reminded_hour_at = now() where id = rec.id;
  end loop;
end;
$$;

-- every 5 minutes
select cron.schedule('appointment-reminder-sweep', '*/5 * * * *',
  $$select public.run_appointment_reminders()$$);

-- ── 8. Grants ───────────────────────────────────────────────────────────────
grant execute on function public.resolve_lead_recipients(uuid, uuid) to authenticated, service_role;
-- create_notification / notify_* / run_appointment_reminders are called by
-- triggers and cron only — no direct grant to authenticated.
