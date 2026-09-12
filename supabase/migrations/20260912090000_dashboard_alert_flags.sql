-- Dashboard "Needs your attention": flag the leads we emailed an alert about.
--
-- lead_alert_emails already records every hot / viewing / hot_viewing alert the
-- emailer (W9) sends, but the only SELECT policy on it was baymo_admin-only --
-- so the workspace that actually received the email could not see the flag in
-- the CRM. Two changes:
--   1. a workspace-scoped read on lead_alert_emails, and
--   2. lead_alert_reads, a per-user dismissal log behind the "mark read" action.

-- 1. authenticated was never granted SELECT on this table, so the pre-existing
-- baymo_admin policy has been dead since the table shipped. anon stays with no
-- grant at all.
grant select on public.lead_alert_emails to authenticated;

-- Read parity with the lead itself. Policy expressions are not security
-- definer, so this subquery is subject to the leads SELECT policy: an agent
-- sees alerts for the leads assigned to them, a client_admin sees the
-- workspace, and the rule can never drift from lead visibility because it is
-- not restated here.

create policy lead_alert_emails_workspace_read
  on public.lead_alert_emails
  for select
  to authenticated
  using (
    exists (select 1 from public.leads l where l.id = lead_alert_emails.lead_id)
  );

-- The dashboard reads "newest alerts for visible leads"; the emailer writes by
-- lead. Both want this.
create index if not exists idx_lead_alert_emails_lead_created
  on public.lead_alert_emails (lead_id, created_at desc);

-- 2. Dismissals are per person: one agent clearing a flag must not clear it for
-- the colleague who was copied on the same alert email.
create table if not exists public.lead_alert_reads (
  user_id  uuid        not null references auth.users(id)              on delete cascade,
  alert_id uuid        not null references public.lead_alert_emails(id) on delete cascade,
  read_at  timestamptz not null default now(),
  primary key (user_id, alert_id)
);

alter table public.lead_alert_reads enable row level security;

-- New tables in this project are granted to anon by default; alerts are internal.
revoke all on public.lead_alert_reads from anon, public;
grant select, insert, delete on public.lead_alert_reads to authenticated;

create policy lead_alert_reads_own_select on public.lead_alert_reads
  for select to authenticated using (user_id = auth.uid());

create policy lead_alert_reads_own_insert on public.lead_alert_reads
  for insert to authenticated with check (user_id = auth.uid());

-- Delete is the undo: unmarking a flag brings it back to the card.
create policy lead_alert_reads_own_delete on public.lead_alert_reads
  for delete to authenticated using (user_id = auth.uid());
