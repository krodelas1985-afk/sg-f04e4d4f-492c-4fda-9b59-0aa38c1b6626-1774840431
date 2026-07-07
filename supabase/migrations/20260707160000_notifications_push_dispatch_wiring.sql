-- ============================================================================
-- Notifications Phase 1 — server-side push dispatch wiring.
-- Applied live to zyfkjxepykwpfzmkxitb 2026-07-07 (captured here per the
-- regenerate/commit-after-in-DB-change rule). The `push-dispatch` edge function
-- is deployed separately (mobile repo supabase/functions/push-dispatch).
--
-- Auth model: pg_cron calls the edge function with a Vault-held shared secret in
-- the x-dispatch-secret header; the function validates it via
-- check_push_dispatch_secret(). No hand-set edge secret required (the platform
-- auto-injects SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).
-- ============================================================================

-- 1. Shared secret in Vault (generated once; value never leaves the DB).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_dispatch_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'push_dispatch_secret',
      'Shared secret: pg_cron -> push-dispatch edge function'
    );
  end if;
end $$;

-- 2. Validator the edge function calls (SECURITY DEFINER reads Vault as owner).
create or replace function public.check_push_dispatch_secret(p text)
returns boolean
language sql
security definer
set search_path = vault, public
as $$
  select exists (
    select 1 from vault.decrypted_secrets
     where name = 'push_dispatch_secret' and decrypted_secret = p
  );
$$;
revoke all on function public.check_push_dispatch_secret(text) from public, anon, authenticated;
grant execute on function public.check_push_dispatch_secret(text) to service_role;

-- 3. Dispatch sweep every minute: drains notifications.pushed_at IS NULL.
--    Harmless with no registered devices (no tokens -> no sends); the moment a
--    device registers a push token, delivery begins.
select cron.schedule('push-dispatch-sweep', '* * * * *', $j$
  select net.http_post(
    url := 'https://zyfkjxepykwpfzmkxitb.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_secret')),
    body := '{}'::jsonb
  );
$j$);
