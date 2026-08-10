-- Phase 2 — derived lead signals (read-only, no new capture).
--
-- Computes the deterministic "Group A" signals from data already in public.conversations.
-- Nothing is stored and nothing is decided here: no thresholds are baked in, no lead is
-- classified. Where a cut-off is unavoidable (quiet-gap length) several are exposed side by
-- side so the choice stays open.
--
-- Retroactive: conversations go back to 2024-12-19, so this yields full history immediately.
--
-- Two views:
--   v_canned_messages        — the FB ad quick-reply registry, self-maintaining
--   v_lead_derived_signals   — one row per lead

-- ===========================================================================
-- Canned-message registry
-- ===========================================================================
-- An inbound message whose exact text appears for >= 5 distinct leads is a tapped ad
-- quick-reply button, not something a human typed. ("What is the price range of homes?"
-- occurs verbatim for 188 distinct leads.)
--
-- The >= 5 cut-off is a starting value, not a decision. Raising or lowering it only widens
-- or narrows this view; no downstream logic depends on the exact number.

create or replace view public.v_canned_messages as
select c.message_content
from public.conversations c
where c.direction = 'inbound'
  and c.message_content is not null
  and btrim(c.message_content) <> ''
group by c.message_content
having count(distinct c.lead_id) >= 5;

comment on view public.v_canned_messages is
  'Inbound message texts appearing verbatim across >=5 distinct leads — i.e. ad quick-reply buttons rather than typed messages. Self-maintaining as new ads launch.';

-- ===========================================================================
-- Derived signals, one row per lead
-- ===========================================================================
create or replace view public.v_lead_derived_signals as
with enriched as (
  select
    c.lead_id,
    c.client_id,
    c.direction,
    c.created_at,
    c.message_content,
    (cm.message_content is not null) as is_canned,
    -- most recent outbound/inbound strictly before this row
    max(c.created_at) filter (where c.direction = 'outbound') over w as prev_outbound_at,
    max(c.created_at) filter (where c.direction = 'inbound')  over w as prev_inbound_at
  from public.conversations c
  left join public.v_canned_messages cm
    on c.direction = 'inbound'
   and cm.message_content = c.message_content
  window w as (
    partition by c.lead_id
    order by c.created_at
    rows between unbounded preceding and 1 preceding
  )
),
marked as (
  select
    e.lead_id,
    e.client_id,
    e.direction,
    e.created_at,
    e.message_content,
    e.is_canned,
    e.prev_outbound_at,
    e.prev_inbound_at,
    (e.direction = 'inbound' and not e.is_canned) as is_typed,
    (e.direction = 'inbound' and e.prev_outbound_at is not null) as after_outbound,
    -- Latency is measured only on the FIRST inbound following one of our messages.
    -- Without this, a burst of five messages would count as five "replies".
    case
      when e.direction = 'inbound'
       and e.prev_outbound_at is not null
       and (e.prev_inbound_at is null or e.prev_inbound_at < e.prev_outbound_at)
      then extract(epoch from (e.created_at - e.prev_outbound_at)) / 60.0
    end as reply_latency_mins,
    case
      when e.direction = 'inbound' and e.prev_inbound_at is not null
      then extract(epoch from (e.created_at - e.prev_inbound_at)) / 86400.0
    end as gap_days
  from enriched e
)
select
  m.lead_id,
  -- uuid has no max(); array_agg keeps this one row per lead even if client_id ever varies
  (array_agg(m.client_id order by m.created_at))[1] as client_id,

  -- volume
  count(*) filter (where m.direction = 'inbound')  as inbound_count,
  count(*) filter (where m.direction = 'outbound') as outbound_count,
  count(*) filter (where m.is_typed)               as typed_inbound,
  count(*) filter (where m.direction = 'inbound' and m.is_canned) as canned_inbound,

  -- turn-taking: typed messages sent after we had spoken
  count(*) filter (where m.is_typed and m.after_outbound) as reciprocal_replies,

  -- the lead's own questions (distinct from BaMo's questions in leads.questions_asked)
  count(*) filter (
    where m.is_typed
      and (
        m.message_content like '%?%'
        or m.message_content ~* '\y(magkano|ano ang|anong|saan|paano|kailan|pwede|meron|available|how much|what|where|when|can i|do you)\y'
      )
  ) as questions_asked_back,

  -- effort
  coalesce(sum(length(m.message_content)) filter (where m.is_typed), 0) as typed_chars,
  round(avg(length(m.message_content)) filter (where m.is_typed), 1)    as avg_typed_len,
  max(length(m.message_content)) filter (where m.is_typed)              as max_typed_len,

  -- shape of the conversation
  count(distinct (m.created_at at time zone 'Asia/Manila')::date)
    filter (where m.direction = 'inbound')                        as active_days,
  min(m.created_at) filter (where m.direction = 'inbound')        as first_inbound_at,
  max(m.created_at) filter (where m.direction = 'inbound')        as last_inbound_at,
  round((extract(epoch from (
      max(m.created_at) filter (where m.direction = 'inbound')
    - min(m.created_at) filter (where m.direction = 'inbound')
  )) / 86400.0)::numeric, 2)                                      as span_days,
  round((extract(epoch from (
      now() - max(m.created_at) filter (where m.direction = 'inbound')
  )) / 86400.0)::numeric, 2)                                      as days_since_last_inbound,

  -- responsiveness
  round(percentile_cont(0.5) within group (order by m.reply_latency_mins)::numeric, 1)
                                                                  as median_reply_latency_mins,
  round(min(m.reply_latency_mins)::numeric, 1)                    as fastest_reply_mins,
  round(max(m.reply_latency_mins)::numeric, 1)                    as slowest_reply_mins,
  count(*) filter (where m.reply_latency_mins is not null)        as measured_replies,

  -- quiet periods and returns. Three cut-offs exposed rather than one chosen.
  round(max(m.gap_days)::numeric, 2)                              as max_quiet_gap_days,
  count(*) filter (where m.gap_days >= 3)                         as returns_after_3d,
  count(*) filter (where m.gap_days >= 7)                         as returns_after_7d,
  count(*) filter (where m.gap_days >= 14)                        as returns_after_14d,

  -- of the 7-day returns: did they come back on their own, or had we just nudged them?
  count(*) filter (
    where m.gap_days >= 7
      and m.prev_outbound_at is not null
      and m.prev_outbound_at > m.prev_inbound_at
      and m.created_at - m.prev_outbound_at <= interval '24 hours'
  ) as nudged_returns_7d,
  count(*) filter (
    where m.gap_days >= 7
      and (
        m.prev_outbound_at is null
        or m.prev_outbound_at <= m.prev_inbound_at
        or m.created_at - m.prev_outbound_at > interval '24 hours'
      )
  ) as organic_returns_7d,

  -- reply time-of-day (Manila): night-shift / OFW tell
  round(
    100.0 * count(*) filter (
      where m.direction = 'inbound'
        and (
          extract(hour from m.created_at at time zone 'Asia/Manila') >= 22
          or extract(hour from m.created_at at time zone 'Asia/Manila') < 6
        )
    ) / nullif(count(*) filter (where m.direction = 'inbound'), 0)
  , 1) as night_share_pct

from marked m
group by m.lead_id;

comment on view public.v_lead_derived_signals is
  'Deterministic per-lead signals derived from conversations: volume, typed-vs-canned, reciprocity, the lead''s own questions, effort, latency, quiet gaps, organic-vs-nudged returns, night-reply share. Read-only, retroactive to 2024-12-19. No thresholds or classifications are applied.';

-- ===========================================================================
-- Access control
-- Views run with the definer's rights by default (security_invoker off in PG14),
-- which would bypass RLS on conversations. Force invoker semantics so the caller's
-- RLS applies, then grant read to authenticated only.
-- ===========================================================================
alter view public.v_canned_messages      set (security_invoker = on);
alter view public.v_lead_derived_signals set (security_invoker = on);

revoke all on public.v_canned_messages      from anon, public;
revoke all on public.v_lead_derived_signals from anon, public;

grant select on public.v_canned_messages      to authenticated;
grant select on public.v_lead_derived_signals to authenticated;
