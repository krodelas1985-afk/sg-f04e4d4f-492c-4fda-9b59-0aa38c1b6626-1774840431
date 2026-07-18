-- A profile's personal details belong to the person. Only the owner (or BaMo
-- staff) may change them; a client_admin managing their workspace keeps role /
-- is_active control but can no longer edit an agent's identity fields.

create or replace function public.enforce_profile_personal_fields_owner_only()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Service role / internal jobs (provisioning) have no JWT user.
  if auth.uid() is null then
    return new;
  end if;
  if new.id = auth.uid() then
    return new;
  end if;
  if get_my_role() = 'baymo_admin' then
    return new;
  end if;

  if (new.full_name        is distinct from old.full_name)
  or (new.phone            is distinct from old.phone)
  or (new.prc_number       is distinct from old.prc_number)
  or (new.company          is distinct from old.company)
  or (new.company_logo_url is distinct from old.company_logo_url)
  or (new.whatsapp         is distinct from old.whatsapp)
  or (new.avatar_url       is distinct from old.avatar_url)
  or (new.service_area     is distinct from old.service_area)
  or (new.location_province is distinct from old.location_province)
  or (new.location_city    is distinct from old.location_city)
  then
    raise exception 'Only the account owner can edit their personal profile details';
  end if;

  return new;
end;
$$;

create trigger trg_enforce_profile_personal_fields
  before update on public.profiles
  for each row execute function public.enforce_profile_personal_fields_owner_only();

-- Storage must match: a client_admin can no longer write into another user's
-- profile-media folder (otherwise they could overwrite an agent's photo file).
drop policy if exists profile_media_admin_insert on storage.objects;
drop policy if exists profile_media_admin_update on storage.objects;
drop policy if exists profile_media_admin_delete on storage.objects;

create policy profile_media_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-media'
    and exists (select 1 from public.profiles me
                where me.id = auth.uid() and me.role = 'baymo_admin')
  );

create policy profile_media_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-media'
    and exists (select 1 from public.profiles me
                where me.id = auth.uid() and me.role = 'baymo_admin')
  )
  with check (
    bucket_id = 'profile-media'
    and exists (select 1 from public.profiles me
                where me.id = auth.uid() and me.role = 'baymo_admin')
  );

create policy profile_media_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-media'
    and exists (select 1 from public.profiles me
                where me.id = auth.uid() and me.role = 'baymo_admin')
  );
