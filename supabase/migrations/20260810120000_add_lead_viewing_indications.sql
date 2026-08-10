-- Phase 1 — viewing outcome capture, data layer.
--
-- Records *indications* that a viewing happened. Never a fact, never a boolean.
-- Nothing reads these yet; no rubric, notification or temperature logic is touched.
--
-- Context (verified 2026-08-10):
--   * Agents take a lead over completely once a viewing is arranged — the exchange moves to
--     the agent's personal Messenger. All 35 leads at status='Viewing' have ZERO inbound
--     messages afterwards, despite agents sending up to 8 follow-ups each.
--   * This is expected behaviour (the "total takeover"), not a defect. It does mean the
--     agent is the only party who can confirm what happened.
--   * The handover itself IS observable in-channel and is recorded as an indication.

-- ===========================================================================
-- Part A — appointments gain provenance for the free-text they came from
-- ===========================================================================
alter table public.appointments
  add column if not exists source_text            text,
  add column if not exists resolution_confidence  text
    check (resolution_confidence in ('low','medium','high')),
  add column if not exists resolved_from          text
    check (resolved_from in ('viewing_schedule','conversation','agent','manual'));

comment on column public.appointments.source_text is
  'Verbatim free text the appointment was resolved from, e.g. "bukas", "after church po kaya tomorrow". Kept so a bad resolution is auditable.';
comment on column public.appointments.resolution_confidence is
  'How confident the date resolution is. "bukas" anchored to a known message date is high; "next week" is low.';

-- ===========================================================================
-- Part B — the indications table
-- ===========================================================================
create table if not exists public.lead_viewing_indications (
  id                bigserial primary key,
  lead_id           uuid not null references public.leads(id) on delete cascade,
  appointment_id    uuid references public.appointments(id) on delete set null,
  client_id         uuid,

  detected_at       timestamptz not null default now(),
  occurred_at       timestamptz,          -- when the indicated event happened, if known

  indication_type   text not null,
  polarity          text not null
    check (polarity in ('happened','not_happened','rescheduled','handover','ambiguous')),
  source            text not null
    check (source in ('inferred','deterministic','agent_confirmed','manual')),
  confidence        text not null default 'low'
    check (confidence in ('low','medium','high')),

  evidence_text     text,                 -- verbatim snippet, or the agent's selection
  conversation_id   uuid references public.conversations(id) on delete set null,
  recorded_by       uuid references public.profiles(id) on delete set null,
  extractor_version text,

  created_at        timestamptz not null default now()
);

comment on table public.lead_viewing_indications is
  'Append-only indications that a viewing did or did not happen. Deliberately NOT a verdict: rows may disagree, and the disagreement is kept. Nothing reads this yet.';
comment on column public.lead_viewing_indications.polarity is
  'happened | not_happened | rescheduled | handover | ambiguous. "handover" = agent took the lead over (conversation left BaMo''s channel), which is progression but not proof of a viewing.';
comment on column public.lead_viewing_indications.source is
  'How we learned it. agent_confirmed is the only authoritative source; deterministic and inferred are corroboration.';

create index if not exists idx_lvi_lead        on public.lead_viewing_indications (lead_id, detected_at desc);
create index if not exists idx_lvi_appointment on public.lead_viewing_indications (appointment_id, detected_at desc);
create index if not exists idx_lvi_client      on public.lead_viewing_indications (client_id, detected_at desc);
create index if not exists idx_lvi_polarity    on public.lead_viewing_indications (polarity, source);

-- One agent confirmation per appointment per outcome — clicking the same link twice must
-- not double-count. Partial unique index: applies only to agent_confirmed rows.
create unique index if not exists uq_lvi_agent_confirm_per_appointment
  on public.lead_viewing_indications (appointment_id, polarity)
  where source = 'agent_confirmed' and appointment_id is not null;

-- ===========================================================================
-- Part C — rollup view. Presents the evidence; does NOT resolve it.
-- ===========================================================================
create or replace view public.v_lead_viewing_indication_summary as
select
  i.lead_id,
  i.appointment_id,
  (array_agg(i.client_id order by i.detected_at))[1] as client_id,

  count(*) as indication_count,

  count(*) filter (where i.polarity = 'happened')      as n_happened,
  count(*) filter (where i.polarity = 'not_happened')  as n_not_happened,
  count(*) filter (where i.polarity = 'rescheduled')   as n_rescheduled,
  count(*) filter (where i.polarity = 'handover')      as n_handover,
  count(*) filter (where i.polarity = 'ambiguous')     as n_ambiguous,

  count(*) filter (where i.source = 'agent_confirmed') as n_agent_confirmed,
  count(*) filter (where i.source = 'deterministic')   as n_deterministic,
  count(*) filter (where i.source = 'inferred')        as n_inferred,

  -- the agent's answer, if there is one. Deliberately exposed on its own so a consumer can
  -- filter to confirmed-only without re-deriving it.
  (array_agg(i.polarity order by i.detected_at desc)
     filter (where i.source = 'agent_confirmed'))[1]   as agent_verdict,
  (array_agg(i.detected_at order by i.detected_at desc)
     filter (where i.source = 'agent_confirmed'))[1]   as agent_verdict_at,

  -- do the indications disagree? A flag, not a resolution.
  (count(*) filter (where i.polarity = 'happened') > 0
   and count(*) filter (where i.polarity = 'not_happened') > 0) as conflicting,

  min(i.detected_at) as first_indication_at,
  max(i.detected_at) as last_indication_at,
  max(i.occurred_at) as latest_occurred_at
from public.lead_viewing_indications i
group by i.lead_id, i.appointment_id;

comment on view public.v_lead_viewing_indication_summary is
  'Per lead/appointment rollup of viewing indications. Counts by polarity and source, the agent verdict if given, and a conflicting flag. Presents evidence without deciding.';

-- ===========================================================================
-- Access control
-- ===========================================================================
alter table public.lead_viewing_indications enable row level security;

revoke insert, update, delete on public.lead_viewing_indications from anon, authenticated, public;
revoke select on public.lead_viewing_indications from anon;
revoke all on sequence public.lead_viewing_indications_id_seq from anon, authenticated, public;

drop policy if exists lvi_select on public.lead_viewing_indications;
create policy lvi_select
  on public.lead_viewing_indications
  for select
  using (
    get_my_role() = 'baymo_admin'
    or (
      client_id = get_my_client_id()
      and (get_my_role() is distinct from 'agent' or lead_assigned_to_me(lead_id))
    )
  );

-- Writes come from the one-click endpoint (service role) and later extractors.
-- No insert policy is granted to end users.

alter view public.v_lead_viewing_indication_summary set (security_invoker = on);
revoke all on public.v_lead_viewing_indication_summary from anon, public;
grant select on public.v_lead_viewing_indication_summary to authenticated;
