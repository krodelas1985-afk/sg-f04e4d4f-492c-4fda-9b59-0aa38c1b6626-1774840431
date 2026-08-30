-- The AI Performance panel does not need live numbers -- a daily refresh is
-- enough. Computing on every /admin load cost ~75ms and ~16k buffer hits
-- against a Micro instance that has already hit connection starvation once,
-- and that cost grows with conversations. So: compute once nightly, store the
-- payload, and serve a single-row read.
--
-- Shape:
--   compute_admin_ai_metrics(p_days)  the old function body, renamed
--   admin_ai_metrics_snapshot         one row holding the computed payload
--   refresh_admin_ai_metrics()        recompute + upsert (pg_cron calls this)
--   get_admin_ai_metrics(p_days)      unchanged signature; reads the snapshot
--
-- get_admin_ai_metrics keeps its name and signature so /api/admin/stats and the
-- committed types need no change.

alter function public.get_admin_ai_metrics(int)
  rename to compute_admin_ai_metrics;

create table if not exists public.admin_ai_metrics_snapshot (
  id          int primary key default 1 check (id = 1),
  payload     jsonb not null,
  days        int not null,
  computed_at timestamptz not null default now()
);

comment on table public.admin_ai_metrics_snapshot is
  'Single-row cache of the baymo_admin AI Performance payload, refreshed nightly by pg_cron. Service-role only.';

-- Holds cross-workspace aggregates, so it must never be client-readable.
-- RLS on with no policies denies anon/authenticated outright; service_role
-- bypasses RLS. (See the n8n backup-table lesson: new tables are readable by
-- default until RLS is enabled.)
alter table public.admin_ai_metrics_snapshot enable row level security;
revoke all on table public.admin_ai_metrics_snapshot from anon;
revoke all on table public.admin_ai_metrics_snapshot from authenticated;

create or replace function public.refresh_admin_ai_metrics(p_days int default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_ai_metrics_snapshot (id, payload, days, computed_at)
  values (1, public.compute_admin_ai_metrics(p_days), p_days, now())
  on conflict (id) do update
    set payload     = excluded.payload,
        days        = excluded.days,
        computed_at = excluded.computed_at;
end;
$$;

-- Reads the snapshot, falling back to a live compute when it is missing, built
-- for a different window, or stale beyond 36h -- so a failed cron degrades to
-- slow-but-correct rather than freezing a stale number, and self-heals.
--
-- plpgsql, NOT `language sql`, and that matters: a SQL function body is planned
-- as a whole, so a COALESCE fallback made Postgres plan the big multi-CTE
-- compute query on every hot-path call -- ~79ms of pure planning even though
-- the scans never ran. plpgsql prepares each statement on first execution, so
-- the fallback is only planned if it is actually reached. Warm-connection cost
-- drops to ~0.16ms / 2 buffers.
create or replace function public.get_admin_ai_metrics(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_at      timestamptz;
begin
  select s.payload, s.computed_at
    into v_payload, v_at
  from public.admin_ai_metrics_snapshot s
  where s.id = 1
    and s.days = coalesce(p_days, 30)
    and s.computed_at > now() - interval '36 hours';

  if v_payload is not null then
    return v_payload || jsonb_build_object('computed_at', v_at, 'live', false);
  end if;

  return public.compute_admin_ai_metrics(p_days)
         || jsonb_build_object('computed_at', now(), 'live', true);
end;
$$;

comment on function public.get_admin_ai_metrics(int) is
  'baymo_admin AI performance metrics, served from the nightly snapshot (falls back to a live compute if the snapshot is missing or >36h old). Service-role only; the baymo_admin check lives in /api/admin/stats.';

revoke all on function public.compute_admin_ai_metrics(int) from public, anon, authenticated;
revoke all on function public.refresh_admin_ai_metrics(int) from public, anon, authenticated;
revoke all on function public.get_admin_ai_metrics(int) from public, anon, authenticated;
grant execute on function public.compute_admin_ai_metrics(int) to service_role;
grant execute on function public.refresh_admin_ai_metrics(int) to service_role;
grant execute on function public.get_admin_ai_metrics(int) to service_role;

-- 02:20 Manila, just after the other nightly recomputes.
select cron.schedule(
  'refresh-admin-ai-metrics-nightly',
  '20 18 * * *',
  $cron$select public.refresh_admin_ai_metrics(30)$cron$
);

-- Seed immediately so the panel is populated the moment this ships.
select public.refresh_admin_ai_metrics(30);
