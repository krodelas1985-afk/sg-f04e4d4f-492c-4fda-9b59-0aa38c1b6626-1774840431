-- BayMo Welcome Onboarding tour (mobile): per-user tour state + sales-signal answers.
-- Plan of record: bamo-ops/BaMo_Welcome_Onboarding_Plan.md

create table public.user_onboarding_tour (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  skipped boolean not null default false,
  steps jsonb not null default '{}'::jsonb,
  services_needed text[] not null default '{}',
  help_request text,
  listing_intent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding_tour enable row level security;

-- Owner can read/insert/update their own row; profile_id and client_id are
-- forced server-side (guard trigger below), so spoofing either is inert.
create policy tour_own_select on public.user_onboarding_tour
  for select using (profile_id = auth.uid());
create policy tour_own_insert on public.user_onboarding_tour
  for insert with check (profile_id = auth.uid());
create policy tour_own_update on public.user_onboarding_tour
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy tour_admin_select on public.user_onboarding_tour
  for select using (public.get_my_role() = 'baymo_admin');

-- Guard: client_id always mirrors the caller's profile, never client-supplied.
create or replace function public.user_onboarding_tour_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.profile_id := auth.uid();
    select p.client_id into new.client_id from public.profiles p where p.id = new.profile_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_user_onboarding_tour_guard
  before insert or update on public.user_onboarding_tour
  for each row execute function public.user_onboarding_tour_guard();

-- On completion (completed_at null -> set), notify every active baymo_admin with
-- the sales signal (services needed + help request + listing intent).
create or replace function public.notify_tour_completed()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
begin
  if new.completed_at is null or (tg_op = 'UPDATE' and old.completed_at is not null) then
    return new;
  end if;

  select coalesce(p.full_name, p.email, 'A client') into v_name
  from public.profiles p where p.id = new.profile_id;

  insert into public.notifications (user_id, client_id, type, title, body, data)
  select
    p.id,
    new.client_id,
    'onboarding_tour_completed',
    v_name || ' finished the BayMo intro',
    case
      when new.skipped then 'Skipped the tour.'
      else trim(both ' | ' from
        coalesce('Needs: ' || array_to_string(new.services_needed, ', '), '')
        || case when new.help_request is not null and new.help_request <> ''
             then ' | Asked: ' || left(new.help_request, 200) else '' end
        || case when new.listing_intent then ' | Wants to post a listing' else '' end)
    end,
    jsonb_build_object(
      'profile_id', new.profile_id,
      'client_id', new.client_id,
      'services_needed', to_jsonb(new.services_needed),
      'help_request', new.help_request,
      'listing_intent', new.listing_intent,
      'skipped', new.skipped
    )
  from public.profiles p
  where p.role = 'baymo_admin' and coalesce(p.is_active, true);

  return new;
end;
$$;

create trigger trg_notify_tour_completed
  after insert or update on public.user_onboarding_tour
  for each row execute function public.notify_tour_completed();
