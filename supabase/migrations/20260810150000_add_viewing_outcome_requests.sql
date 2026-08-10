-- Phase 1 Step 2 — outcome email state machine.
--
-- One row per appointment, tracking whether the outcome email has gone out, whether the
-- single permitted reminder has gone out, and whether the agent has answered.
--
-- ⚠️ BACKFILL SUPPRESSION (Kathy, 2026-08-10): the 36 appointments seeded from historical
-- viewing signals must NEVER receive an outcome email. Their scheduled_at is all in the
-- past, so any "date has passed" query would fire 36 emails at real agents about leads
-- from weeks ago. They are inserted here with status='suppressed' rather than omitted, so
-- the exclusion is explicit, auditable, and survives someone later "fixing" a query that
-- appeared to be missing rows.
--
-- Only appointments created AFTER this migration are eligible.

create table if not exists public.viewing_outcome_requests (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid not null unique references public.appointments(id) on delete cascade,
  lead_id           uuid not null references public.leads(id) on delete cascade,
  client_id         uuid,

  status            text not null default 'pending'
    check (status in ('suppressed','pending','sent','reminded','answered','expired')),
  suppressed_reason text,

  -- the morning after scheduled_at, Manila
  due_at            timestamptz,
  first_sent_at     timestamptz,
  reminder_due_at   timestamptz,
  reminder_sent_at  timestamptz,
  answered_at       timestamptz,

  recipients        text,
  send_error        text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.viewing_outcome_requests is
  'Outcome-email state per appointment. status suppressed = never send (historical backfill). Exactly one reminder is permitted: pending -> sent -> reminded, then stop.';
comment on column public.viewing_outcome_requests.due_at is
  'When the first email may go out: 08:00 Manila the morning after scheduled_at.';

create index if not exists idx_vor_due    on public.viewing_outcome_requests (status, due_at);
create index if not exists idx_vor_remind on public.viewing_outcome_requests (status, reminder_due_at);
create index if not exists idx_vor_lead   on public.viewing_outcome_requests (lead_id);

-- ---------------------------------------------------------------------------
-- due_at helper: 08:00 Manila on the day after the appointment
-- ---------------------------------------------------------------------------
create or replace function public.viewing_outcome_due_at(p_scheduled timestamptz)
returns timestamptz
language sql
immutable
as $$
  select ((date_trunc('day', p_scheduled at time zone 'Asia/Manila')::date + 1)
          + interval '8 hours') at time zone 'Asia/Manila';
$$;

-- ---------------------------------------------------------------------------
-- New viewing appointments become eligible automatically.
-- ---------------------------------------------------------------------------
create or replace function public.create_viewing_outcome_request()
returns trigger
language plpgsql
as $$
begin
  if new.appointment_type is distinct from 'viewing' then
    return new;
  end if;

  insert into public.viewing_outcome_requests
    (appointment_id, lead_id, client_id, status, due_at)
  values
    (new.id, new.lead_id, new.client_id, 'pending',
     public.viewing_outcome_due_at(new.scheduled_at))
  on conflict (appointment_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_create_viewing_outcome_request on public.appointments;
create trigger trg_create_viewing_outcome_request
  after insert on public.appointments
  for each row
  execute function public.create_viewing_outcome_request();

-- ---------------------------------------------------------------------------
-- An agent confirmation closes the request — no reminder follows.
-- ---------------------------------------------------------------------------
create or replace function public.close_viewing_outcome_request()
returns trigger
language plpgsql
as $$
begin
  if new.source = 'agent_confirmed' and new.appointment_id is not null then
    update public.viewing_outcome_requests
       set status      = 'answered',
           answered_at = coalesce(answered_at, now()),
           updated_at  = now()
     where appointment_id = new.appointment_id
       and status <> 'answered';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_close_viewing_outcome_request on public.lead_viewing_indications;
create trigger trg_close_viewing_outcome_request
  after insert on public.lead_viewing_indications
  for each row
  execute function public.close_viewing_outcome_request();

-- ---------------------------------------------------------------------------
-- SUPPRESS THE BACKFILL — every appointment that exists right now.
-- ---------------------------------------------------------------------------
insert into public.viewing_outcome_requests
  (appointment_id, lead_id, client_id, status, suppressed_reason, due_at)
select a.id, a.lead_id, a.client_id, 'suppressed',
       'historical backfill seeded 2026-08-10; agent must not be emailed about leads from weeks ago',
       public.viewing_outcome_due_at(a.scheduled_at)
from public.appointments a
on conflict (appointment_id) do nothing;

-- ---------------------------------------------------------------------------
-- What the sender workflow reads. Mirrors pending_lead_alerts(): resolves recipients
-- through the same resolver W9 uses, so per-agent routing is inherited, not reinvented.
--
-- Returns first sends and reminders in one call; the workflow branches on send_kind.
-- ---------------------------------------------------------------------------
create or replace function public.pending_viewing_outcome_emails(p_limit int default 25)
returns table (
  request_id       uuid,
  appointment_id   uuid,
  lead_id          uuid,
  client_id        uuid,
  send_kind        text,
  lead_name        text,
  client_name      text,
  source_text      text,
  scheduled_at     timestamptz,
  date_known       boolean,
  recipient_emails text
)
language sql
stable
as $$
  select
    r.id, r.appointment_id, r.lead_id, r.client_id,
    case when r.status = 'pending' then 'first' else 'reminder' end,
    coalesce(nullif(btrim(l.name), ''), 'A lead'),
    cl.name,
    a.source_text,
    a.scheduled_at,
    (a.resolution_confidence is distinct from 'none'),
    coalesce(
      (select string_agg(distinct p.email, ',')
         from public.resolve_lead_recipients(r.client_id, l.assigned_user_id) rr
         join public.profiles p on p.id = rr
        where p.is_active
          and p.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
      nullif(case when cl.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then cl.email end, '')
    )
  from public.viewing_outcome_requests r
  join public.appointments a on a.id = r.appointment_id
  join public.leads l        on l.id = r.lead_id
  join public.clients cl     on cl.id = r.client_id
  where (
      (r.status = 'pending' and r.due_at          <= now())
   or (r.status = 'sent'    and r.reminder_due_at <= now())
  )
  order by coalesce(r.reminder_due_at, r.due_at)
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

comment on function public.pending_viewing_outcome_emails(int) is
  'Outcome emails due to send. Never returns suppressed rows (the 2026-08-10 historical backfill) or answered ones. send_kind first|reminder; exactly one reminder is possible because status moves pending -> sent -> reminded.';

-- ---------------------------------------------------------------------------
-- Marks a send. Called by the workflow after Resend accepts the message.
-- ---------------------------------------------------------------------------
create or replace function public.mark_viewing_outcome_sent(
  p_request_id uuid,
  p_recipients text,
  p_error      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_error is not null then
    update public.viewing_outcome_requests
       set send_error = p_error, updated_at = now()
     where id = p_request_id;
    return;
  end if;

  update public.viewing_outcome_requests
     set status = case when status = 'pending' then 'sent' else 'reminded' end,
         first_sent_at = case when status = 'pending' then now() else first_sent_at end,
         -- one reminder only: scheduled for the following morning
         reminder_due_at = case when status = 'pending'
                                then public.viewing_outcome_due_at(now())
                                else reminder_due_at end,
         reminder_sent_at = case when status = 'sent' then now() else reminder_sent_at end,
         recipients = p_recipients,
         send_error = null,
         updated_at = now()
   where id = p_request_id
     and status in ('pending','sent');
end;
$$;

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------
alter table public.viewing_outcome_requests enable row level security;

revoke insert, update, delete on public.viewing_outcome_requests from anon, authenticated, public;
revoke select on public.viewing_outcome_requests from anon;

revoke all on function public.pending_viewing_outcome_emails(int) from anon, public;
revoke all on function public.mark_viewing_outcome_sent(uuid, text, text) from anon, public;

drop policy if exists vor_select on public.viewing_outcome_requests;
create policy vor_select
  on public.viewing_outcome_requests
  for select
  using (
    get_my_role() = 'baymo_admin'
    or client_id = get_my_client_id()
  );
