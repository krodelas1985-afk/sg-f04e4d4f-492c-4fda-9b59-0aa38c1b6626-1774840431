-- Phase 1 Step 2 — one-click tokens.
--
-- One token per (request, recipient). The sender mints a row per person it emails, so the
-- link identifies WHO answered, not just that someone did — which is what makes
-- recorded_by meaningful once a workspace has more than one agent.
--
-- Deliberately a stored random token rather than an HMAC: no shared secret to keep in sync
-- between the endpoint and n8n, individually revocable, and expiry lives with the row.

create table if not exists public.viewing_outcome_tokens (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.viewing_outcome_requests(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete set null,
  email       text,
  token       text not null unique,
  expires_at  timestamptz not null default (now() + interval '30 days'),
  used_at     timestamptz,
  used_ip     text,
  created_at  timestamptz not null default now()
);

comment on table public.viewing_outcome_tokens is
  'Per-recipient one-click tokens for the viewing outcome email. Resolves recorded_by on the indication row. Single-use: used_at is stamped on first successful record.';

create index if not exists idx_vot_request on public.viewing_outcome_tokens (request_id);
create unique index if not exists uq_vot_token on public.viewing_outcome_tokens (token);

-- ---------------------------------------------------------------------------
-- Mint tokens for a request, one per recipient profile. Returns what to put in the email.
-- ---------------------------------------------------------------------------
create or replace function public.mint_viewing_outcome_tokens(p_request_id uuid)
returns table (profile_id uuid, email text, token text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with r as (
    select vr.id, vr.client_id, l.assigned_user_id
    from public.viewing_outcome_requests vr
    join public.leads l on l.id = vr.lead_id
    where vr.id = p_request_id
  ),
  recips as (
    select p.id, p.email
    from r
    join public.resolve_lead_recipients(r.client_id, r.assigned_user_id) rr on true
    join public.profiles p on p.id = rr
    where p.is_active
      and p.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
  ),
  ins as (
    insert into public.viewing_outcome_tokens (request_id, profile_id, email, token)
    -- Two gen_random_uuid()s rather than pgcrypto's gen_random_bytes: pgcrypto lives in the
    -- extensions schema, which is not on this function's search_path. gen_random_uuid is
    -- built in from PG13 and CSPRNG-backed; 64 hex chars is ample for a link token.
    select p_request_id, recips.id, recips.email,
           replace(gen_random_uuid()::text, '-', '') ||
           replace(gen_random_uuid()::text, '-', '')
    from recips
    where not exists (
      select 1 from public.viewing_outcome_tokens t
      where t.request_id = p_request_id and t.profile_id = recips.id and t.used_at is null
    )
    returning viewing_outcome_tokens.profile_id, viewing_outcome_tokens.email,
              viewing_outcome_tokens.token
  )
  select * from ins;
end;
$$;

-- ---------------------------------------------------------------------------
-- Redeem a token. Single entry point for the endpoint — all validation lives here so the
-- API route cannot get it subtly wrong.
--
-- Returns a status string:
--   ok             — recorded
--   already        — this outcome was already recorded (idempotent replay)
--   answered       — someone else already answered this request
--   invalid        — no such token
--   expired        — past expires_at
--   used           — token already spent on a different outcome
-- ---------------------------------------------------------------------------
create or replace function public.redeem_viewing_outcome_token(
  p_token    text,
  p_polarity text,
  p_ip       text default null
)
returns table (status text, lead_name text, scheduled_at timestamptz, recorded_polarity text)
language plpgsql
security definer
set search_path = public
as $$
declare
  tok  public.viewing_outcome_tokens%rowtype;
  req  public.viewing_outcome_requests%rowtype;
  lnm  text;
  sch  timestamptz;
begin
  if p_polarity not in ('happened','not_happened','rescheduled','ambiguous') then
    return query select 'invalid'::text, null::text, null::timestamptz, null::text;
    return;
  end if;

  select * into tok from public.viewing_outcome_tokens where token = p_token;
  if not found then
    return query select 'invalid'::text, null::text, null::timestamptz, null::text;
    return;
  end if;

  if tok.expires_at < now() then
    return query select 'expired'::text, null::text, null::timestamptz, null::text;
    return;
  end if;

  select * into req from public.viewing_outcome_requests where id = tok.request_id;

  select coalesce(nullif(btrim(l.name), ''), 'this lead'), a.scheduled_at
    into lnm, sch
  from public.leads l
  join public.appointments a on a.id = req.appointment_id
  where l.id = req.lead_id;

  -- already recorded this exact outcome -> idempotent, report success
  if exists (
    select 1 from public.lead_viewing_indications i
    where i.appointment_id = req.appointment_id
      and i.source = 'agent_confirmed'
      and i.polarity = p_polarity
  ) then
    return query select 'already'::text, lnm, sch, p_polarity;
    return;
  end if;

  -- a different outcome is already on file
  if req.status = 'answered' then
    return query select 'answered'::text, lnm, sch,
      (select i.polarity from public.lead_viewing_indications i
        where i.appointment_id = req.appointment_id and i.source = 'agent_confirmed'
        order by i.detected_at desc limit 1);
    return;
  end if;

  if tok.used_at is not null then
    return query select 'used'::text, lnm, sch, null::text;
    return;
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

  -- request is closed by trg_close_viewing_outcome_request on the insert above
  return query select 'ok'::text, lnm, sch, p_polarity;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access control. Both functions are service-role only; the endpoint holds that key.
-- ---------------------------------------------------------------------------
alter table public.viewing_outcome_tokens enable row level security;

revoke all on public.viewing_outcome_tokens from anon, authenticated, public;
revoke all on function public.mint_viewing_outcome_tokens(uuid)                from anon, authenticated, public;
revoke all on function public.redeem_viewing_outcome_token(text, text, text)   from anon, authenticated, public;

-- No policy: nothing but the service role may read tokens.
