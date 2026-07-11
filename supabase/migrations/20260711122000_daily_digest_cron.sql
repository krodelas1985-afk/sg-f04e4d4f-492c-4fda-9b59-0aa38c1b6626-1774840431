-- 6:15 AM Manila (22:15 UTC): generate yesterday's digest for every client.
-- Mirrors the push-dispatch cron pattern: pg_net POST with the Vault-held
-- secret; the daily-digest edge fn validates via check_push_dispatch_secret().
-- (Applied to prod 2026-07-11 via MCP apply_migration `daily_digest_cron`.)
SELECT cron.schedule(
  'daily-digest-6am-manila',
  '15 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyfkjxepykwpfzmkxitb.supabase.co/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-digest-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='push_dispatch_secret')),
    body := '{}'::jsonb);
  $$
);
