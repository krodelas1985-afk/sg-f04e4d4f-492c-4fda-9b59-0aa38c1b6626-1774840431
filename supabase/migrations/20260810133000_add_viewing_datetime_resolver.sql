-- Phase 1 — viewing date resolver.
--
-- Turns the free text a lead used ("bukas", "August 15 or 16", "Mamayang 4 pm") into a
-- timestamp, anchored to the message that produced it, with an honest confidence.
--
-- Replaces the crude first-pass rules in 20260810120000, which missed explicit dates
-- ("August 15 or 16" -> anchored to the signal date) and over-resolved garbled text
-- ("medjo ng bc po today" -> medium because it contained "today").
--
-- scheduled_at is NOT NULL on appointments, so text that is not a schedule at all
-- ("busy with work", "malabo kami makabisita") resolves to confidence 'none' with the
-- anchor as a placeholder. Consumers must treat 'none' as "date unknown, ask the agent".

-- allow 'none'
alter table public.appointments
  drop constraint if exists appointments_resolution_confidence_check;
alter table public.appointments
  add constraint appointments_resolution_confidence_check
  check (resolution_confidence in ('none','low','medium','high'));

create or replace function public.resolve_viewing_datetime(
  p_text   text,
  p_anchor timestamptz
)
returns table (scheduled_at timestamptz, confidence text)
language plpgsql
immutable
as $$
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
  -- ---------------------------------------------------------------- time of day
  -- explicit clock time: "4pm", "2:30-3pm", "4 pm", "10:30 am"
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
  -- Checked BEFORE the not-a-schedule guard: month names are matched with a trailing
  -- [a-z]* so "August" is caught, which a \yaug\y word boundary would miss mid-word.
  m := regexp_match(t, '\y(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:\s*(?:,|\s)\s*(\d{4}))?');
  if m is not null then
    mon := case m[1] when 'jan' then 1 when 'feb' then 2 when 'mar' then 3 when 'apr' then 4
                     when 'may' then 5 when 'jun' then 6 when 'jul' then 7 when 'aug' then 8
                     when 'sep' then 9 when 'oct' then 10 when 'nov' then 11 else 12 end;
    dy  := m[2]::int;
    yr  := coalesce(m[3]::int, extract(year from anchor_day)::int);
    begin
      d := make_date(yr, mon, dy);
      -- "last week of August" style: month named but the day we grabbed is bogus
      conf := 'high';
      -- a resolved date before the anchor means a stale qualification value, not a plan
      if d < anchor_day then conf := 'low'; end if;
      return query select ((d + make_interval(hours => hh)) at time zone 'Asia/Manila'), conf;
      return;
    exception when others then
      null;  -- fall through to the relative rules
    end;
  end if;

  -- "last week of <month>" — no day number, approximate to the 24th
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
  -- Runs after the explicit-date branches so a real date is never rejected here.
  -- Catches negatives ("busy with work", "malabo kami makabisita"), unit numbers mistaken
  -- for times ("Pwede po makita ang 1 at 2?"), and garbled text ("Vc pqpo").
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
    when t ~ '\y(linggo|sunday)\y'      then 0
    when t ~ '\y(lunes|monday)\y'       then 1
    when t ~ '\y(martes|tuesday)\y'     then 2
    when t ~ '\y(miyerkules|wednesday)\y' then 3
    when t ~ '\y(huwebes|thursday)\y'   then 4
    when t ~ '\y(biyernes|friday)\y'    then 5
    when t ~ '\y(sabado|saturday)\y'    then 6
    when t ~ '\yweekend\y'              then 6
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
$$;

comment on function public.resolve_viewing_datetime(text, timestamptz) is
  'Resolves a lead''s free-text viewing time against the message that produced it. Returns (scheduled_at, confidence) where confidence none = not a schedule / undeterminable — treat scheduled_at as a placeholder and ask the agent.';

-- ---------------------------------------------------------------------------
-- Re-resolve the appointments seeded by 20260810120000 with the corrected rules.
--
-- Before: 9 medium / 27 low / 0 none — explicit dates were all anchored to the signal day.
-- After:  5 high / 11 medium / 9 low / 11 none.
-- ---------------------------------------------------------------------------
-- The target table cannot be referenced from a LATERAL in UPDATE ... FROM, so the
-- resolution is computed in a subquery and joined back by id.
update public.appointments a
set scheduled_at          = s.sched,
    resolution_confidence = s.conf,
    updated_at            = now()
from (
  select a2.id, r.scheduled_at as sched, r.confidence as conf
  from public.appointments a2
  join public.leads l on l.id = a2.lead_id
  cross join lateral public.resolve_viewing_datetime(a2.source_text, l.last_inbound_at) r
  where a2.resolved_from = 'viewing_schedule'
) s
where s.id = a.id;
