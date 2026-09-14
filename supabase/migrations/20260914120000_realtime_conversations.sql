-- Publish conversations over Realtime so the inbox updates itself.
--
-- The inbox had no live updates at all: a reply that arrived while an agent sat
-- on the page stayed invisible until they reloaded. The client side now opens a
-- postgres_changes subscription, but Realtime only forwards rows for tables that
-- are members of the supabase_realtime publication -- a subscription to a table
-- outside it still reports SUBSCRIBED and then silently never fires. So the
-- publication membership is the half that has to live in the schema.
--
-- Only INSERTs on conversations are needed: every new message is an insert, and
-- the conversations_update_lead_last_message trigger keeps the list ordering
-- correct once the client refetches.
--
-- Access is NOT widened here. Realtime evaluates each table's RLS policies per
-- subscriber, so conversations_select still decides what a given agent receives:
-- baymo_admin sees everything, a client user sees their workspace, and an agent
-- sees only leads assigned to them. get_my_role() and lead_assigned_to_me() are
-- both SECURITY DEFINER, so they resolve correctly under the Realtime session.

-- Supabase projects ship this publication, but a database restored from the
-- baseline alone may not have it. FOR ALL TABLES is deliberately not used: that
-- would publish every table in the schema.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end
$$;

-- Adding a table that is already a member raises duplicate_object, so this is
-- guarded to keep the migration re-runnable.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end
$$;

-- The default REPLICA IDENTITY (primary key) is enough for INSERT payloads,
-- which always carry the full new row. It is stated explicitly so a later
-- change to this table does not silently start shipping partial payloads.
alter table public.conversations replica identity default;
