-- Ad source quality — which ads produce leads worth having, not just leads.
--
-- Joins fb_ad_id to the deterministic engagement signals in v_lead_derived_signals plus
-- temperature/grade/viewing outcomes. Feeds Ads Manager as much as the CRM.
--
-- Findings that shaped this (verified 2026-08-10):
--
--   * fb_ad_id is 46.8% filled, and the missing 53% is NOT recoverable: zero of the 571
--     unattributed leads carry any ad reference anywhere in metadata. They arrived without
--     an ad referral. "No ad" is therefore a legitimate category to compare against, not a
--     defect to be backfilled — so it gets its own row rather than being dropped.
--
--   * Three whole clients sit at 0% attribution (Joyce Cuenca 121 leads, BaMo 102,
--     Arleen Pecho 20). Grouping by client as well as ad keeps that from looking like one
--     enormous "unattributed" bucket.
--
--   * Only 8 distinct ads exist across 503 attributed leads, and only one client
--     (Mary Ann) has enough ads to compare. Small-n caution applies; no minimum lead count
--     is baked in here — the consumer decides what is enough.
--
-- No thresholds, no "good/bad" labels. Counts and rates only.

create or replace view public.v_ad_source_quality as
select
  l.client_id,
  c.name                                   as client_name,
  l.fb_ad_id,
  (l.fb_ad_id is not null)                 as is_attributed,

  count(*)                                 as leads,

  -- engagement (deterministic, from conversations)
  round(avg(d.typed_inbound), 2)           as avg_typed_inbound,
  round(avg(d.reciprocal_replies), 2)      as avg_reciprocal_replies,
  round(avg(d.questions_asked_back), 2)    as avg_questions_asked_back,
  round(percentile_cont(0.5) within group (order by d.median_reply_latency_mins)::numeric, 1)
                                           as median_reply_latency_mins,

  -- tyre-kickers: every inbound was a tapped ad quick-reply, nothing typed
  count(*) filter (where d.typed_inbound = 0)                        as canned_only_leads,
  round(100.0 * count(*) filter (where d.typed_inbound = 0) / count(*), 1) as pct_canned_only,

  -- progression
  count(*) filter (where l.status = 'Viewing')                       as reached_viewing,
  round(100.0 * count(*) filter (where l.status = 'Viewing') / count(*), 1) as pct_viewing,

  count(*) filter (where l.lead_temperature = 'Hot')                 as hot,
  count(*) filter (where l.lead_temperature = 'Warm')                as warm,
  count(*) filter (where l.lead_temperature = 'Cold')                as cold,
  round(100.0 * count(*) filter (where l.lead_temperature = 'Hot') / count(*), 1) as pct_hot,

  round(avg(l.lead_grade_score), 1)        as avg_grade_score,

  min(l.created_at)                        as first_lead_at,
  max(l.created_at)                        as last_lead_at

from public.leads l
join public.clients c on c.id = l.client_id
left join public.v_lead_derived_signals d on d.lead_id = l.id
group by l.client_id, c.name, l.fb_ad_id;

comment on view public.v_ad_source_quality is
  'Per client and fb_ad_id: lead volume, deterministic engagement, canned-only share, viewing/temperature progression and average grade. Unattributed leads appear as their own row (fb_ad_id null) because the absence is real, not missing data. No thresholds applied.';

alter view public.v_ad_source_quality set (security_invoker = on);
revoke all on public.v_ad_source_quality from anon, public;
grant select on public.v_ad_source_quality to authenticated;
