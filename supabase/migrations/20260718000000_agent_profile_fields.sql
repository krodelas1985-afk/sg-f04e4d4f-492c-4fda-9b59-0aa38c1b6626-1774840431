-- Agent Profile Phase 1 (bamo-ops/BaMo_Agent_Profile_Plan.md)
-- New profile fields + profile-media storage bucket with owner-folder RLS.

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists prc_number text,
  add column if not exists company text,
  add column if not exists company_logo_url text,
  add column if not exists whatsapp text,
  add column if not exists location_province text,
  add column if not exists location_city text;

-- Public bucket for profile photos & company logos.
-- Images only, 5 MB cap (client compresses to ~512px avatar / ~1024px logo anyway).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owner-folder RLS: authenticated users manage files only under {auth.uid()}/...;
-- reads are open (bucket is public — URLs are embedded in app/CRM).
create policy "profile_media_public_read" on storage.objects
  for select using (bucket_id = 'profile-media');

create policy "profile_media_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile_media_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile_media_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
