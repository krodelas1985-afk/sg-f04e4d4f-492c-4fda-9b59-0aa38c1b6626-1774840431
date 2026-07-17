-- Agent Profile Phase 3 (bamo-ops/BaMo_Agent_Profile_Plan.md)
-- 1) Guard privileged profile columns. profiles_update RLS already lets
--    client_admin update same-workspace rows (and users their own row) with no
--    WITH CHECK, so before this trigger a client_admin could move a profile to
--    another workspace and any user could escalate their own role.
-- 2) Let admins manage profile-media files for their agents (CRM edit).

create or replace function public.guard_profile_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  -- No JWT user = service role / internal jobs (provisioning etc.) — bypass.
  if auth.uid() is null then
    return new;
  end if;

  caller_role := get_my_role();
  if caller_role = 'baymo_admin' then
    return new;
  end if;

  if new.client_id is distinct from old.client_id then
    raise exception 'Only BaMo admins can move a profile between workspaces';
  end if;

  if new.role is distinct from old.role then
    if caller_role <> 'client_admin' then
      raise exception 'Only admins can change roles';
    end if;
    if new.role = 'baymo_admin' or old.role = 'baymo_admin' then
      raise exception 'BaMo admin role can only be managed by BaMo admins';
    end if;
  end if;

  if new.is_active is distinct from old.is_active and caller_role <> 'client_admin' then
    raise exception 'Only admins can activate or deactivate accounts';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privileged_cols on public.profiles;
create trigger trg_guard_profile_privileged_cols
  before update on public.profiles
  for each row
  execute function public.guard_profile_privileged_cols();

-- Admin writes to profile-media: baymo_admin anywhere, client_admin only in
-- folders belonging to users of their own workspace.
create policy "profile_media_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-media'
    and exists (
      select 1
      from public.profiles me
      join public.profiles target on target.id::text = (storage.foldername(name))[1]
      where me.id = auth.uid()
        and (me.role = 'baymo_admin'
          or (me.role = 'client_admin' and me.client_id = target.client_id))
    )
  );

create policy "profile_media_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-media'
    and exists (
      select 1
      from public.profiles me
      join public.profiles target on target.id::text = (storage.foldername(name))[1]
      where me.id = auth.uid()
        and (me.role = 'baymo_admin'
          or (me.role = 'client_admin' and me.client_id = target.client_id))
    )
  )
  with check (
    bucket_id = 'profile-media'
    and exists (
      select 1
      from public.profiles me
      join public.profiles target on target.id::text = (storage.foldername(name))[1]
      where me.id = auth.uid()
        and (me.role = 'baymo_admin'
          or (me.role = 'client_admin' and me.client_id = target.client_id))
    )
  );

create policy "profile_media_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-media'
    and exists (
      select 1
      from public.profiles me
      join public.profiles target on target.id::text = (storage.foldername(name))[1]
      where me.id = auth.uid()
        and (me.role = 'baymo_admin'
          or (me.role = 'client_admin' and me.client_id = target.client_id))
    )
  );
