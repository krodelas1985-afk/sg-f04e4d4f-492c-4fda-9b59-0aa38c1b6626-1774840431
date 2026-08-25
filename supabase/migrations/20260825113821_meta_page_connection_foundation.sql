-- Meta/Facebook self-service Page connection foundation.
--
-- Token-bearing tables are intentionally server-only. They live in public so
-- PostgREST can be used by the Ads Manager service-role client, but anon and
-- authenticated receive no table privileges and there are no user policies.

create table public.meta_oauth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  ticket_hash text unique,
  state_hash text unique,
  browser_session_hash text unique,
  status text not null default 'ticket_issued'
    check (status in (
      'ticket_issued',
      'authorization_started',
      'awaiting_page_selection',
      'completed',
      'failed',
      'expired'
    )),
  pending_fb_user_id text,
  pending_fb_user_name text,
  pending_granted_scopes text[] not null default '{}',
  pending_user_token_encrypted text,
  pending_pages_encrypted text,
  error_code text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meta_oauth_sessions_expiry_idx
  on public.meta_oauth_sessions (expires_at)
  where status not in ('completed', 'expired');

create table public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  fb_user_id text not null,
  fb_user_name text,
  user_access_token_encrypted text,
  granted_scopes text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'revoked', 'token_invalid')),
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meta_connections_fb_user_idx
  on public.meta_connections (fb_user_id);

create table public.meta_pages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique
    references public.meta_connections(id) on delete cascade,
  client_id uuid not null unique references public.clients(id) on delete cascade,
  page_id text not null unique,
  page_name text not null,
  page_access_token_encrypted text,
  page_tasks text[] not null default '{}',
  subscribed_fields text[] not null default '{}',
  subscription_status text not null default 'pending'
    check (subscription_status in ('pending', 'active', 'failed', 'revoked')),
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  connection_id uuid references public.meta_connections(id) on delete set null,
  provider text not null default 'meta' check (provider in ('meta')),
  event_type text not null,
  status text not null check (status in ('success', 'warning', 'error')),
  message text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index integration_events_client_created_idx
  on public.integration_events (client_id, created_at desc);

create table public.meta_data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  fb_user_id_hash text not null,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.ad_social_accounts
  add column if not exists source text not null default 'operator'
  check (source in ('operator', 'client_oauth'));

alter table public.meta_oauth_sessions enable row level security;
alter table public.meta_connections enable row level security;
alter table public.meta_pages enable row level security;
alter table public.integration_events enable row level security;
alter table public.meta_data_deletion_requests enable row level security;

revoke all on table public.meta_oauth_sessions from anon, authenticated;
revoke all on table public.meta_connections from anon, authenticated;
revoke all on table public.meta_pages from anon, authenticated;
revoke all on table public.integration_events from anon, authenticated;
revoke all on table public.meta_data_deletion_requests from anon, authenticated;

grant all on table public.meta_oauth_sessions to service_role;
grant all on table public.meta_connections to service_role;
grant all on table public.meta_pages to service_role;
grant all on table public.integration_events to service_role;
grant all on table public.meta_data_deletion_requests to service_role;

create or replace function public.save_meta_page_connection(
  p_session_id uuid,
  p_client_id uuid,
  p_fb_user_id text,
  p_fb_user_name text,
  p_user_token_encrypted text,
  p_granted_scopes text[],
  p_page_id text,
  p_page_name text,
  p_page_token_encrypted text,
  p_page_token_legacy text,
  p_page_tasks text[],
  p_subscribed_fields text[]
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_connection_id uuid;
  v_existing_client_id uuid;
  v_social_account_id uuid;
begin
  select client_id
    into v_existing_client_id
    from public.meta_pages
   where page_id = p_page_id
   for update;

  if v_existing_client_id is not null and v_existing_client_id <> p_client_id then
    raise exception 'facebook_page_already_connected';
  end if;

  insert into public.meta_connections (
    client_id,
    fb_user_id,
    fb_user_name,
    user_access_token_encrypted,
    granted_scopes,
    status,
    connected_at,
    last_verified_at,
    revoked_at,
    updated_at
  ) values (
    p_client_id,
    p_fb_user_id,
    p_fb_user_name,
    p_user_token_encrypted,
    coalesce(p_granted_scopes, '{}'),
    'active',
    now(),
    now(),
    null,
    now()
  )
  on conflict (client_id) do update set
    fb_user_id = excluded.fb_user_id,
    fb_user_name = excluded.fb_user_name,
    user_access_token_encrypted = excluded.user_access_token_encrypted,
    granted_scopes = excluded.granted_scopes,
    status = 'active',
    connected_at = now(),
    last_verified_at = now(),
    revoked_at = null,
    updated_at = now()
  returning id into v_connection_id;

  delete from public.meta_pages
   where client_id = p_client_id
     and page_id <> p_page_id;

  insert into public.meta_pages (
    connection_id,
    client_id,
    page_id,
    page_name,
    page_access_token_encrypted,
    page_tasks,
    subscribed_fields,
    subscription_status,
    connected_at,
    last_verified_at,
    updated_at
  ) values (
    v_connection_id,
    p_client_id,
    p_page_id,
    p_page_name,
    p_page_token_encrypted,
    coalesce(p_page_tasks, '{}'),
    coalesce(p_subscribed_fields, '{}'),
    'active',
    now(),
    now(),
    now()
  )
  on conflict (client_id) do update set
    connection_id = excluded.connection_id,
    page_id = excluded.page_id,
    page_name = excluded.page_name,
    page_access_token_encrypted = excluded.page_access_token_encrypted,
    page_tasks = excluded.page_tasks,
    subscribed_fields = excluded.subscribed_fields,
    subscription_status = 'active',
    connected_at = now(),
    last_verified_at = now(),
    updated_at = now();

  -- Compatibility bridge for the live CRM and n8n consumers. The encrypted
  -- canonical copy lives in meta_pages; this legacy plaintext column is
  -- retired only after every existing consumer reads through a server helper.
  update public.clients
     set fb_page_id = p_page_id,
         fb_page_token = p_page_token_legacy
   where id = p_client_id;

  select id
    into v_social_account_id
    from public.ad_social_accounts
   where platform = 'facebook'
     and account_id = p_page_id
   limit 1
   for update;

  if v_social_account_id is null then
    insert into public.ad_social_accounts (
      client_id,
      platform,
      account_id,
      account_name,
      access_token,
      token_expires_at,
      is_active,
      meta,
      source
    ) values (
      p_client_id,
      'facebook',
      p_page_id,
      p_page_name,
      p_page_token_legacy,
      null,
      true,
      '{}'::jsonb,
      'client_oauth'
    );
  else
    update public.ad_social_accounts
       set client_id = p_client_id,
           account_name = p_page_name,
           access_token = p_page_token_legacy,
           token_expires_at = null,
           is_active = true,
           source = 'client_oauth'
     where id = v_social_account_id;
  end if;

  update public.meta_oauth_sessions
     set status = 'completed',
         pending_user_token_encrypted = null,
         pending_pages_encrypted = null,
         ticket_hash = null,
         state_hash = null,
         browser_session_hash = null,
         updated_at = now()
   where id = p_session_id
     and client_id = p_client_id;

  insert into public.integration_events (
    client_id,
    connection_id,
    event_type,
    status,
    message,
    metadata
  ) values (
    p_client_id,
    v_connection_id,
    'meta_page_connected',
    'success',
    'Facebook Page connected and webhook subscription verified',
    jsonb_build_object('page_id', p_page_id, 'subscribed_fields', p_subscribed_fields)
  );

  return v_connection_id;
end;
$$;

revoke all on function public.save_meta_page_connection(
  uuid, uuid, text, text, text, text[], text, text, text, text, text[], text[]
) from public, anon, authenticated;
grant execute on function public.save_meta_page_connection(
  uuid, uuid, text, text, text, text[], text, text, text, text, text[], text[]
) to service_role;

comment on table public.meta_oauth_sessions is
  'Short-lived, server-only state for Meta OAuth and explicit Page selection.';
comment on column public.meta_oauth_sessions.pending_user_token_encrypted is
  'AES-256-GCM ciphertext. Never store or log a plaintext Meta token.';
comment on column public.meta_oauth_sessions.pending_pages_encrypted is
  'AES-256-GCM ciphertext containing the temporary Page choices and Page tokens.';
comment on table public.meta_connections is
  'Server-only Meta user grant for one BaMo client workspace.';
comment on table public.meta_pages is
  'Server-only selected Facebook Page and encrypted Page access token.';
comment on table public.integration_events is
  'Token-free audit events for external integrations.';
