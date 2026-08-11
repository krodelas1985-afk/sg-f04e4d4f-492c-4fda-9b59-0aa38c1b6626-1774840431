-- Let the agent record Won/Lost from the viewing confirm page, using the token they
-- already used to record the viewing outcome.
--
-- Why here rather than a second email: agents do not open the CRM (195 pending tasks, zero
-- completions), and every extra email is a chance to be ignored. The confirm page is the
-- one moment we know an agent is present, has just answered a question, and has the lead
-- in mind. Asking one optional follow-up there costs no new send and no new friction.
--
-- The token is deliberately accepted even after used_at is stamped: the disposition step
-- happens seconds after the outcome step, by the same person, in the same session. Expiry
-- still applies.

create or replace function public.record_disposition_from_token(
  p_token       text,
  p_disposition text,
  p_lost_reason text default null,
  p_ip          text default null
)
returns table (status text, lead_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  tok public.viewing_outcome_tokens%rowtype;
  req public.viewing_outcome_requests%rowtype;
  res record;
begin
  select * into tok from public.viewing_outcome_tokens where token = p_token;
  if not found then
    return query select 'invalid'::text, null::text; return;
  end if;

  if tok.expires_at < now() then
    return query select 'expired'::text, null::text; return;
  end if;

  select * into req from public.viewing_outcome_requests where id = tok.request_id;
  if not found then
    return query select 'invalid'::text, null::text; return;
  end if;

  -- set_lead_disposition owns the validation: refuses a bad disposition, refuses Lost
  -- without a reason, and stamps status_source='manual'.
  select * into res
  from public.set_lead_disposition(
    req.lead_id, p_disposition, p_lost_reason, tok.profile_id,
    'recorded from the viewing outcome email'
  );

  return query select res.status, res.lead_name;
end;
$$;

comment on function public.record_disposition_from_token(text, text, text, text) is
  'Records Won/Lost from the viewing confirm page using the outcome email token. Accepts a spent token (the disposition step follows the outcome step seconds later) but not an expired one. Delegates all validation to set_lead_disposition.';

revoke all on function public.record_disposition_from_token(text, text, text, text)
  from anon, authenticated, public;
