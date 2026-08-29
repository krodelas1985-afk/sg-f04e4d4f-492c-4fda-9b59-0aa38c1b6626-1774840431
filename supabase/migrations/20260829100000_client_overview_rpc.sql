-- Workspace Overview metrics for client_admin / manager (/overview).
--
-- The client_admin counterpart to get_admin_ai_metrics. Two things make it
-- deliberately different from that function:
--
--   1. It is called by a LOGGED-IN user, not the service role, so the workspace
--      is derived from auth.uid() inside the function and the role gate lives
--      here rather than in an API route. p_client_id is NOT a parameter and must
--      never become one -- a security-definer function that reads leads and
--      accepts a client id is a cross-tenant read waiting to happen.
--
--   2. Every figure it returns can be absent for a legitimate reason (no agents
--      hired, no routing configured, nothing tagged Won). It therefore reports
--      *states* alongside numbers, so the page can say "No assigned agents"
--      instead of rendering a 0 that reads as "your agents sold nothing".
--      As of 2026-08-29 six of seven workspaces have no agents at all, so the
--      empty states are the common path, not the edge case.
--
-- CLOSED SALES ARE MANUALLY TAGGED (Kathy, 2026-08-29): a sold property is a
-- lead whose status an agent set to 'Won'. There is no deals table, no sale
-- value and no commission -- closed sales are a COUNT. Bucketing is by the
-- month of status_updated_at, counting leads whose status is Won *right now*.
-- That choice matters: 5 leads have been tagged Won historically and only 1
-- still is, so counting tag events instead would report four sales that were
-- taken back. Current-status counting self-corrects when a mistag is undone and
-- always agrees with what the broker sees in the Leads list.

create or replace function public.get_client_overview(p_months int default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text;
  v_client  uuid;
  v_months  int  := least(greatest(coalesce(p_months, 12), 1), 36);
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select p.role, p.client_id into v_role, v_client
  from public.profiles p
  where p.id = v_uid;

  -- Agents and viewers get the per-person Dashboard, not the workspace roll-up.
  if v_role is null or v_role not in ('client_admin', 'manager', 'baymo_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- baymo_admin has /admin for the cross-workspace view. If one has no client_id
  -- of their own there is nothing for this function to scope to; fail loudly
  -- rather than silently reporting on whichever workspace happens to sort first.
  if v_client is null then
    raise exception 'no_workspace' using errcode = '42501';
  end if;

  with
  -- ---------------------------------------------------------------- team
  agents as (
    select p.id
    from public.profiles p
    where p.client_id = v_client
      and p.role in ('agent', 'manager')
      and p.is_active
  ),
  pool as (
    select lap.user_id
    from public.lead_assignment_pool lap
    where lap.client_id = v_client
  ),
  open_leads as (
    select l.id, l.assigned_user_id, l.status, l.last_contacted_at, l.created_at
    from public.leads l
    where l.client_id = v_client
      and l.status not in ('Won', 'Lost', 'Unqualified')
  ),
  team as (
    select
      (select count(*) from agents)                                        as active_agents,
      (select count(*) from pool)                                          as agents_in_pool,
      (select count(*) from open_leads where assigned_user_id is not null) as open_assigned,
      (select count(*) from open_leads where assigned_user_id is null)     as open_unassigned,
      (select count(*) from open_leads
        where assigned_user_id is not null
          and coalesce(last_contacted_at, created_at) < now() - interval '14 days'
      )                                                                    as stale_assigned
  ),

  -- ------------------------------------------------------------ top agents
  -- Won counts come from the leads table directly; agent_performance_scores is
  -- the source for the composite only, and is empty until Phase 0 enrols the
  -- pool and schedules compute_agent_performance_scores().
  won_90d as (
    select l.assigned_user_id as user_id, count(*) as won_count
    from public.leads l
    where l.client_id = v_client
      and l.status = 'Won'
      and l.assigned_user_id is not null
      and coalesce(l.status_updated_at, l.updated_at, l.created_at) >= now() - interval '90 days'
    group by l.assigned_user_id
  ),
  ranked as (
    select
      p.id,
      coalesce(nullif(btrim(p.full_name), ''), p.email, 'Unnamed') as name,
      s.composite_score,
      s.is_grace,
      s.assigned_count,
      s.median_response_seconds,
      coalesce(w.won_count, 0) as won_90d
    from public.profiles p
    left join public.agent_performance_scores s
      on s.user_id = p.id and s.client_id = v_client
    left join won_90d w on w.user_id = p.id
    where p.client_id = v_client
      and p.role in ('agent', 'manager')
      and p.is_active
  ),

  -- -------------------------------------------------------------- pipeline
  stages as (
    select * from (values
      ('New', 1), ('In Contact', 2), ('Qualifying', 3), ('Qualified', 4),
      ('Viewing', 5), ('Negotiating', 6), ('Nurture', 7)
    ) as t(status, sort_order)
  ),
  pipeline as (
    select
      st.status,
      st.sort_order,
      count(l.id) as lead_count
    from stages st
    left join public.leads l
      on l.client_id = v_client and l.status = st.status
    group by st.status, st.sort_order
  ),

  -- --------------------------------------------------------- closed sales
  -- Manila month boundaries, matching dashboard.tsx's day boundary.
  won_leads as (
    select
      date_trunc(
        'month',
        (coalesce(l.status_updated_at, l.updated_at, l.created_at) at time zone 'Asia/Manila')
      )::date as month
    from public.leads l
    where l.client_id = v_client
      and l.status = 'Won'
  ),
  months as (
    select generate_series(
      date_trunc('month', (now() at time zone 'Asia/Manila')::date)
        - ((v_months - 1) || ' months')::interval,
      date_trunc('month', (now() at time zone 'Asia/Manila')::date),
      interval '1 month'
    )::date as month
  ),
  by_month as (
    select m.month, count(w.month) as won
    from months m
    left join won_leads w on w.month = m.month
    group by m.month
  ),
  -- Months from the first tagged sale to now. Averaging over the full 12-month
  -- window instead would divide by months the workspace did not yet exist for,
  -- quietly halving every average.
  history as (
    select
      (select count(*) from won_leads)      as won_total,
      (select min(month) from won_leads)    as first_won_month
  ),
  scored_months as (
    select bm.won
    from by_month bm, history h
    where h.first_won_month is not null and bm.month >= h.first_won_month
  ),
  sales as (
    select
      (select won_total from history)                                    as won_total,
      (select count(*) from scored_months)                               as months_with_data,
      (select round(avg(won)::numeric, 2) from scored_months)            as mean_per_month,
      (select round(percentile_cont(0.5) within group (order by won)::numeric, 2)
         from scored_months)                                             as median_per_month,
      (select round(percentile_cont(0.5) within group (order by won)::numeric, 2)
         from (select won from by_month order by month desc limit 3) r)  as run_rate_3mo,
      (select min(won) from (select won from by_month order by month desc limit 3) r) as run_rate_low,
      (select max(won) from (select won from by_month order by month desc limit 3) r) as run_rate_high
  ),

  -- --------------------------------------------------------------- signals
  signals as (
    select
      (select round(percentile_cont(0.5) within group (order by s.median_response_seconds)::numeric, 0)
         from public.agent_performance_scores s
        where s.client_id = v_client and s.median_response_seconds is not null)  as speed_to_lead_seconds,
      (select count(*) from public.appointments a
        where a.client_id = v_client and a.created_at >= now() - interval '30 days') as appts_set_30d,
      (select count(*) from public.appointments a
        where a.client_id = v_client and a.status = 'completed')                     as appts_completed,
      (select count(*) from public.appointments a
        where a.client_id = v_client and a.status = 'no_show')                       as appts_no_show,
      (select count(*) from public.appointments a
        where a.client_id = v_client and a.status = 'scheduled'
          and a.scheduled_at < now())                                                as appts_awaiting_outcome,
      (select count(*) from public.conversations c
        where c.client_id = v_client and c.sender = 'ai'
          and c.direction = 'outbound'
          and c.created_at >= now() - interval '30 days')                            as ai_messages_30d,
      (select count(*) from public.leads l
        where l.client_id = v_client
          and l.status in ('Won', 'Lost')
          and date_trunc('month', (coalesce(l.status_updated_at, l.updated_at) at time zone 'Asia/Manila'))
              = date_trunc('month', (now() at time zone 'Asia/Manila')))             as closed_out_this_month
  )

  select jsonb_build_object(
    'generated_at', now(),
    'window_months', v_months,

    'team', jsonb_build_object(
      'active_agents',    t.active_agents,
      'agents_in_pool',   t.agents_in_pool,
      'open_assigned',    t.open_assigned,
      'open_unassigned',  t.open_unassigned,
      'stale_assigned',   t.stale_assigned,
      'leads_per_agent',  case when t.active_agents > 0
                               then round(t.open_assigned::numeric / t.active_agents, 1)
                               else null end
    ),

    'top_agents', coalesce((
      select jsonb_agg(ranked_json.x order by ranked_json.rank)
      from (
        select jsonb_build_object(
                 'user_id',        r.id,
                 'name',           r.name,
                 'won_90d',        r.won_90d,
                 'composite',      r.composite_score,
                 'is_grace',       r.is_grace,
                 'assigned_count', r.assigned_count,
                 'response_secs',  r.median_response_seconds
               ) as x,
               row_number() over (
                 order by r.won_90d desc, r.composite_score desc nulls last, r.name
               ) as rank
        from ranked r
      ) ranked_json
      where ranked_json.rank <= 3
    ), '[]'::jsonb),

    'pipeline', coalesce((
      select jsonb_agg(jsonb_build_object('status', p.status, 'count', p.lead_count)
                       order by p.sort_order)
      from pipeline p
    ), '[]'::jsonb),

    'closed_by_month', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(bm.month, 'YYYY-MM'), 'won', bm.won)
                       order by bm.month)
      from by_month bm
    ), '[]'::jsonb),

    'sales', jsonb_build_object(
      'won_total',        sl.won_total,
      'months_with_data', sl.months_with_data,
      'mean_per_month',   sl.mean_per_month,
      'median_per_month', sl.median_per_month
    ),

    -- Suppressed until there is enough history for the number to mean anything.
    -- The progress counters double as the nudge to keep tagging.
    'forecast', case
      when sl.won_total >= 10 and sl.months_with_data >= 6 then
        jsonb_build_object(
          'available', true,
          'low',   sl.run_rate_low,
          'high',  sl.run_rate_high,
          'mid',   sl.run_rate_3mo,
          -- Run-rate only for now. The pipeline-weighted half of the blend needs
          -- P(Won | stage) measured from this workspace's own history, which does
          -- not exist yet -- see the plan, section 04.
          'basis', 'run_rate_3mo'
        )
      else
        jsonb_build_object(
          'available',        false,
          'reason',           case when sl.won_total < 10 then 'needs_won' else 'needs_history' end,
          'won_total',        sl.won_total,
          'won_required',     10,
          'months_with_data', sl.months_with_data,
          'months_required',  6
        )
    end,

    'signals', jsonb_build_object(
      'speed_to_lead_seconds',   sg.speed_to_lead_seconds,
      'appts_set_30d',           sg.appts_set_30d,
      'appts_completed',         sg.appts_completed,
      'appts_no_show',           sg.appts_no_show,
      'appts_awaiting_outcome',  sg.appts_awaiting_outcome,
      'show_rate', case when (sg.appts_completed + sg.appts_no_show) > 0
                        then round(sg.appts_completed::numeric
                                   / (sg.appts_completed + sg.appts_no_show), 3)
                        else null end,
      'ai_messages_30d',         sg.ai_messages_30d,
      'closed_out_this_month',   sg.closed_out_this_month
    ),

    -- Precomputed so the page never has to infer "not set up" from a zero.
    'states', jsonb_build_object(
      'no_agents',           t.active_agents = 0,
      'agents_not_routing',  t.active_agents > 0 and t.agents_in_pool = 0,
      'no_assigned_leads',   t.active_agents > 0 and t.open_assigned = 0,
      'no_won',              sl.won_total = 0,
      'thin_history',        sl.won_total > 0 and sl.months_with_data < 6,
      'no_scores',           not exists (
                               select 1 from public.agent_performance_scores s
                               where s.client_id = v_client
                             ),
      'outcomes_unanswered', sg.appts_awaiting_outcome > 0
                             and (sg.appts_completed + sg.appts_no_show) = 0
    )
  )
  into v_result
  from team t, sales sl, signals sg;

  return v_result;
end;
$$;

comment on function public.get_client_overview(int) is
  'Workspace roll-up for the client_admin/manager Overview page. Scopes to the '
  'caller''s own client_id -- never accepts one. Closed sales are manually '
  'tagged Won leads, counted by current status and bucketed on status_updated_at.';

-- Callable by logged-in users only; the role and workspace gates are inside the
-- function. anon must never reach a definer function that reads leads.
revoke all on function public.get_client_overview(int) from public;
revoke all on function public.get_client_overview(int) from anon;
grant execute on function public.get_client_overview(int) to authenticated;

-- Supports the monthly Won bucketing and the stale-lead scan.
create index if not exists idx_leads_client_status_updated
  on public.leads (client_id, status, status_updated_at desc);
