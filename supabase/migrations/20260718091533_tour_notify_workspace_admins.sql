-- Tour completion now also notifies the completing user's own workspace admins
-- (their broker), not just BaMo staff. The completer never notifies themselves.

create or replace function public.notify_tour_completed()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_body text;
begin
  if new.completed_at is null or (tg_op = 'UPDATE' and old.completed_at is not null) then
    return new;
  end if;

  select coalesce(p.full_name, p.email, 'A client') into v_name
  from public.profiles p where p.id = new.profile_id;

  v_body := case
    when new.skipped then 'Skipped the tour.'
    else trim(both ' | ' from
      coalesce('Needs: ' || array_to_string(new.services_needed, ', '), '')
      || case when new.help_request is not null and new.help_request <> ''
           then ' | Asked: ' || left(new.help_request, 200) else '' end
      || case when new.listing_intent then ' | Wants to post a listing' else '' end)
  end;

  insert into public.notifications (user_id, client_id, type, title, body, data)
  select
    p.id,
    new.client_id,
    'onboarding_tour_completed',
    v_name || ' finished the BayMo intro',
    v_body,
    jsonb_build_object(
      'profile_id', new.profile_id,
      'client_id', new.client_id,
      'services_needed', to_jsonb(new.services_needed),
      'help_request', new.help_request,
      'listing_intent', new.listing_intent,
      'skipped', new.skipped
    )
  from public.profiles p
  where coalesce(p.is_active, true)
    and p.id <> new.profile_id
    and (
      p.role = 'baymo_admin'
      or (p.role = 'client_admin'
          and new.client_id is not null
          and p.client_id = new.client_id)
    );

  return new;
end;
$$;
