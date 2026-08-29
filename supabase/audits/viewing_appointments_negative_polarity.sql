-- Blast radius: which existing viewing appointments were created from a decline?
--
-- READ ONLY. Safe to paste into the Supabase SQL editor on zyfkjxepykwpfzmkxitb at any
-- time. Run it BEFORE applying 20260829120000_viewing_polarity_guard.sql to see what the
-- sweep in part 4 of that migration is about to suppress, and AFTER to confirm it did.
--
-- Requires public.viewing_text_polarity() to exist, so section A below is a standalone
-- copy of the classifier -- it creates nothing. If the migration is already applied,
-- delete section A and the query still runs against the real function.

-- =====================================================================
-- A. classifier, inlined so this file works pre-migration
-- =====================================================================
with polarity as (
  select
    a.id            as appointment_id,
    a.lead_id,
    a.client_id,
    a.created_at,
    a.scheduled_at,
    a.status        as appointment_status,
    a.resolution_confidence,
    a.source_text,
    -- scrub negated affirmatives, then test both directions (mirrors viewing_text_polarity)
    regexp_replace(lower(coalesce(a.source_text, '')),
      '\y(not|hindi|hnd|indi|di|d|wala|walang|ayaw|cannot|can''t|cant|won''t|wont|unable|no)'
      || '(\s+(po|ako|akong|kami|kaming|ko|siguro|talaga|kasi|muna|na|pa|masyado|yata|pwedeng))*'
      || '\s+(available|avail|free|pwede|puwede|possible|sure|makaka\w+|maka\w+|punta|pupunta|'
      || 'bisita|bibisita|makita|makikita|attend|make it|go|come|schedule|oras|time|libre)\y',
      ' __neg__ ', 'g')                       as scrub,
    lower(coalesce(a.source_text, ''))        as t
  from public.appointments a
  where a.appointment_type = 'viewing'
    and a.resolved_from in ('viewing_schedule','conversation')
),
classified as (
  select p.*,
    (
         p.scrub ~ '__neg__'
      or p.t ~ '\y(busy|abala|malabo|occupied|unavailable|unavailability|swamped|tied up)\y'
      or p.t ~ ('\y(next time|another time|some other time|sa susunod|sa ibang araw|'
               || 'rain ?check|postpone\w*|reschedul\w*|cancel\w*|hindi na|wag na|huwag na|'
               || 'pass muna|later na|maybe next|not this)\y')
      or p.t ~ ('\y(may lakad|may pasok|may trabaho|may gagawin|may byahe|out of town|'
               || 'nasa probinsya)\y')
      or (p.t ~ '\y(can''t|cant|cannot|can not|won''t|wont|unable|not able|hindi kaya|di kaya)\y'
          and p.t !~ '\y(can''t|cant|cannot) wait\y')
    ) as neg,
    (
      p.scrub ~ ('\y(pwede|puwede|sige|sge|ok|oks|okay|okey|yes|yeah|yep|opo|oo|sure|game|'
                || 'tara|confirm\w*|book\w*|see you|kita tayo|punta|pupunta|bisita|bibisita|'
                || 'makita|makikita|available|avail|free|libre|let''s|lets|schedule|set na|'
                || 'deal)\y')
    ) as pos
  from polarity p
)
-- =====================================================================
-- B. the report
-- =====================================================================
select
  case when c.neg and c.pos then 'mixed'
       when c.neg           then 'negative'
       when c.pos           then 'affirmative'
       else 'neutral' end                     as polarity,
  c.resolution_confidence,
  r.status                                    as outcome_request_status,
  count(*)                                    as appointments,
  -- the ones that actually matter: a decline that W10 would email an agent about
  count(*) filter (where r.status in ('pending','sent'))  as still_emailable,
  min(c.created_at)                           as oldest,
  max(c.created_at)                           as newest
from classified c
left join public.viewing_outcome_requests r on r.appointment_id = c.appointment_id
group by 1, 2, 3
order by 1, 2, 3;

-- ---------------------------------------------------------------------
-- Row-level detail for the negatives only. Uncomment to list them.
-- ---------------------------------------------------------------------
-- with polarity as ( ... paste section A ... )
-- select c.appointment_id, l.name as lead_name, cl.name as client_name,
--        c.source_text, c.resolution_confidence, c.scheduled_at,
--        r.id as request_id, r.status, r.first_sent_at, r.recipients
-- from classified c
-- join public.leads l  on l.id = c.lead_id
-- join public.clients cl on cl.id = c.client_id
-- left join public.viewing_outcome_requests r on r.appointment_id = c.appointment_id
-- where c.neg and not c.pos
-- order by r.status, c.created_at desc;
