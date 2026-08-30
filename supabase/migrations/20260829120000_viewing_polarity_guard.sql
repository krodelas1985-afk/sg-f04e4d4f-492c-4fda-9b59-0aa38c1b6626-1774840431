-- Viewing auto-resolver: stop treating a decline as a booking.
--
-- The bug, concretely (lead "Carino Elenita", request bdc673d1-0797-4feb-8353-67fbc60aa6bf):
--   source_text = "not available this weekend due to anniversary and family gatherings"
--   resolution_confidence = 'medium', status = 'scheduled'.
-- The lead was declining. We booked her.
--
-- Why it happened. resolve_viewing_datetime's "not a schedule" guard is
--     t ~ '(busy|malabo|hindi|di po|ayaw|wala|next time)'  OR  (no time-word AND no clock)
-- Neither disjunct fires here: "not available" is not in the keyword list, and the text
-- DOES contain a time word ("weekend"). Control falls through to the named-weekday branch,
-- which sees \yweekend\y, resolves it to the coming Saturday, and returns 'medium'.
--
-- That is not a missing keyword, it is a missing concept. The resolver extracts *when* and
-- has no notion of *whether*. Negation and time expressions co-occur precisely in declines
-- ("not available this weekend", "hindi ako pwede bukas", "busy next week") -- exactly the
-- inputs where the time word makes the guard weaker, not stronger. Adding "not available"
-- to the keyword list would fix this one lead and leave the shape of the bug intact.
--
-- Second half of the failure: ensure_viewing_appointment inserts unconditionally, with
-- status 'scheduled', even when the resolver already returned confidence 'none' -- i.e.
-- even when it had concluded "this text is not a schedule at all". So the negatives the old
-- list DID catch ("busy", "malabo") still became appointments and still became outcome
-- requests. That was dormant until Workflow 10 (n8n 89TPGl8opsjgpm5h) was activated
-- 2026-08-29; it now emails an agent asking how a viewing went that the lead refused, and
-- those answers land in the show-rate and viewing-to-Won figures on /overview.
--
-- The fix, in three parts:
--   1. viewing_text_polarity() -- a small, auditable classifier over the free text:
--      negative | mixed | affirmative | neutral.
--   2. resolve_viewing_datetime() consults it FIRST, before any date branch, so a decline
--      can never resolve to a date no matter which time words it contains.
--   3. ensure_viewing_appointment() refuses to create an appointment for a negative and
--      records a not_happened indication instead -- the signal is kept, not dropped. A
--      *mixed* text ("hindi Sabado, pero Linggo po pwede") still creates the appointment,
--      since it may be a real counter-offer, but at confidence 'none' with the outcome
--      request pre-suppressed: visible in the CRM, never emailed, never counted.
--
-- Part 4 cleans up the appointments already created this way.
--
-- AFTER APPLYING: regenerate src/integrations/supabase/database.types.ts against
-- zyfkjxepykwpfzmkxitb and commit it. viewing_text_polarity is a new public function and
-- will appear there. Do not hand-add it beforehand -- that puts the committed types ahead
-- of the database, which is the same drift the CLAUDE.md gotcha is about, pointing the
-- other way.

-- ===========================================================================
-- 1. The classifier
-- ===========================================================================
create or replace function public.viewing_text_polarity(p_text text)
returns text
language plpgsql
immutable
as $fn$
declare
  t     text := lower(coalesce(p_text, ''));
  scrub text;
  neg   boolean;
  pos   boolean;
begin
  if btrim(t) = '' then
    return 'neutral';
  end if;

  -- Negated affirmatives are removed before the affirmative test, so "not available" and
  -- "hindi po pwede" cannot read as agreement on the strength of the words they negate.
  -- The filler list is enumerated rather than \w+ on purpose: "hindi ba pwede" (a question,
  -- not a refusal) should not be swallowed by a greedy gap.
  scrub := regexp_replace(
    t,
    '\y(not|hindi|hnd|indi|di|d|wala|walang|ayaw|cannot|can''t|cant|won''t|wont|unable|no)'
    || '(\s+(po|ako|akong|kami|kaming|ko|siguro|talaga|kasi|muna|na|pa|masyado|yata|pwedeng))*'
    || '\s+(available|avail|free|pwede|puwede|possible|sure|makaka\w+|maka\w+|punta|pupunta|'
    || 'bisita|bibisita|makita|makikita|attend|make it|go|come|schedule|oras|time|libre)\y',
    ' __neg__ ', 'g');

  -- The parentheses around each concatenated pattern are load-bearing: `~` and `||` share
  -- a precedence level and associate left, so `t ~ 'a' || 'b'` parses as `(t ~ 'a') || 'b'`
  -- and fails at runtime with "argument of OR must be type boolean".
  neg :=
       scrub ~ '__neg__'
    or t ~ '\y(busy|abala|malabo|occupied|unavailable|unavailability|swamped|tied up)\y'
    or t ~ ('\y(next time|another time|some other time|sa susunod|sa ibang araw|'
           || 'rain ?check|postpone\w*|reschedul\w*|cancel\w*|hindi na|wag na|huwag na|'
           || 'pass muna|later na|maybe next|not this)\y')
    -- "I have something else on" is a refusal even with no negation word in it
    or t ~ ('\y(may lakad|may pasok|may trabaho|may gagawin|may byahe|out of town|'
           || 'nasa probinsya)\y')
    -- Standalone refusals that name no object: "I can't this Saturday". Excluded:
    -- "can't wait", which is the opposite sentiment in the same words.
    or (t ~ '\y(can''t|cant|cannot|can not|won''t|wont|unable|not able|hindi kaya|di kaya)\y'
        and t !~ '\y(can''t|cant|cannot) wait\y');

  -- Affirmative test runs on the scrubbed text: whatever a negator consumed is gone.
  pos := scrub ~ ('\y(pwede|puwede|sige|sge|ok|oks|okay|okey|yes|yeah|yep|opo|oo|sure|game|'
                 || 'tara|confirm\w*|book\w*|see you|kita tayo|punta|pupunta|bisita|bibisita|'
                 || 'makita|makikita|available|avail|free|libre|let''s|lets|schedule|set na|'
                 || 'deal)\y');

  if neg and pos then return 'mixed'; end if;
  if neg         then return 'negative'; end if;
  if pos         then return 'affirmative'; end if;
  return 'neutral';
end;
$fn$;

comment on function public.viewing_text_polarity(text) is
  'Classifies a lead''s free-text viewing reply: negative (declining/unavailable) | mixed (a refusal AND an agreement, e.g. a counter-offer) | affirmative | neutral. Errs toward mixed rather than negative when both signals appear, because mixed still records the appointment (uncounted, unemailed) while negative discards it.';

revoke all on function public.viewing_text_polarity(text) from anon, authenticated, public;

-- ===========================================================================
-- 2. The resolver refuses to date a refusal
--
-- Body is unchanged from 20260810133000 apart from the polarity gate at the top. It sits
-- BEFORE the explicit-date branch, so "not available August 15" is caught too -- the old
-- ordering put explicit dates ahead of the negative guard precisely so a real date could
-- not be rejected, and a date inside a refusal is the case that breaks.
-- ===========================================================================
create or replace function public.resolve_viewing_datetime(
  p_text   text,
  p_anchor timestamptz
)
returns table (scheduled_at timestamptz, confidence text)
language plpgsql
immutable
as $fn$
declare
  t          text := lower(coalesce(p_text, ''));
  anchor_day date := (p_anchor at time zone 'Asia/Manila')::date;
  d          date;
  hh         int  := 10;          -- default 10:00 when no time is stated
  conf       text := 'low';
  m          text[];
  mon        int;
  dy         int;
  yr         int;
  dow        int;
  target_dow int;
  has_time   boolean := false;
begin
  -- ---------------------------------------------------------------- polarity
  -- A decline has no viewing date, however many time words it contains.
  if public.viewing_text_polarity(t) = 'negative' then
    return query select p_anchor, 'none'::text;
    return;
  end if;

  -- ---------------------------------------------------------------- time of day
  m := regexp_match(t, '(\d{1,2})(?::(\d{2}))?\s*(am|pm)');
  if m is not null then
    hh := m[1]::int;
    if m[3] = 'pm' and hh < 12 then hh := hh + 12; end if;
    if m[3] = 'am' and hh = 12 then hh := 0; end if;
    has_time := true;
  elsif t ~ '\y(umaga|morning)\y' then
    hh := 9;  has_time := true;
  elsif t ~ '\y(tanghali|lunch|noon)\y' then
    hh := 12; has_time := true;
  elsif t ~ '\y(hapon|afternoon|pm)\y' then
    hh := 14; has_time := true;
  elsif t ~ '\y(gabi|evening|night)\y' then
    hh := 19; has_time := true;
  end if;

  -- ---------------------------------------------------------------- explicit date
  m := regexp_match(t, '\y(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:\s*(?:,|\s)\s*(\d{4}))?');
  if m is not null then
    mon := case m[1] when 'jan' then 1 when 'feb' then 2 when 'mar' then 3 when 'apr' then 4
                     when 'may' then 5 when 'jun' then 6 when 'jul' then 7 when 'aug' then 8
                     when 'sep' then 9 when 'oct' then 10 when 'nov' then 11 else 12 end;
    dy  := m[2]::int;
    yr  := coalesce(m[3]::int, extract(year from anchor_day)::int);
    begin
      d := make_date(yr, mon, dy);
      conf := 'high';
      -- a resolved date before the anchor means a stale qualification value, not a plan
      if d < anchor_day then conf := 'low'; end if;
      return query select ((d + make_interval(hours => hh)) at time zone 'Asia/Manila'), conf;
      return;
    exception when others then
      null;  -- fall through to the relative rules
    end;
  end if;

  -- "last week of <month>" -- no day number, approximate to the 24th
  m := regexp_match(t, 'last week of\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*');
  if m is not null then
    mon := case m[1] when 'jan' then 1 when 'feb' then 2 when 'mar' then 3 when 'apr' then 4
                     when 'may' then 5 when 'jun' then 6 when 'jul' then 7 when 'aug' then 8
                     when 'sep' then 9 when 'oct' then 10 when 'nov' then 11 else 12 end;
    d := make_date(extract(year from anchor_day)::int, mon, 24);
    return query select ((d + make_interval(hours => hh)) at time zone 'Asia/Manila'), 'low'::text;
    return;
  end if;

  -- ---------------------------------------------------------------- not a schedule
  -- Kept as-is. It is now a second line of defence, not the only one.
  if t = ''
     or t ~ '\y(busy|malabo|hindi|di po|ayaw|wala|next time)\y'
     or (t !~ '\y(bukas|tomorrow|mamaya|mmya|today|ngayon|now|weekend|linggo|sunday|monday|tuesday|wednesday|thursday|friday|saturday|lunes|martes|miyerkules|huwebes|biyernes|sabado|umaga|morning|hapon|afternoon|gabi|evening|night|tanghali|lunch|noon|next week|susunod)\y'
         and not has_time) then
    return query select p_anchor, 'none'::text;
    return;
  end if;

  -- ---------------------------------------------------------------- tomorrow
  if t ~ '\y(bukas|tomorrow)\y' then
    d := anchor_day + 1;
    return query select ((d + make_interval(hours => hh)) at time zone 'Asia/Manila'),
                        (case when has_time then 'high' else 'medium' end)::text;
    return;
  end if;

  -- ---------------------------------------------------------------- named weekday
  target_dow := case
    when t ~ '\y(linggo|sunday)\y'        then 0
    when t ~ '\y(lunes|monday)\y'         then 1
    when t ~ '\y(martes|tuesday)\y'       then 2
    when t ~ '\y(miyerkules|wednesday)\y' then 3
    when t ~ '\y(huwebes|thursday)\y'     then 4
    when t ~ '\y(biyernes|friday)\y'      then 5
    when t ~ '\y(sabado|saturday)\y'      then 6
    when t ~ '\yweekend\y'                then 6
    else null end;
  if target_dow is not null then
    dow := extract(dow from anchor_day)::int;
    d := anchor_day + (((target_dow - dow) + 7) % 7);
    if d = anchor_day then d := d + 7; end if;   -- "Sunday" said on a Sunday means next one
    return query select ((d + make_interval(hours => hh)) at time zone 'Asia/Manila'), 'medium'::text;
    return;
  end if;

  -- ---------------------------------------------------------------- same day
  if t ~ '\y(mamaya|mmya|today|ngayon|now)\y' then
    return query select ((anchor_day + make_interval(hours => hh)) at time zone 'Asia/Manila'),
                        (case when has_time then 'high' else 'medium' end)::text;
    return;
  end if;

  -- ---------------------------------------------------------------- next week
  if t ~ '\y(next week|susunod na linggo)\y' then
    return query select ((anchor_day + 7 + make_interval(hours => hh)) at time zone 'Asia/Manila'), 'low'::text;
    return;
  end if;

  -- ---------------------------------------------------------------- time only
  if has_time then
    return query select ((anchor_day + make_interval(hours => hh)) at time zone 'Asia/Manila'), 'low'::text;
    return;
  end if;

  return query select p_anchor, 'none'::text;
end;
$fn$;

comment on function public.resolve_viewing_datetime(text, timestamptz) is
  'Resolves a lead''s free-text viewing time against the message that produced it. Returns (scheduled_at, confidence). A negative-polarity text (see viewing_text_polarity) always returns confidence none, whatever time words it contains. confidence none = not a schedule / undeterminable: treat scheduled_at as a placeholder and ask the agent.';

-- ===========================================================================
-- 3. The creator refuses to book a refusal
-- ===========================================================================
create or replace function public.ensure_viewing_appointment(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  l      record;
  vtext  text;
  pol    text;
  r      record;
  new_id uuid;
begin
  select id, client_id, name, last_inbound_at
    into l
  from public.leads
  where id = p_lead_id;

  -- No inbound message means no anchor to resolve a relative date against.
  if not found or l.last_inbound_at is null then
    return null;
  end if;

  select viewing_schedule into vtext
  from public.lead_qualifications
  where lead_id = p_lead_id;

  pol := public.viewing_text_polarity(vtext);

  -- ------------------------------------------------------------------ decline
  -- No appointment. The lead said no; inventing a scheduled viewing here is what put an
  -- outcome email in front of an agent for a viewing that was refused, and what would put
  -- that lead in the show-rate denominator on /overview.
  --
  -- The signal is not discarded, it is recorded as what it actually is. lead_viewing_
  -- indications is append-only and explicitly allows disagreement, so a later
  -- agent_confirmed 'happened' row (the agent may have arranged it off-channel) simply
  -- sits alongside this one and wins on source.
  if pol = 'negative' then
    if not exists (
      select 1 from public.lead_viewing_indications i
      where i.lead_id = p_lead_id
        and i.source = 'inferred'
        and i.indication_type = 'declined_in_conversation'
        and i.evidence_text is not distinct from vtext
        and i.detected_at > now() - interval '30 days'
    ) then
      insert into public.lead_viewing_indications
        (lead_id, client_id, indication_type, polarity, source, confidence,
         evidence_text, extractor_version)
      values
        (p_lead_id, l.client_id, 'declined_in_conversation', 'not_happened', 'inferred',
         'medium', vtext, 'viewing_text_polarity/v1');
    end if;
    return null;
  end if;

  -- Don't stack appointments (unchanged).
  if exists (
    select 1
    from public.appointments a
    left join public.viewing_outcome_requests vr on vr.appointment_id = a.id
    where a.lead_id = p_lead_id
      and a.appointment_type = 'viewing'
      and a.created_at > now() - interval '30 days'
      and coalesce(vr.status, 'pending') <> 'answered'
  ) then
    return null;
  end if;

  select * into r from public.resolve_viewing_datetime(vtext, l.last_inbound_at);

  insert into public.appointments
    (client_id, lead_id, appointment_type, scheduled_at, status,
     source_text, resolution_confidence, resolved_from, title)
  values
    (l.client_id, p_lead_id, 'viewing', r.scheduled_at, 'scheduled',
     vtext,
     -- a text carrying both a refusal and an agreement is not a date we can stand behind
     case when pol = 'mixed' then 'none' else r.confidence end,
     'conversation',
     'Viewing - ' || coalesce(nullif(btrim(l.name), ''), 'lead'))
  returning id into new_id;

  -- trg_create_viewing_outcome_request has just created a PENDING request for this row.

  -- ------------------------------------------------------------------ counter-offer
  -- "Hindi ako pwede Sabado, pero Linggo po pwede" is a real booking and belongs in the
  -- CRM. It is not something to email an agent about as an established fact, so the
  -- request is suppressed at birth rather than never created -- the exclusion stays
  -- visible and auditable, the way the 2026-08-10 backfill suppression is.
  if pol = 'mixed' then
    update public.viewing_outcome_requests
       set status = 'suppressed',
           suppressed_reason = 'viewing text carries both a refusal and an agreement '
             || '(viewing_text_polarity=mixed); agent must confirm before this counts',
           updated_at = now()
     where appointment_id = new_id
       and status = 'pending';

    insert into public.lead_viewing_indications
      (lead_id, appointment_id, client_id, indication_type, polarity, source, confidence,
       evidence_text, extractor_version)
    values
      (p_lead_id, new_id, l.client_id, 'ambiguous_viewing_text', 'ambiguous', 'inferred',
       'low', vtext, 'viewing_text_polarity/v1');
  end if;

  return new_id;
end;
$fn$;

comment on function public.ensure_viewing_appointment(uuid) is
  'Creates a viewing appointment from the lead''s current viewing signal. Refuses when the text is a decline (records a not_happened indication instead); creates but pre-suppresses the outcome request when the text is mixed. No-ops if a recent unanswered viewing appointment already exists.';

revoke all on function public.ensure_viewing_appointment(uuid) from anon, authenticated, public;

-- ===========================================================================
-- 4. The appointments already created this way
--
-- Same classifier, applied to every viewing appointment that came from conversation text.
-- Suppression only touches requests still in flight (pending = never sent, sent = first
-- email out and a reminder still to come). answered/expired/suppressed are left exactly as
-- they are: an agent's answer is authoritative and is never overwritten by a heuristic.
--
-- The appointment rows themselves are NOT cancelled here. appointments.status carries a
-- CHECK constraint whose allowed values are not defined anywhere in this repo's migrations,
-- so a blind update risks failing the whole apply. The not_happened indications written
-- below are the durable record and are what a show-rate query should read. Cancelling the
-- rows is a follow-up once the allowed statuses are confirmed.
-- ===========================================================================
do $sweep$
declare
  n_suppressed int := 0;
  n_indicated  int := 0;
  n_mixed      int := 0;
begin
  with negatives as (
    select a.id as appointment_id
    from public.appointments a
    where a.appointment_type = 'viewing'
      and a.resolved_from in ('viewing_schedule','conversation')
      and public.viewing_text_polarity(a.source_text) = 'negative'
  ),
  sup as (
    update public.viewing_outcome_requests r
       set status = 'suppressed',
           suppressed_reason = coalesce(r.suppressed_reason || ' | ', '')
             || 'source_text is a decline, not a booking '
             || '(viewing_text_polarity=negative, swept 2026-08-29); '
             || 'W10 must not ask an agent how this viewing went',
           updated_at = now()
      from negatives n
     where r.appointment_id = n.appointment_id
       and r.status in ('pending','sent')
    returning 1
  )
  select count(*) into n_suppressed from sup;

  with negatives as (
    select a.id as appointment_id, a.lead_id, a.client_id, a.source_text
    from public.appointments a
    where a.appointment_type = 'viewing'
      and a.resolved_from in ('viewing_schedule','conversation')
      and public.viewing_text_polarity(a.source_text) = 'negative'
  ),
  ins as (
    insert into public.lead_viewing_indications
      (lead_id, appointment_id, client_id, indication_type, polarity, source, confidence,
       evidence_text, extractor_version)
    select n.lead_id, n.appointment_id, n.client_id, 'declined_in_conversation',
           'not_happened', 'inferred', 'medium', n.source_text, 'viewing_text_polarity/v1'
    from negatives n
    where not exists (
      select 1 from public.lead_viewing_indications i
      where i.appointment_id = n.appointment_id
        and i.source = 'inferred'
        and i.indication_type = 'declined_in_conversation'
    )
    returning 1
  )
  select count(*) into n_indicated from ins;

  with mixed as (
    select a.id as appointment_id
    from public.appointments a
    where a.appointment_type = 'viewing'
      and a.resolved_from in ('viewing_schedule','conversation')
      and public.viewing_text_polarity(a.source_text) = 'mixed'
  ),
  sup2 as (
    update public.viewing_outcome_requests r
       set status = 'suppressed',
           suppressed_reason = coalesce(r.suppressed_reason || ' | ', '')
             || 'source_text carries both a refusal and an agreement '
             || '(viewing_text_polarity=mixed, swept 2026-08-29); agent must confirm first',
           updated_at = now()
      from mixed m
     where r.appointment_id = m.appointment_id
       and r.status in ('pending','sent')
    returning 1
  )
  select count(*) into n_mixed from sup2;

  raise notice 'viewing polarity sweep: % negative request(s) suppressed, % indication(s) recorded, % mixed request(s) suppressed',
    n_suppressed, n_indicated, n_mixed;
end;
$sweep$;
