-- Phase 3a — the read-only half of the prep confirmation.
--
-- The confirm page renders from a peek and only records on the POST behind the button,
-- because email security scanners (Outlook Safe Links, corporate gateways, antivirus) fetch
-- every URL in a message but do not submit forms. Without a peek the page would have to
-- redeem on GET, and a scanner opening all three links would file three contradictory
-- confirmations before the agent ever saw the email -- fabricating exactly the data this
-- feature exists to make trustworthy.
--
-- Phase 2 shipped redeem_viewing_prep_token without its peek. This is that gap.

create or replace function public.peek_viewing_prep_token(p_token text, p_answer text)
returns table (
  status         text,
  lead_name      text,
  scheduled_at   timestamptz,
  source_text    text,
  date_known     boolean,
  recorded_answer text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  tok public.viewing_outcome_tokens%rowtype;
  req public.viewing_outcome_requests%rowtype;
  lnm text; sch timestamptz; src text; dk boolean; pol text;
begin
  pol := case p_answer
           when 'going_ahead'   then 'confirmed_upcoming'
           when 'not_happening' then 'not_happened'
           when 'rescheduled'   then 'rescheduled'
         end;

  if pol is null then
    return query select 'invalid'::text, null::text, null::timestamptz, null::text, null::boolean, null::text;
    return;
  end if;

  select * into tok from public.viewing_outcome_tokens
   where token = p_token and kind = 'prep';
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
      and i.source = 'agent_confirmed' and i.polarity = pol
  ) then
    return query select 'already'::text, lnm, sch, src, dk, p_answer;
    return;
  end if;

  -- Answered means someone already said it is not happening or was rescheduled, which
  -- closes the request. "Going ahead" does not close it, so this cannot fire for that.
  if req.status = 'answered' then
    return query select 'answered'::text, lnm, sch, src, dk,
      (select case i.polarity when 'not_happened' then 'not_happening' else i.polarity end
         from public.lead_viewing_indications i
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

comment on function public.peek_viewing_prep_token(text, text) is
  'Read-only view of a prep token for the confirm page. Records nothing -- redeem_viewing_prep_token does that, behind a POST.';

-- service_role only, matching peek_viewing_outcome_token. Revoking from anon and public
-- alone would leave `authenticated` with EXECUTE on a SECURITY DEFINER function, which was
-- the hole fixed in 20260831120000.
revoke all on function public.peek_viewing_prep_token(text, text) from anon, public, authenticated;
