-- Phase 1 — the day-before prep reminder.
--
-- Kathy, 2026-08-31: "if the viewing will happen on Sept 6 there will be indication from
-- the agent - then we can send her the email when the system catch that there has been a
-- viewing - but what we need from it - is another email to send to agent to remind her
-- before ... to message the lead."
--
-- WHY THIS IS NOT THE EXISTING reminder_* COLUMNS
-- reminder_due_at / reminder_sent_at are already spoken for: mark_viewing_outcome_sent
-- uses them to schedule the single chase-up of an UNANSWERED outcome email, the morning
-- after the first send (pending -> sent -> reminded). That is a different email at a
-- different time. Overloading those columns would silently break the chase, so this adds
-- its own pair.
--
-- WHAT IT IS FOR
-- The prep reminder lands the morning BEFORE the viewing and asks the agent to message
-- her lead. In Phase 2 it also carries the one-click buttons that record whether the
-- viewing is actually going ahead, and THAT is what will gate the outcome email.
--
-- The gate matters because of what happened on 2026-08-30: an outcome email went to a
-- real agent asking how a viewing went, for a lead whose only message was "not available
-- this weekend due to anniversary and family gatherings". The viewing was inferred, never
-- agreed. Confirmation cannot come from the outcome email itself -- that is circular, as
-- the one-click tokens only exist once that email has been sent -- so it has to be asked
-- for beforehand. Hence this reminder.

-- ---------------------------------------------------------------------------
-- State
-- ---------------------------------------------------------------------------
alter table public.viewing_outcome_requests
  add column if not exists prep_reminder_due_at  timestamptz,
  add column if not exists prep_reminder_sent_at timestamptz;

comment on column public.viewing_outcome_requests.prep_reminder_due_at is
  'When the day-before "message your lead" reminder is due. NULL = no reminder, which is every row created before 2026-08-31. Distinct from reminder_due_at, which chases an unanswered outcome email.';

comment on column public.viewing_outcome_requests.prep_reminder_sent_at is
  'Set once the prep reminder has been accepted by Resend. Also the idempotency guard: pending_viewing_prep_reminders() only returns rows where this is still null.';

-- ---------------------------------------------------------------------------
-- The morning before the viewing, 08:00 Manila.
-- Mirrors viewing_outcome_due_at, which is the morning after.
-- ---------------------------------------------------------------------------
create or replace function public.viewing_prep_reminder_due_at(p_scheduled timestamptz)
returns timestamptz
language sql
immutable
as $$
  select ((date_trunc('day', p_scheduled at time zone 'Asia/Manila')::date - 1)
          + interval '8 hours') at time zone 'Asia/Manila';
$$;

comment on function public.viewing_prep_reminder_due_at(timestamptz) is
  'Morning before a viewing, 08:00 Asia/Manila. Counterpart to viewing_outcome_due_at.';

-- ---------------------------------------------------------------------------
-- Populate it when the appointment is created.
--
-- Same-day bookings are the norm here, not the exception -- the live table is full of
-- source_text like "mamaya", "Now na", "bukas". For those the day-before slot is already
-- in the past, so it is clamped to now() rather than left null: the reminder then goes
-- out on the next scheduler pass and the agent is still asked to confirm. Leaving it null
-- would mean no reminder at all, and under the Phase 2 gate that would quietly mean no
-- outcome email either -- turning a timing edge case into permanent silence.
--
-- Attributes deliberately match the live function: invoker rights, no search_path pin.
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
    (appointment_id, lead_id, client_id, status, due_at, prep_reminder_due_at)
  values
    (new.id, new.lead_id, new.client_id, 'pending',
     public.viewing_outcome_due_at(new.scheduled_at),
     greatest(public.viewing_prep_reminder_due_at(new.scheduled_at), now()))
  on conflict (appointment_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Prep reminders due to send.
-- Shape mirrors pending_viewing_outcome_emails so the n8n Build Email node can reuse its
-- code path. No send_kind column: there is exactly one prep reminder, ever.
-- ---------------------------------------------------------------------------
create or replace function public.pending_viewing_prep_reminders(p_limit int default 25)
returns table (
  request_id       uuid,
  appointment_id   uuid,
  lead_id          uuid,
  client_id        uuid,
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
    coalesce(nullif(btrim(l.name), ''), 'A lead'),
    cl.name, a.source_text, a.scheduled_at,
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
  where r.status = 'pending'
    and r.prep_reminder_due_at is not null
    and r.prep_reminder_sent_at is null
    and r.prep_reminder_due_at <= now()
    -- Never nudge about a viewing that has already been and gone. Without this, a row
    -- whose reminder was missed for any reason would keep surfacing forever.
    and a.scheduled_at > now() - interval '12 hours'
  order by r.prep_reminder_due_at
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

comment on function public.pending_viewing_prep_reminders(int) is
  'Day-before "message your lead" reminders due to send. Only status=pending rows, never suppressed or answered ones, and never a viewing more than 12h past.';

-- ---------------------------------------------------------------------------
-- Marks the prep reminder as sent. Called by n8n after Resend accepts it.
-- Definer + pinned search_path, matching mark_viewing_outcome_sent.
-- ---------------------------------------------------------------------------
create or replace function public.mark_viewing_prep_reminder_sent(
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
     set prep_reminder_sent_at = now(),
         -- do not clobber a recipient list already recorded by an outcome send
         recipients = coalesce(recipients, p_recipients),
         send_error = null,
         updated_at = now()
   where id = p_request_id
     and prep_reminder_sent_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access control — mirrors the 2026-08-10 outcome-request migration.
-- ---------------------------------------------------------------------------
revoke all on function public.viewing_prep_reminder_due_at(timestamptz)         from anon, public;
revoke all on function public.pending_viewing_prep_reminders(int)               from anon, public;
revoke all on function public.mark_viewing_prep_reminder_sent(uuid, text, text) from anon, public;
