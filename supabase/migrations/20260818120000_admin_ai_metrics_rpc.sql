-- AI performance metrics for the baymo_admin Admin Overview (/admin).
--
-- Reports volume and response rate for the three AI surfaces that write to
-- conversations. The surfaces are distinguished purely by sent_via:
--
--   ai_responder  sender='ai', sent_via IS NULL        -- W2 Messenger responder
--   ai_followup   sender='ai', sent_via='followup_engine'
--   ai_assist     sender='ai', sent_via='ai_assist'    -- W8 15-min nudge
--
-- Deliberately excluded: sender='sequence' (the older non-AI scheduled sender)
-- and sender='agent' (human). Neither is AI work.
--
-- A "response" is an inbound message from the same lead strictly after the AI
-- message and within 24 hours. Note that ai_responder's rate is a
-- conversation-CONTINUATION rate, not a cold-outreach rate -- it replies to a
-- lead who just wrote in, so a further reply is the normal course of a live
-- chat. Only ai_followup and ai_assist are proactive. The UI must say so.

-- Supports the AI-outbound scan without touching the hot insert path much.
create index if not exists idx_conversations_ai_outbound
  on public.conversations (created_at desc)
  where sender = 'ai' and direction = 'outbound';

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
-- Every AI-sent message, labelled by surface and bucketed to the Manila
-- reporting day (dashboard.tsx already treats Manila as the day boundary).
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
-- Did the lead write back within 24h? Served by idx_conversations_lead_created.
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
-- All-time per-surface totals. The cards say "Total", so they are not windowed.
surface_totals as (
  select
    s.surface,
    count(f.lead_id) as sent,
    count(*) filter (where f.replied) as replied,
    count(distinct f.lead_id) as leads
  from surfaces s
  left join flagged f on f.surface = s.surface
  group by s.surface
),
-- Same, restricted to the charted window, for the trend card subtitle.
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
-- Zero-filled day axis: a chart with holes reads worse than one with zeros.
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
)
select jsonb_build_object(
  'window_hours', 24,
  'days', (select days from bounds),
  'totals', (
    select jsonb_object_agg(
      surface,
      jsonb_build_object('sent', sent, 'replied', replied, 'leads', leads)
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

comment on function public.get_admin_ai_metrics(int) is
  'baymo_admin AI performance metrics across all workspaces. Service-role only; '
  'the baymo_admin check lives in /api/admin/stats. 24h reply window.';

-- Service role only, matching the lead_engagement_counts precedent in
-- 20260812110000_objection_and_canned_engagement_views.sql. This function
-- reads every workspace's conversations, so it must never be callable by a
-- logged-in client. auth.uid() is null when reached via the service-role
-- client, so an in-function role gate would always fail -- don't add one.
revoke all on function public.get_admin_ai_metrics(int) from public;
revoke all on function public.get_admin_ai_metrics(int) from anon;
revoke all on function public.get_admin_ai_metrics(int) from authenticated;
grant execute on function public.get_admin_ai_metrics(int) to service_role;
