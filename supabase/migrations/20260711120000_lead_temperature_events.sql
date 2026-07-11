-- Temperature-change history: the daily digest needs "turned Warm/Hot yesterday",
-- but leads only stores the CURRENT temperature. Log every change via trigger.
-- (Applied to prod 2026-07-11 via MCP apply_migration `lead_temperature_events`.)
create table if not exists public.lead_temperature_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  client_id uuid not null,
  from_temperature text,
  to_temperature text not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_lte_client_changed
  on public.lead_temperature_events (client_id, changed_at desc);
create index if not exists idx_lte_lead
  on public.lead_temperature_events (lead_id);

alter table public.lead_temperature_events enable row level security;

-- Read mirrors leads visibility: baymo_admin all; client members their client;
-- agents only events on their own assigned leads. Writes are trigger-only
-- (security definer) — no INSERT/UPDATE/DELETE policies on purpose.
create policy lte_select on public.lead_temperature_events for select using (
  get_my_role() = 'baymo_admin'
  or (
    client_id = get_my_client_id()
    and (get_my_role() <> 'agent' or lead_assigned_to_me(lead_id))
  )
);

create or replace function public.log_lead_temperature_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.lead_temperature is not null then
      insert into lead_temperature_events (lead_id, client_id, from_temperature, to_temperature)
      values (new.id, new.client_id, null, new.lead_temperature);
    end if;
  elsif new.lead_temperature is distinct from old.lead_temperature
        and new.lead_temperature is not null then
    insert into lead_temperature_events (lead_id, client_id, from_temperature, to_temperature)
    values (new.id, new.client_id, old.lead_temperature, new.lead_temperature);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_temperature_event on public.leads;
create trigger trg_leads_temperature_event
  after insert or update of lead_temperature on public.leads
  for each row execute function public.log_lead_temperature_event();
