-- Website (landing-page) applications land in client_onboarding as
-- source='web'/status='submitted' and stay inert (the tally auto-provision
-- trigger ignores non-tally rows) until a baymo_admin approves them from the
-- CRM "Client Applications" queue. On approval this trigger creates the client
-- workspace (idempotent on email) and notifies every baymo_admin. Mirrors
-- auto_provision_client_from_onboarding (the tally path) but is gated on
-- source='web' transitioning into status='approved'.
create or replace function public.provision_client_from_web_onboarding()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_client_id uuid;
  v_name      text;
begin
  if new.source is distinct from 'web'      then return new; end if;
  if new.status is distinct from 'approved' then return new; end if;
  if new.client_id is not null              then return new; end if;

  v_name := coalesce(
    nullif(btrim(new.full_name), ''),
    nullif(btrim(new.company_name), ''),
    new.email,
    'New Client'
  );

  -- Reuse an existing workspace with the same email (idempotent).
  if new.email is not null and btrim(new.email) <> '' then
    select id into v_client_id
    from clients
    where lower(email) = lower(btrim(new.email))
    limit 1;
  end if;

  if v_client_id is null then
    insert into clients (name, company_name, email, phone, business_type)
    values (
      v_name,
      nullif(btrim(new.company_name), ''),
      nullif(btrim(new.email), ''),
      nullif(btrim(new.phone), ''),
      new.business_type
    )
    returning id into v_client_id;
  end if;

  -- Link on the same row (BEFORE trigger: mutate NEW, no re-fire).
  new.client_id   := v_client_id;
  new.reviewed_at := now();

  -- Notify every BaMo admin.
  insert into notifications (user_id, type, title, body, data)
  select p.id,
         'client_onboarded',
         'New client approved: ' || v_name,
         concat_ws(' · ',
           nullif(btrim(new.company_name), ''),
           nullif(btrim(new.email), ''),
           nullif(btrim(new.phone), '')
         ),
         jsonb_build_object(
           'onboarding_id', new.id,
           'client_id',     v_client_id,
           'source',        new.source
         )
  from profiles p
  where p.role = 'baymo_admin';

  return new;
end;
$function$;

drop trigger if exists trg_provision_client_web on public.client_onboarding;
create trigger trg_provision_client_web
before update of status on public.client_onboarding
for each row
when (new.source = 'web' and new.status = 'approved' and old.status is distinct from 'approved')
execute function public.provision_client_from_web_onboarding();
