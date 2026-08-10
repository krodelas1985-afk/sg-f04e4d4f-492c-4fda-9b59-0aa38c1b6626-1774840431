-- Won/Lost capture — the outcome half that viewing outcomes don't answer.
--
-- leads.status already allows 'Won' and 'Lost'; the constraint has carried both all along.
-- What's missing is why a lead was lost, and any low-friction way to record it. Result:
-- 1 Won and 0 Lost across 1,083 leads, so no signal can ever be correlated with revenue.
--
-- This adds the vocabulary and the write path. It deliberately does NOT auto-derive Lost
-- from dormancy or from detected objections — that is a policy decision (master table
-- #44-#53) and we are still in capture-only mode.

-- ---------------------------------------------------------------------------
-- Vocabulary. Grounded in reasons actually seen in transcripts on 2026-08-10 rather
-- than invented: "Mahal pala" (too_expensive), "nakahanap na po kami" (bought_elsewhere),
-- "malayo pala" (too_far), "pang rental lang po" (not_a_buyer).
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists lost_reason text;

alter table public.leads
  drop constraint if exists leads_lost_reason_chk;
alter table public.leads
  add constraint leads_lost_reason_chk check (
    lost_reason is null or lost_reason in (
      'too_expensive',     -- price beyond reach ("mahal pala", "hindi kakayanin")
      'cannot_finance',    -- Pag-IBIG / bank declined, or no borrowing capacity
      'bought_elsewhere',  -- committed to another property ("nakahanap na po kami")
      'too_far',           -- location rejected ("malayo pala")
      'not_a_buyer',       -- renter, broker, student, browsing ("pang rental lang po")
      'wrong_inventory',   -- wanted something the client does not offer
      'timing',            -- real interest, but deferred indefinitely
      'unreachable',       -- went silent and never came back
      'other'
    )
  );

comment on column public.leads.lost_reason is
  'Why a Lost lead was lost. Constrained vocabulary; free-text colour goes in status_reason. Only meaningful when status = Lost — enforced by trg_enforce_lost_reason.';

-- ---------------------------------------------------------------------------
-- A lost_reason on a lead that is not Lost is noise, and a Lost lead that keeps its
-- reason after being revived is worse — it would read as a live loss. Clear it on exit.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_lost_reason()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from 'Lost' then
    new.lost_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_lost_reason on public.leads;
create trigger trg_enforce_lost_reason
  before insert or update of status, lost_reason on public.leads
  for each row
  execute function public.enforce_lost_reason();

-- ---------------------------------------------------------------------------
-- Record the reason on the transition too, so history answers "why did this go Lost"
-- without needing the lead's current row. Same principle that was missing from
-- lead_temperature_events until today.
-- ---------------------------------------------------------------------------
alter table public.lead_state_events
  add column if not exists lost_reason      text,
  add column if not exists prev_lost_reason text;

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
      lead_score, conversation_stage, lost_reason
    ) values (
      new.id, new.client_id, 'insert', '{}',
      new.lead_grade, new.lead_grade_score, new.status, new.status_source,
      new.status_reason, new.lead_score, new.conversation_stage, new.lost_reason
    );
    return new;
  end if;

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
  if new.lost_reason is distinct from old.lost_reason then
    fields := array_append(fields, 'lost_reason'); end if;

  if array_length(fields, 1) is null then
    return new;
  end if;

  insert into public.lead_state_events (
    lead_id, client_id, change_kind, changed_fields,
    lead_grade, lead_grade_score, status, status_source, status_reason,
    lead_score, conversation_stage, lost_reason,
    prev_lead_grade, prev_lead_grade_score, prev_status, prev_lead_score,
    prev_conversation_stage, prev_lost_reason
  ) values (
    new.id, new.client_id, 'update', fields,
    new.lead_grade, new.lead_grade_score, new.status, new.status_source,
    new.status_reason, new.lead_score, new.conversation_stage, new.lost_reason,
    old.lead_grade, old.lead_grade_score, old.status, old.lead_score,
    old.conversation_stage, old.lost_reason
  );

  return new;
end;
$$;

-- lost_reason must be in the trigger's UPDATE OF list or a reason-only change is invisible.
drop trigger if exists trg_log_lead_state_event on public.leads;
create trigger trg_log_lead_state_event
  after insert or update of
    lead_grade, lead_grade_score, status, lead_score, conversation_stage, lost_reason
  on public.leads
  for each row
  execute function public.log_lead_state_event();

-- ---------------------------------------------------------------------------
-- Single write path, so every caller (one-click endpoint, CRM, mobile) validates the
-- same way and records who did it.
-- ---------------------------------------------------------------------------
create or replace function public.set_lead_disposition(
  p_lead_id     uuid,
  p_disposition text,               -- 'Won' | 'Lost'
  p_lost_reason text default null,
  p_recorded_by uuid default null,
  p_note        text default null
)
returns table (status text, lead_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  lnm text;
begin
  if p_disposition not in ('Won','Lost') then
    return query select 'invalid_disposition'::text, null::text; return;
  end if;

  if p_disposition = 'Lost' and p_lost_reason is null then
    return query select 'reason_required'::text, null::text; return;
  end if;

  select coalesce(nullif(btrim(name), ''), 'this lead') into lnm
  from public.leads where id = p_lead_id;

  if lnm is null then
    return query select 'not_found'::text, null::text; return;
  end if;

  update public.leads
     set status            = p_disposition,
         lost_reason       = case when p_disposition = 'Lost' then p_lost_reason else null end,
         status_source     = 'manual',
         status_reason     = coalesce(p_note, status_reason),
         status_updated_at = now(),
         updated_at        = now()
   where id = p_lead_id;

  return query select 'ok'::text, lnm;
end;
$$;

comment on function public.set_lead_disposition(uuid, text, text, uuid, text) is
  'Single write path for Won/Lost. Requires a lost_reason when marking Lost. Sets status_source=manual so the deterministic backstops do not overwrite it.';

revoke all on function public.set_lead_disposition(uuid, text, text, uuid, text)
  from anon, authenticated, public;
