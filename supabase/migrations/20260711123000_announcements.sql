-- Announcements: platform-wide notes from BaMo (scope='baymo', client_id null)
-- and per-client notes from client admins (scope='client'). Mobile shows them
-- read-only on the dashboard; authoring happens in the CRM /announcements page.
-- (Applied to prod 2026-07-11 via MCP apply_migration `announcements`.)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'client' check (scope in ('baymo','client')),
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_scope_client check (
    (scope = 'baymo' and client_id is null) or (scope = 'client' and client_id is not null)
  )
);

create index if not exists idx_announcements_client on public.announcements (client_id, created_at desc);

alter table public.announcements enable row level security;

-- Everyone signed in sees platform-wide announcements + their own client's.
create policy announcements_select on public.announcements for select using (
  get_my_role() = 'baymo_admin'
  or scope = 'baymo'
  or client_id = get_my_client_id()
);

-- baymo_admin writes anything; client_admin only their own client-scoped rows.
create policy announcements_insert on public.announcements for insert with check (
  get_my_role() = 'baymo_admin'
  or (get_my_role() = 'client_admin' and scope = 'client' and client_id = get_my_client_id())
);
create policy announcements_update on public.announcements for update using (
  get_my_role() = 'baymo_admin'
  or (get_my_role() = 'client_admin' and scope = 'client' and client_id = get_my_client_id())
);
create policy announcements_delete on public.announcements for delete using (
  get_my_role() = 'baymo_admin'
  or (get_my_role() = 'client_admin' and scope = 'client' and client_id = get_my_client_id())
);
