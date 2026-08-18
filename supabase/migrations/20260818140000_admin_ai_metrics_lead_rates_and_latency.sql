-- Adds two things to get_admin_ai_metrics:
--
-- 1. leads_replied per surface, so the response-rate donut can be lead-level
--    for every surface instead of mixing lead-level and message-level rates.
--    NOTE: per-surface lead counts do NOT sum to leads_handled -- one lead can
--    be touched by the responder, a follow-up and a nudge. The UI must not
--    present these as parts of a whole.
--
-- 2. response_time: how fast the W2 responder replies to an inbound message.
--    Paired as "for each inbound, the FIRST responder reply after it and before
--    the next inbound", so W2's burst replies count once. W2's 12s debounce is
--    the floor, so sub-12s values are not expected.

create or replace function public.get_admin_ai_metrics(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with bounds as (
  select
    (now() at time zone 'Asia/Manila')::date as today,
    least(greatest(coalesce(p_days, 30), 1), 3650) as days
),
ai_msgs as (
  select
    c.lead_id,
    c.created_at,
    (c.created_at at time zone 'Asia/Manila')::date as day,
    case
      when c.sent_via = 'ai_assist' then 'ai_assist'
      when c.sent_via = 'followup_engine' then 'ai_followup'
      else 'ai_responder'
    end as surface
  from public.conversations c
  where c.sender = 'ai'
    and c.direction = 'outbound'
),
flagged as (
  select
    m.*,
    exists (
      select 1
      from public.conversations r
      where r.lead_id = m.lead_id
        and r.direction = 'inbound'
        and r.created_at > m.created_at
        and r.created_at < m.created_at + interval '24 hours'
    ) as replied
  from ai_msgs m
),
surfaces (surface) as (
  values ('ai_responder'), ('ai_followup'), ('ai_assist')
),
surface_totals as (
  select
    s.surface,
    count(f.lead_id) as sent,
    count(*) filter (where f.replied) as replied,
    count(distinct f.lead_id) as leads,
    count(distinct f.lead_id) filter (where f.replied) as leads_replied
  from surfaces s
  left join flagged f on f.surface = s.surface
  group by s.surface
),
period_totals as (
  select
    s.surface,
    count(f.lead_id) as sent,
    count(*) filter (where f.replied) as replied
  from surfaces s
  left join flagged f
    on f.surface = s.surface
   and f.day >= (select today - (days - 1) from bounds)
  group by s.surface
),
overall as (
  select
    count(*) as sent,
    count(*) filter (where replied) as replied,
    count(distinct lead_id) as leads_handled,
    count(distinct lead_id) filter (where replied) as leads_replied
  from flagged
),
day_axis as (
  select d::date as day
  from bounds b,
       generate_series(b.today - (b.days - 1), b.today, interval '1 day') d
),
daily_agg as (
  select day, surface, count(*) as sent
  from flagged
  group by 1, 2
),
daily as (
  select
    a.day,
    coalesce(sum(g.sent) filter (where g.surface = 'ai_responder'), 0) as ai_responder,
    coalesce(sum(g.sent) filter (where g.surface = 'ai_followup'), 0) as ai_followup,
    coalesce(sum(g.sent) filter (where g.surface = 'ai_assist'), 0) as ai_assist,
    coalesce(sum(g.sent), 0) as total
  from day_axis a
  left join daily_agg g on g.day = a.day
  group by a.day
),
-- Responder latency: inbound -> first responder reply for that inbound.
inbound_msgs as (
  select
    lead_id,
    created_at,
    lead(created_at) over (partition by lead_id order by created_at) as next_inbound
  from public.conversations
  where direction = 'inbound'
),
latency as (
  select extract(epoch from (r.created_at - i.created_at)) as secs
  from inbound_msgs i
  cross join lateral (
    select c.created_at
    from public.conversations c
    where c.lead_id = i.lead_id
      and c.sender = 'ai'
      and c.direction = 'outbound'
      and c.sent_via is null
      and c.created_at > i.created_at
      and (i.next_inbound is null or c.created_at < i.next_inbound)
    order by c.created_at asc
    limit 1
  ) r
)
select jsonb_build_object(
  'window_hours', 24,
  'days', (select days from bounds),
  'totals', (
    select jsonb_object_agg(
      surface,
      jsonb_build_object(
        'sent', sent, 'replied', replied,
        'leads', leads, 'leads_replied', leads_replied
      )
    )
    from surface_totals
  ),
  'period', (
    select jsonb_object_agg(
      surface,
      jsonb_build_object('sent', sent, 'replied', replied)
    )
    from period_totals
  ),
  'all', (
    select jsonb_build_object('sent', sent, 'replied', replied)
    from overall
  ),
  'leads_handled', (select leads_handled from overall),
  'leads_replied', (select leads_replied from overall),
  'response_time', (
    select jsonb_build_object(
      'samples', count(*),
      'avg_seconds', round(avg(secs))::int,
      'median_seconds', round(percentile_cont(0.5) within group (order by secs))::int,
      'p90_seconds', round(percentile_cont(0.9) within group (order by secs))::int,
      'max_seconds', round(max(secs))::int,
      'within_60s', count(*) filter (where secs <= 60)
    )
    from latency
  ),
  'daily', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'day', day,
          'ai_responder', ai_responder,
          'ai_followup', ai_followup,
          'ai_assist', ai_assist,
          'total', total
        )
        order by day
      ),
      '[]'::jsonb
    )
    from daily
  )
);
$$;

revoke all on function public.get_admin_ai_metrics(int) from public;
revoke all on function public.get_admin_ai_metrics(int) from anon;
revoke all on function public.get_admin_ai_metrics(int) from authenticated;
grant execute on function public.get_admin_ai_metrics(int) to service_role;
