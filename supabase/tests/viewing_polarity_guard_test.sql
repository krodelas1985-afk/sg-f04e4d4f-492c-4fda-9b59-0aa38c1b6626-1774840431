-- Self-contained test for 20260829120000_viewing_polarity_guard.sql.
--
-- Runs against ANY empty-ish Postgres 17 (a local instance is fine) -- it builds its own
-- stub tables, applies the real migration file, asserts, and ROLLS BACK. It does not need
-- and must not be pointed at production.
--
--   psql -U postgres -h localhost -d postgres -f supabase/tests/viewing_polarity_guard_test.sql
--
-- Every row of the first result set must read PASS.
\set ON_ERROR_STOP on
begin;

-- ---------------------------------------------------------------- stub schema
-- Minimal stand-ins so parts 3 and 4 of the migration parse and execute. Rolled back.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  name text,
  last_inbound_at timestamptz
);
create table public.lead_qualifications (
  lead_id uuid,
  viewing_schedule text
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  lead_id uuid,
  appointment_type text,
  scheduled_at timestamptz not null,
  status text,
  source_text text,
  resolution_confidence text check (resolution_confidence in ('none','low','medium','high')),
  resolved_from text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.viewing_outcome_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique,
  lead_id uuid,
  client_id uuid,
  status text not null default 'pending',
  suppressed_reason text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.lead_viewing_indications (
  id bigserial primary key,
  lead_id uuid,
  appointment_id uuid,
  client_id uuid,
  detected_at timestamptz not null default now(),
  occurred_at timestamptz,
  indication_type text not null,
  polarity text not null check (polarity in ('happened','not_happened','rescheduled','handover','ambiguous')),
  source text not null check (source in ('inferred','deterministic','agent_confirmed','manual')),
  confidence text not null default 'low' check (confidence in ('low','medium','high')),
  evidence_text text,
  conversation_id uuid,
  recorded_by uuid,
  extractor_version text,
  created_at timestamptz not null default now()
);

create or replace function public.viewing_outcome_due_at(p_scheduled timestamptz)
returns timestamptz language sql immutable as $$
  select ((date_trunc('day', p_scheduled at time zone 'Asia/Manila')::date + 1)
          + interval '8 hours') at time zone 'Asia/Manila';
$$;

create or replace function public.create_viewing_outcome_request()
returns trigger language plpgsql as $$
begin
  if new.appointment_type is distinct from 'viewing' then return new; end if;
  insert into public.viewing_outcome_requests
    (appointment_id, lead_id, client_id, status, due_at)
  values (new.id, new.lead_id, new.client_id, 'pending',
          public.viewing_outcome_due_at(new.scheduled_at))
  on conflict (appointment_id) do nothing;
  return new;
end;
$$;
create trigger trg_create_viewing_outcome_request
  after insert on public.appointments
  for each row execute function public.create_viewing_outcome_request();

-- ---------------------------------------------------------------- pre-existing rows
-- Two appointments that look exactly like the ones already in prod: the Carino Elenita
-- shape (negative, medium confidence, pending outcome request) and a healthy one.
insert into public.appointments
  (id, client_id, lead_id, appointment_type, scheduled_at, status, source_text,
   resolution_confidence, resolved_from, title)
values
  ('11111111-1111-1111-1111-111111111111', gen_random_uuid(), gen_random_uuid(), 'viewing',
   now(), 'scheduled',
   'not available this weekend due to anniversary and family gatherings',
   'medium', 'conversation', 'Viewing - Carino Elenita'),
  ('22222222-2222-2222-2222-222222222222', gen_random_uuid(), gen_random_uuid(), 'viewing',
   now(), 'scheduled', 'sige po, bukas 3pm', 'high', 'conversation', 'Viewing - real');

\echo '--- applying migration ---'
\i supabase/migrations/20260829120000_viewing_polarity_guard.sql
\echo '--- migration applied ---'

-- ---------------------------------------------------------------- classifier cases
select expect, got, case when expect = got then 'PASS' else '*** FAIL ***' end as result, txt
from (
  values
    -- the reported case
    ('negative','not available this weekend due to anniversary and family gatherings'),
    -- other declines that the old keyword list also missed
    ('negative','not available'),
    ('negative','I can''t this Saturday'),
    ('negative','cannot make it tomorrow'),
    ('negative','unavailable until next month'),
    ('negative','no time this week'),
    ('negative','sorry po, may lakad kami bukas'),
    ('negative','out of town this weekend'),
    ('negative','maybe next time na lang po'),
    -- declines the old list already caught
    ('negative','busy with work'),
    ('negative','malabo kami makabisita'),
    ('negative','hindi po ako pwede'),
    ('negative','wala akong oras ngayon'),
    -- real bookings must survive untouched
    ('neutral','bukas po 4pm'),
    ('affirmative','sige po, Saturday morning'),
    ('affirmative','pwede po ako this weekend'),
    ('neutral','August 15 or 16 po'),
    ('affirmative','ok lang po sa akin mamaya'),
    ('affirmative','see you tomorrow po'),
    ('affirmative','confirmed po, Sunday 10am'),
    -- "no problem" must not read as a refusal
    ('neutral','no problem po, bukas'),
    -- counter-offers: refusal AND agreement
    ('mixed','hindi ako pwede Sabado, pero Linggo po pwede'),
    ('mixed','can''t Saturday but Sunday is ok'),
    -- real bookings phrased with a negation-adjacent idiom must NOT be refused
    ('neutral','Sabado na lang po'),
    ('affirmative','can''t wait to see it, pwede po bukas'),
    -- neither
    ('neutral','Vc pqpo'),
    ('neutral','')
) as t(expect, txt)
cross join lateral (select public.viewing_text_polarity(t.txt) as got) g
order by (expect = got), expect;

\echo ''
\echo '--- resolver: the reported case, anchored to a Thursday ---'
select scheduled_at, confidence
from public.resolve_viewing_datetime(
  'not available this weekend due to anniversary and family gatherings',
  '2026-08-27 09:00+08'::timestamptz);

\echo '--- resolver: genuine bookings still resolve ---'
select t.txt, r.scheduled_at at time zone 'Asia/Manila' as manila, r.confidence
from (values ('bukas po 4pm'), ('sige po, Saturday morning'), ('August 15 or 16 po'),
             ('pwede po ako this weekend')) t(txt)
cross join lateral public.resolve_viewing_datetime(t.txt, '2026-08-27 09:00+08'::timestamptz) r;

\echo ''
\echo '--- sweep result on the two pre-existing appointments ---'
select a.title, a.source_text, r.status, left(r.suppressed_reason, 60) as reason
from public.appointments a
join public.viewing_outcome_requests r on r.appointment_id = a.id
order by a.title;

select indication_type, polarity, source, confidence, left(evidence_text, 40) as evidence
from public.lead_viewing_indications;

\echo ''
\echo '--- ensure_viewing_appointment: live path ---'
insert into public.leads (id, client_id, name, last_inbound_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'Declining Lead',  now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', gen_random_uuid(), 'Booking Lead',    now()),
  ('aaaaaaaa-0000-0000-0000-000000000003', gen_random_uuid(), 'Counteroffer Lead', now());
insert into public.lead_qualifications (lead_id, viewing_schedule) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'not available this weekend due to anniversary and family gatherings'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'sige po bukas 3pm'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'hindi ako pwede Sabado, pero Linggo po pwede');

select l.name,
       public.ensure_viewing_appointment(l.id) is not null as appointment_created
from public.leads l
where l.id in ('aaaaaaaa-0000-0000-0000-000000000001',
               'aaaaaaaa-0000-0000-0000-000000000002',
               'aaaaaaaa-0000-0000-0000-000000000003')
order by l.name;

select l.name, a.resolution_confidence, r.status, left(r.suppressed_reason, 50) as reason
from public.leads l
join public.appointments a on a.lead_id = l.id
join public.viewing_outcome_requests r on r.appointment_id = a.id
order by l.name;

select l.name, i.indication_type, i.polarity, i.source
from public.leads l join public.lead_viewing_indications i on i.lead_id = l.id
order by l.name;

\echo ''
\echo '--- re-running must not duplicate the declined indication ---'
select public.ensure_viewing_appointment('aaaaaaaa-0000-0000-0000-000000000001'::uuid);
select count(*) as declined_indications_for_lead1
from public.lead_viewing_indications
where lead_id = 'aaaaaaaa-0000-0000-0000-000000000001';

rollback;
