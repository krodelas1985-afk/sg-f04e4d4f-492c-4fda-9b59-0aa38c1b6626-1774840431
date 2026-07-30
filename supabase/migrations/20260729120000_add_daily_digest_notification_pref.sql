-- Daily digest ("Your BaMo morning update ☀️") becomes a real push type.
-- Until now push-dispatch had no POLICY entry for type='daily_digest', so every
-- digest notification fell through the unknown-type branch: stamped pushed_at,
-- never sent. Giving it a pref column lets it be gated like every other push.
alter table public.notification_preferences
  add column if not exists daily_digest boolean not null default true;

comment on column public.notification_preferences.daily_digest is
  'Push the 6:15 AM Manila daily digest / morning update. Default on.';
