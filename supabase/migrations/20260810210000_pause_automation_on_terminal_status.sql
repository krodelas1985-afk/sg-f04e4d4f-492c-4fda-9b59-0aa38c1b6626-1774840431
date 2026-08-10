-- Pause automation on ALL terminal statuses, not just Unqualified.
--
-- Before this, only 'Unqualified' stopped automation (trg_status_unqualified). A lead
-- marked Won or Lost kept its campaign and sequence enrolments, so W6 would carry on
-- following up someone who had already bought — or already told us no. That was harmless
-- while Lost was unreachable (0 rows), but 20260810200000 just made Lost recordable, so it
-- would have started happening the moment anyone used it.
--
-- The Unqualified path is preserved byte-for-byte; this only widens which statuses trigger
-- it and labels the outcome per status.

create or replace function public.pause_automation_on_terminal_status()
returns trigger
language plpgsql
as $$
declare
  -- v_ prefixed: a variable named `outcome` collides with sequence_enrollments.outcome
  -- in the UPDATE below, and plpgsql raises "column reference is ambiguous" by default.
  v_reason  text;
  v_outcome text;
begin
  case new.status
    when 'Unqualified' then v_reason := 'Lead marked Unqualified'; v_outcome := 'unqualified';
    when 'Won'         then v_reason := 'Lead marked Won';         v_outcome := 'won';
    when 'Lost'        then v_reason := 'Lead marked Lost';        v_outcome := 'lost';
    else return new;
  end case;

  new.automation_enabled := false;
  new.campaign_id        := null;
  new.status_updated_at  := now();
  if new.status_source is null then
    new.status_source := 'manual';
  end if;

  update public.lead_campaign_states
     set state         = 'stopped',
         paused_reason = coalesce(paused_reason, v_reason),
         updated_at    = now()
   where lead_id = new.id
     and state in ('active','paused');

  -- Unenrolled inline rather than relying on trg_leads_automation_off_unenroll: that
  -- trigger is UPDATE OF automation_enabled, so it does not fire on a status-only update.
  update public.sequence_enrollments
     set state        = 'exited',
         outcome      = v_outcome,
         completed_at = now(),
         send_lock    = false,
         updated_at   = now()
   where lead_id = new.id
     and state in ('active','waiting_window','paused');

  return new;
end;
$$;

comment on function public.pause_automation_on_terminal_status() is
  'Stops automation when a lead reaches a terminal status (Unqualified, Won, Lost): disables automation, clears campaign_id, stops campaign states and exits sequence enrolments with a per-status outcome. Supersedes pause_automation_on_unqualified.';

-- Swap the trigger. Same BEFORE UPDATE OF status shape and the same
-- "only on entering the status" guard, widened to the three terminal values.
drop trigger if exists trg_status_unqualified on public.leads;
drop trigger if exists trg_status_terminal on public.leads;

create trigger trg_status_terminal
  before update of status on public.leads
  for each row
  when (
    new.status in ('Unqualified','Won','Lost')
    and old.status is distinct from new.status
  )
  execute function public.pause_automation_on_terminal_status();

drop function if exists public.pause_automation_on_unqualified();
