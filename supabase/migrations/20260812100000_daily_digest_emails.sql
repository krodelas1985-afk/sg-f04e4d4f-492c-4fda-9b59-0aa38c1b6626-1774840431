-- Morning digest email — send ledger + recipient resolver (2026-08-12)
--
-- The 6:15 AM Manila daily digest has always been push + in-app only, and push
-- has never reached a handset (209 sends → 0 buzzes; 1 of 9 users holds a
-- token). Email is the channel that demonstrably works for this audience — the
-- same conclusion that produced the W9 lead-alert emailer. This migration adds
-- the ledger and the recipient resolver; the send itself lives in the
-- `daily-digest` edge function, which already has the metrics and suggestions
-- assembled in memory.

create table if not exists public.daily_digest_emails (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  digest_date date not null,
  to_emails   text[],
  subject     text,
  status      text not null default 'sending'
              check (status in ('sending', 'sent', 'failed', 'suppressed')),
  provider_id text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One send per client per digest day. The edge function inserts the claim row
-- BEFORE calling Resend, so a retried or overlapping cron tick collides on this
-- index instead of mailing the client twice.
create unique index if not exists daily_digest_emails_client_date_key
  on public.daily_digest_emails (client_id, digest_date);

alter table public.daily_digest_emails enable row level security;

-- Ops-only visibility; the edge function writes as service_role, which bypasses
-- RLS. Nothing client-facing reads this table.
drop policy if exists daily_digest_emails_admin_read on public.daily_digest_emails;
create policy daily_digest_emails_admin_read on public.daily_digest_emails
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'baymo_admin'
    )
  );

revoke all on public.daily_digest_emails from anon, authenticated;
grant select on public.daily_digest_emails to authenticated;

-- Recipients for a client's morning digest: the workspace's active client_admins
-- who have not switched the daily digest off. Same regex guard and clients.email
-- fallback as resolve_lead_recipients()/pending_lead_alerts().
--
-- The fallback fires only when the workspace has NO reachable client_admin at
-- all. It deliberately does NOT fire when the admins exist but have opted out —
-- collapsing those two cases would let clients.email defeat the opt-out and mail
-- someone who turned the digest off.
create or replace function public.digest_email_recipients(p_client_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_has_admin boolean;
  v_emails    text[];
begin
  select count(*) > 0,
         array_agg(distinct p.email) filter (where coalesce(np.daily_digest, true))
    into v_has_admin, v_emails
    from public.profiles p
    left join public.notification_preferences np on np.user_id = p.id
   where p.client_id = p_client_id
     and p.role = 'client_admin'
     and p.is_active
     and p.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$';

  if v_has_admin then
    return coalesce(v_emails, '{}'::text[]);  -- all opted out → mail nobody
  end if;

  return (
    select case
             when cl.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
             then array[cl.email]
           end
      from public.clients cl
     where cl.id = p_client_id
  );
end;
$$;

-- Supabase grants EXECUTE to anon/authenticated by default; REVOKE FROM public
-- alone would not close it.
revoke all on function public.digest_email_recipients(uuid) from public, anon, authenticated;
