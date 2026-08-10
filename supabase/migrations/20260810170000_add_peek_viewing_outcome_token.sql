-- Phase 1 Step 2 — read-only token inspection for the confirm page.
--
-- The confirm page must render "You're recording: It happened — Patrick Famini's viewing"
-- WITHOUT writing anything. Email security scanners (Outlook Safe Links, corporate
-- gateways) fetch every URL in a message; if the GET recorded the outcome, a scanner
-- opening all four buttons would file four contradictory agent confirmations. Recording
-- happens only on the POST that follows the Confirm button, which scanners do not submit.
--
-- Mirrors redeem_viewing_outcome_token's validation exactly so the two cannot drift into
-- disagreeing about whether a link is usable.

create or replace function public.peek_viewing_outcome_token(
  p_token    text,
  p_polarity text
)
returns table (
  status            text,   -- valid | invalid | expired | already | answered | used
  lead_name         text,
  scheduled_at      timestamptz,
  source_text       text,
  date_known        boolean,
  recorded_polarity text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tok public.viewing_outcome_tokens%rowtype;
  req public.viewing_outcome_requests%rowtype;
  lnm text;
  sch timestamptz;
  src text;
  dk  boolean;
begin
  if p_polarity not in ('happened','not_happened','rescheduled','ambiguous') then
    return query select 'invalid'::text, null::text, null::timestamptz, null::text, null::boolean, null::text;
    return;
  end if;

  select * into tok from public.viewing_outcome_tokens where token = p_token;
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
         a.scheduled_at,
         a.source_text,
         (a.resolution_confidence is distinct from 'none')
    into lnm, sch, src, dk
  from public.leads l
  join public.appointments a on a.id = req.appointment_id
  where l.id = req.lead_id;

  if exists (
    select 1 from public.lead_viewing_indications i
    where i.appointment_id = req.appointment_id
      and i.source = 'agent_confirmed'
      and i.polarity = p_polarity
  ) then
    return query select 'already'::text, lnm, sch, src, dk, p_polarity;
    return;
  end if;

  if req.status = 'answered' then
    return query select 'answered'::text, lnm, sch, src, dk,
      (select i.polarity from public.lead_viewing_indications i
        where i.appointment_id = req.appointment_id and i.source = 'agent_confirmed'
        order by i.detected_at desc limit 1);
    return;
  end if;

  if tok.used_at is not null then
    return query select 'used'::text, lnm, sch, src, dk, null::text;
    return;
  end if;

  return query select 'valid'::text, lnm, sch, src, dk, null::text;
end;
$$;

comment on function public.peek_viewing_outcome_token(text, text) is
  'Read-only inspection of a one-click token for the confirm page. Writes nothing — recording happens only via redeem_viewing_outcome_token on POST.';

revoke all on function public.peek_viewing_outcome_token(text, text) from anon, authenticated, public;
