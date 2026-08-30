-- Phase 2 — the prep reminder carries the confirmation, and the outcome email waits for it.
--
-- Kathy, 2026-08-31, on what should happen when the agent never answers the reminder:
-- stay silent. No confirmation, no outcome email. Ever.
--
-- WHY THE CONFIRMATION CANNOT LIVE ON THE OUTCOME EMAIL
-- The one-click tokens are minted when the outcome email is sent, so "only ask about
-- viewings the agent confirmed" is circular if the confirmation has to come from that
-- same email: no email, no link, no confirmation, no email. The prep reminder added in
-- 20260831100000 breaks the loop by asking the day before, while there is still something
-- to confirm.
--
-- THE VOCABULARY, AND WHY ONLY ONE NEW POLARITY
-- The three buttons map onto polarities that mostly already exist:
--   "Going ahead"   -> confirmed_upcoming  (NEW - the only value added here)
--   "Not happening" -> not_happened        (existing)
--   "Rescheduled"   -> rescheduled         (existing)
-- The last two already close the request through trg_close_viewing_outcome_request, which
-- is exactly what we want: nothing further is asked. Only confirmed_upcoming needed
-- inventing, because it is the one answer that must NOT close the request -- it opens it.
--
-- ⚠️ That trigger is the trap in this change. close_viewing_outcome_request() fires on ANY
-- agent_confirmed indication, so without the exclusion below, tapping "Going ahead" would
-- immediately mark the request answered and kill the very email it is meant to unlock.

-- ---------------------------------------------------------------------------
-- Vocabulary
-- ---------------------------------------------------------------------------
alter table public.lead_viewing_indications
  drop constraint if exists lead_viewing_indications_polarity_check;

alter table public.lead_viewing_indications
  add constraint lead_viewing_indications_polarity_check
  check (polarity in ('happened','not_happened','rescheduled','handover','ambiguous','confirmed_upcoming'));

-- Tokens now come in two kinds. Defaulting to 'outcome' keeps every existing row correct.
alter table public.viewing_outcome_tokens
  add column if not exists kind text not null default 'outcome';

alter table public.viewing_outcome_tokens
  drop constraint if exists viewing_outcome_tokens_kind_check;

alter table public.viewing_outcome_tokens
  add constraint viewing_outcome_tokens_kind_check check (kind in ('outcome','prep'));

comment on column public.viewing_outcome_tokens.kind is
  'outcome = the "how did it go?" links sent after the viewing. prep = the "is this going ahead?" links sent the day before. Kept apart so a token for one can never be redeemed as the other, and so an unused token of one kind does not block minting the other.';

-- ---------------------------------------------------------------------------
-- Existing token functions become kind-aware.
--
-- The scoping is not cosmetic: mint_viewing_outcome_tokens refuses to mint while an
-- unused token exists for the recipient. Without "and kind = 'outcome'", the prep token
-- minted the day before would still be unused and would block the outcome token entirely.
-- ---------------------------------------------------------------------------
create or replace function public.mint_viewing_outcome_tokens(p_request_id uuid)
returns table(profile_id uuid, email text, token text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  return query
  with r as (
    select vr.id, vr.client_id, l.assigned_user_id
    from public.viewing_outcome_requests vr
    join public.leads l on l.id = vr.lead_id
    where vr.id = p_request_id
  ),
  recips as (
    select p.id, p.email from r
    join public.resolve_lead_recipients(r.client_id, r.assigned_user_id) rr on true
    join public.profiles p on p.id = rr
    where p.is_active and p.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
  ),
  ins as (
    insert into public.viewing_outcome_tokens (request_id, profile_id, email, token, kind)
    select p_request_id, recips.id, recips.email,
           replace(gen_random_uuid()::text, '-', '') ||
           replace(gen_random_uuid()::text, '-', ''),
           'outcome'
    from recips
    where not exists (
      select 1 from public.viewing_outcome_tokens t
      where t.request_id = p_request_id and t.profile_id = recips.id
        and t.used_at is null and t.kind = 'outcome'
    )
    returning viewing_outcome_tokens.profile_id, viewing_outcome_tokens.email,
              viewing_outcome_tokens.token
  )
  select * from ins;
end;
$fn$;

-- Same shape, for the day-before links.
create or replace function public.mint_viewing_prep_tokens(p_request_id uuid)
returns table(profile_id uuid, email text, token text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  return query
  with r as (
    select vr.id, vr.client_id, l.assigned_user_id
    from public.viewing_outcome_requests vr
    join public.leads l on l.id = vr.lead_id
    where vr.id = p_request_id
  ),
  recips as (
    select p.id, p.email from r
    join public.resolve_lead_recipients(r.client_id, r.assigned_user_id) rr on true
    join public.profiles p on p.id = rr
    where p.is_active and p.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
  ),
  ins as (
    insert into public.viewing_outcome_tokens (request_id, profile_id, email, token, kind)
    select p_request_id, recips.id, recips.email,
           replace(gen_random_uuid()::text, '-', '') ||
           replace(gen_random_uuid()::text, '-', ''),
           'prep'
    from recips
    where not exists (
      select 1 from public.viewing_outcome_tokens t
      where t.request_id = p_request_id and t.profile_id = recips.id
        and t.used_at is null and t.kind = 'prep'
    )
    returning viewing_outcome_tokens.profile_id, viewing_outcome_tokens.email,
              viewing_outcome_tokens.token
  )
  select * from ins;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Redeem / peek for the outcome links, now refusing prep tokens.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_viewing_outcome_token(
  p_token text, p_polarity text, p_ip text default null)
returns table(status text, lead_name text, scheduled_at timestamptz, recorded_polarity text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  tok public.viewing_outcome_tokens%rowtype;
  req public.viewing_outcome_requests%rowtype;
  lnm text; sch timestamptz;
begin
  if p_polarity not in ('happened','not_happened','rescheduled','ambiguous') then
    return query select 'invalid'::text, null::text, null::timestamptz, null::text; return;
  end if;

  select * into tok from public.viewing_outcome_tokens
   where token = p_token and kind = 'outcome';
  if not found then
    return query select 'invalid'::text, null::text, null::timestamptz, null::text; return;
  end if;

  if tok.expires_at < now() then
    return query select 'expired'::text, null::text, null::timestamptz, null::text; return;
  end if;

  select * into req from public.viewing_outcome_requests where id = tok.request_id;

  select coalesce(nullif(btrim(l.name), ''), 'this lead'), a.scheduled_at into lnm, sch
  from public.leads l
  join public.appointments a on a.id = req.appointment_id
  where l.id = req.lead_id;

  if exists (
    select 1 from public.lead_viewing_indications i
    where i.appointment_id = req.appointment_id
      and i.source = 'agent_confirmed' and i.polarity = p_polarity
  ) then
    return query select 'already'::text, lnm, sch, p_polarity; return;
  end if;

  if req.status = 'answered' then
    return query select 'answered'::text, lnm, sch,
      (select i.polarity from public.lead_viewing_indications i
        where i.appointment_id = req.appointment_id and i.source = 'agent_confirmed'
          and i.polarity <> 'confirmed_upcoming'
        order by i.detected_at desc limit 1);
    return;
  end if;

  if tok.used_at is not null then
    return query select 'used'::text, lnm, sch, null::text; return;
  end if;

  insert into public.lead_viewing_indications
    (lead_id, appointment_id, client_id, indication_type, polarity, source, confidence,
     evidence_text, recorded_by, extractor_version)
  values
    (req.lead_id, req.appointment_id, req.client_id, 'agent_outcome_click',
     p_polarity, 'agent_confirmed', 'high',
     'agent tapped "' || p_polarity || '" in the outcome email',
     tok.profile_id, 'one-click-v1');

  update public.viewing_outcome_tokens
     set used_at = now(), used_ip = p_ip
   where id = tok.id;

  return query select 'ok'::text, lnm, sch, p_polarity;
end;
$fn$;

create or replace function public.peek_viewing_outcome_token(p_token text, p_polarity text)
returns table(status text, lead_name text, scheduled_at timestamptz, source_text text,
              date_known boolean, recorded_polarity text)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  tok public.viewing_outcome_tokens%rowtype;
  req public.viewing_outcome_requests%rowtype;
  lnm text; sch timestamptz; src text; dk boolean;
begin
  if p_polarity not in ('happened','not_happened','rescheduled','ambiguous') then
    return query select 'invalid'::text, null::text, null::timestamptz, null::text, null::boolean, null::text;
    return;
  end if;

  select * into tok from public.viewing_outcome_tokens
   where token = p_token and kind = 'outcome';
  if not found then
    return query select 'invalid'::text, null::text, null::timestamptz, null::text, null::boolean, null::text;
    return;
  end if;

  if tok.expires_at < now() then
    return query select 'expired'::text, null::text, null::timestamptz, null::text, null::boolean, null::text;
    return;
  end if;

  select * into req from public.viewing_outcome_requests where id = tok.request_id;

  select coalesce(nullif(btrim(l.name), ''), 'this lead'),
         a.scheduled_at, a.source_text,
         (a.resolution_confidence is distinct from 'none')
    into lnm, sch, src, dk
  from public.leads l
  join public.appointments a on a.id = req.appointment_id
  where l.id = req.lead_id;

  if exists (
    select 1 from public.lead_viewing_indications i
    where i.appointment_id = req.appointment_id
      and i.source = 'agent_confirmed' and i.polarity = p_polarity
  ) then
    return query select 'already'::text, lnm, sch, src, dk, p_polarity;
    return;
  end if;

  if req.status = 'answered' then
    return query select 'answered'::text, lnm, sch, src, dk,
      (select i.polarity from public.lead_viewing_indications i
        where i.appointment_id = req.appointment_id and i.source = 'agent_confirmed'
          and i.polarity <> 'confirmed_upcoming'
        order by i.detected_at desc limit 1);
    return;
  end if;

  if tok.used_at is not null then
    return query select 'used'::text, lnm, sch, src, dk, null::text;
    return;
  end if;

  return query select 'valid'::text, lnm, sch, src, dk, null::text;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Redeem for the day-before links.
--
-- p_answer is the button, not the stored polarity, because "not happening" is a statement
-- about the future while not_happened reads as the past. The mapping is here so the email
-- and the landing page can speak in future tense.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_viewing_prep_token(
  p_token text, p_answer text, p_ip text default null)
returns table(status text, lead_name text, scheduled_at timestamptz, recorded_answer text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  tok public.viewing_outcome_tokens%rowtype;
  req public.viewing_outcome_requests%rowtype;
  lnm text; sch timestamptz; pol text;
begin
  pol := case p_answer
           when 'going_ahead'   then 'confirmed_upcoming'
           when 'not_happening' then 'not_happened'
           when 'rescheduled'   then 'rescheduled'
         end;

  if pol is null then
    return query select 'invalid'::text, null::text, null::timestamptz, null::text; return;
  end if;

  select * into tok from public.viewing_outcome_tokens
   where token = p_token and kind = 'prep';
  if not found then
    return query select 'invalid'::text, null::text, null::timestamptz, null::text; return;
  end if;

  if tok.expires_at < now() then
    return query select 'expired'::text, null::text, null::timestamptz, null::text; return;
  end if;

  select * into req from public.viewing_outcome_requests where id = tok.request_id;

  select coalesce(nullif(btrim(l.name), ''), 'this lead'), a.scheduled_at into lnm, sch
  from public.leads l
  join public.appointments a on a.id = req.appointment_id
  where l.id = req.lead_id;

  if exists (
    select 1 from public.lead_viewing_indications i
    where i.appointment_id = req.appointment_id
      and i.source = 'agent_confirmed' and i.polarity = pol
  ) then
    return query select 'already'::text, lnm, sch, p_answer; return;
  end if;

  if tok.used_at is not null then
    return query select 'used'::text, lnm, sch, null::text; return;
  end if;

  insert into public.lead_viewing_indications
    (lead_id, appointment_id, client_id, indication_type, polarity, source, confidence,
     evidence_text, recorded_by, extractor_version)
  values
    (req.lead_id, req.appointment_id, req.client_id, 'agent_prep_click',
     pol, 'agent_confirmed', 'high',
     'agent tapped "' || p_answer || '" in the day-before reminder',
     tok.profile_id, 'prep-confirm-v1');

  update public.viewing_outcome_tokens
     set used_at = now(), used_ip = p_ip
   where id = tok.id;

  return query select 'ok'::text, lnm, sch, p_answer;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- ⚠️ The trap. Without the confirmed_upcoming exclusion, tapping "Going ahead" would mark
-- the request answered and suppress the outcome email it is supposed to unlock.
-- not_happened and rescheduled still close it, which is the desired end state for both.
-- ---------------------------------------------------------------------------
create or replace function public.close_viewing_outcome_request()
returns trigger
language plpgsql
as $fn$
begin
  if new.source = 'agent_confirmed'
     and new.polarity is distinct from 'confirmed_upcoming'
     and new.appointment_id is not null then
    update public.viewing_outcome_requests
       set status = 'answered', answered_at = coalesce(answered_at, now()), updated_at = now()
     where appointment_id = new.appointment_id and status <> 'answered';
  end if;
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- The gate itself.
--
-- Only the first send is gated. A row at status='sent' already cleared the gate, so the
-- chase-up for an unanswered outcome email is left exactly as it was.
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
as $fn$
  select
    r.id, r.appointment_id, r.lead_id, r.client_id,
    case when r.status = 'pending' then 'first' else 'reminder' end,
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
  where (
      (r.status = 'pending' and r.due_at <= now()
        and exists (
          select 1 from public.lead_viewing_indications i
           where i.appointment_id = r.appointment_id
             and i.source = 'agent_confirmed'
             and i.polarity = 'confirmed_upcoming'))
   or (r.status = 'sent'    and r.reminder_due_at <= now())
  )
  order by coalesce(r.reminder_due_at, r.due_at)
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$fn$;

comment on function public.pending_viewing_outcome_emails(int) is
  'Outcome emails due to send. Since 2026-08-31 a first send also requires an agent_confirmed confirmed_upcoming indication -- the agent tapping "Going ahead" in the day-before reminder. No confirmation means no outcome email, which is the point: it stops BaMo asking how a viewing went when the viewing was only ever inferred from the lead.';

-- ---------------------------------------------------------------------------
-- Sweep. Unconfirmed requests would otherwise sit at pending forever, and every one of
-- them keeps its row visible to any future query that forgets the gate.
-- ---------------------------------------------------------------------------
create or replace function public.expire_unconfirmed_viewing_requests()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  n integer;
begin
  update public.viewing_outcome_requests r
     set status = 'expired',
         suppressed_reason = 'no agent confirmation before the viewing',
         updated_at = now()
    from public.appointments a
   where a.id = r.appointment_id
     and r.status = 'pending'
     and a.scheduled_at < now() - interval '2 days'
     and not exists (
       select 1 from public.lead_viewing_indications i
        where i.appointment_id = r.appointment_id
          and i.source = 'agent_confirmed'
          and i.polarity = 'confirmed_upcoming');
  get diagnostics n = row_count;
  return n;
end;
$fn$;

comment on function public.expire_unconfirmed_viewing_requests() is
  'Moves pending requests to expired once the viewing is 2 days past with no "Going ahead" confirmation. Run alongside the daily sender.';

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------
revoke all on function public.mint_viewing_prep_tokens(uuid)                    from anon, public;
revoke all on function public.redeem_viewing_prep_token(text, text, text)       from anon, public;
revoke all on function public.expire_unconfirmed_viewing_requests()             from anon, public;
