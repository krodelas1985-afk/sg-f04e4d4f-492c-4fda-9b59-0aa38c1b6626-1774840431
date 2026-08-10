-- Lead state history — close the gaps around the existing lead_temperature_events log.
--
-- Context (verified 2026-08-10):
--   * public.lead_temperature_events ALREADY logs temperature transitions via
--     trg_leads_temperature_event -> log_lead_temperature_event(). Live since 2026-07-11,
--     1,695 rows / 884 leads. Temperature history is NOT being lost.
--   * It records only (from_temperature, to_temperature, changed_at). It does NOT record
--     WHY the change happened.
--   * lead_grade and status transitions are not logged anywhere.
--
-- This migration therefore does two things and deliberately does NOT duplicate temperature:
--   Part A — enrich lead_temperature_events with the reason/source behind each transition.
--   Part B — add lead_state_events for grade / status / score / stage transitions.
--
-- Capture-only. No behaviour change: nothing reads these yet.

-- ===========================================================================
-- Part A — record WHY a temperature changed
-- ===========================================================================

alter table public.lead_temperature_events
  add column if not exists temperature_reason text,
  add column if not exists temperature_source text;

comment on column public.lead_temperature_events.temperature_reason is
  'leads.temperature_reason at the moment of the transition (e.g. "objection/stop signal in memory").';
comment on column public.lead_temperature_events.temperature_source is
  'leads.temperature_source at the moment of the transition (auto | manual).';

-- Existing rows keep NULL for both; history before 2026-08-10 has no recorded reason.

create or replace function public.log_lead_temperature_event()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.lead_temperature is not null then
      insert into lead_temperature_events (
        lead_id, client_id, from_temperature, to_temperature,
        temperature_reason, temperature_source
      )
      values (
        new.id, new.client_id, null, new.lead_temperature,
        new.temperature_reason, new.temperature_source
      );
    end if;
  elsif new.lead_temperature is distinct from old.lead_temperature
        and new.lead_temperature is not null then
    insert into lead_temperature_events (
      lead_id, client_id, from_temperature, to_temperature,
      temperature_reason, temperature_source
    )
    values (
      new.id, new.client_id, old.lead_temperature, new.lead_temperature,
      new.temperature_reason, new.temperature_source
    );
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- Part B — grade / status / score / stage transitions
-- ===========================================================================

create table if not exists public.lead_state_events (
  id                    bigserial primary key,
  lead_id               uuid not null references public.leads(id) on delete cascade,
  client_id             uuid,
  changed_at            timestamptz not null default now(),
  change_kind           text not null check (change_kind in ('seed','insert','update')),
  changed_fields        text[] not null default '{}',

  -- state after
  lead_grade            text,
  lead_grade_score      integer,
  status                text,
  status_source         text,
  status_reason         text,
  lead_score            integer,
  conversation_stage    text,

  -- state before (null for seed/insert)
  prev_lead_grade       text,
  prev_lead_grade_score integer,
  prev_status           text,
  prev_lead_score       integer,
  prev_conversation_stage text
);

comment on table public.lead_state_events is
  'Append-only log of lead grade/status/score/stage transitions. Temperature is logged separately in lead_temperature_events. Written only by trg_log_lead_state_event. Capture-only: no application logic reads this yet.';

create index if not exists idx_lead_state_events_lead_changed
  on public.lead_state_events (lead_id, changed_at desc);
create index if not exists idx_lead_state_events_changed_at
  on public.lead_state_events (changed_at desc);
create index if not exists idx_lead_state_events_client
  on public.lead_state_events (client_id, changed_at desc);

create or replace function public.log_lead_state_event()
returns trigger
language plpgsql
as $$
declare
  fields text[] := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.lead_state_events (
      lead_id, client_id, change_kind, changed_fields,
      lead_grade, lead_grade_score, status, status_source, status_reason,
      lead_score, conversation_stage
    ) values (
      new.id, new.client_id, 'insert', '{}',
      new.lead_grade, new.lead_grade_score, new.status, new.status_source,
      new.status_reason, new.lead_score, new.conversation_stage
    );
    return new;
  end if;

  -- UPDATE OF fires when a column appears in SET even if unchanged, so compare
  -- explicitly. IS DISTINCT FROM is null-safe.
  -- array_append, not ||: with an untyped literal the || operator resolves to
  -- anyarray || anyarray and fails with "malformed array literal".
  if new.lead_grade is distinct from old.lead_grade then
    fields := array_append(fields, 'lead_grade'); end if;
  if new.lead_grade_score is distinct from old.lead_grade_score then
    fields := array_append(fields, 'lead_grade_score'); end if;
  if new.status is distinct from old.status then
    fields := array_append(fields, 'status'); end if;
  if new.lead_score is distinct from old.lead_score then
    fields := array_append(fields, 'lead_score'); end if;
  if new.conversation_stage is distinct from old.conversation_stage then
    fields := array_append(fields, 'conversation_stage'); end if;

  if array_length(fields, 1) is null then
    return new;  -- nothing tracked actually changed
  end if;

  insert into public.lead_state_events (
    lead_id, client_id, change_kind, changed_fields,
    lead_grade, lead_grade_score, status, status_source, status_reason,
    lead_score, conversation_stage,
    prev_lead_grade, prev_lead_grade_score, prev_status, prev_lead_score,
    prev_conversation_stage
  ) values (
    new.id, new.client_id, 'update', fields,
    new.lead_grade, new.lead_grade_score, new.status, new.status_source,
    new.status_reason, new.lead_score, new.conversation_stage,
    old.lead_grade, old.lead_grade_score, old.status, old.lead_score,
    old.conversation_stage
  );

  return new;
end;
$$;

drop trigger if exists trg_log_lead_state_event on public.leads;
create trigger trg_log_lead_state_event
  after insert or update of
    lead_grade, lead_grade_score, status, lead_score, conversation_stage
  on public.leads
  for each row
  execute function public.log_lead_state_event();

-- Seed t0 so the series has a baseline for leads that already exist.
insert into public.lead_state_events (
  lead_id, client_id, changed_at, change_kind, changed_fields,
  lead_grade, lead_grade_score, status, status_source, status_reason,
  lead_score, conversation_stage
)
select
  l.id, l.client_id, now(), 'seed', '{}',
  l.lead_grade, l.lead_grade_score, l.status, l.status_source, l.status_reason,
  l.lead_score, l.conversation_stage
from public.leads l
where not exists (
  select 1 from public.lead_state_events e where e.lead_id = l.id
);

-- ===========================================================================
-- Access control — mirrors the existing lead_temperature_events posture
-- ===========================================================================
alter table public.lead_state_events enable row level security;

revoke insert, update, delete on public.lead_state_events from anon, authenticated, public;

-- Supabase grants SELECT to anon by default on new public tables. The RLS policy below
-- already yields zero rows for anon (get_my_client_id() is null), but there is no reason
-- for the grant to exist at all. Stricter than lead_temperature_events by design.
revoke select on public.lead_state_events from anon;
revoke all on sequence public.lead_state_events_id_seq from anon, authenticated, public;

drop policy if exists lead_state_events_select on public.lead_state_events;
create policy lead_state_events_select
  on public.lead_state_events
  for select
  using (
    get_my_role() = 'baymo_admin'
    or (
      client_id = get_my_client_id()
      and (get_my_role() is distinct from 'agent' or lead_assigned_to_me(lead_id))
    )
  );

-- No insert/update/delete policy: only the trigger writes here.
