-- Morning digest rows, one per client per day, written by the daily-digest
-- edge function at 6:15 AM Manila. metrics jsonb: {new_leads, baymo_handled,
-- turned_warm, turned_hot, automation_active}; suggestions jsonb: array of
-- {lead_id, name, temperature, assigned_user_id, reason}.
-- (Applied to prod 2026-07-11 via MCP apply_migration `daily_digests`.)
create table if not exists public.daily_digests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  digest_date date not null,
  metrics jsonb not null default '{}'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (client_id, digest_date)
);

alter table public.daily_digests enable row level security;

-- All client members may read their client's digest (agents filter the
-- suggestions list to their own leads app-side). Writes: service role only.
create policy daily_digests_select on public.daily_digests for select using (
  get_my_role() = 'baymo_admin' or client_id = get_my_client_id()
);

-- Does my client have any live campaign? Used by the mobile Home strip to show
-- "BaMo automation is off — activate a campaign" instead of a dead zero.
-- SECURITY DEFINER because the campaigns table itself is not client-readable.
create or replace function public.client_has_active_campaign()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from campaigns
    where client_id = get_my_client_id()
      and status = 'active' and is_active = true
  );
$$;

revoke all on function public.client_has_active_campaign() from public;
grant execute on function public.client_has_active_campaign() to authenticated;
