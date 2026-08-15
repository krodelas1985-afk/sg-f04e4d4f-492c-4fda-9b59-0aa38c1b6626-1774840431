-- Follow-up media attachments — Phase 1 (schema only, inert until W4/W6 are patched).
--
-- Two send paths need to carry a photo/video, and BOTH pick the media by human
-- choice, never by the model:
--   * fixed sequences (W4)  -> media pinned to a sequence_steps row
--   * AI follow-up  (W6)    -> media pinned to a playbook step (1..4)
--
-- W6's playbook step is deterministic (`touch_count + 1`, see the workflow's
-- "Build Decision Request" node), so pinning media to the step number means the
-- AI never selects a file. It only writes the wording.

-- ---------------------------------------------------------------------------
-- 1. Fixed-sequence steps carry one optional attachment.
-- ---------------------------------------------------------------------------
alter table public.sequence_steps
  add column if not exists media_url  text,
  add column if not exists media_type text;

-- Messenger renders each attachment as its own bubble, so one file per step is
-- the whole useful range; a list would just be N extra Send API calls.
alter table public.sequence_steps
  drop constraint if exists sequence_steps_media_type_chk;
alter table public.sequence_steps
  add constraint sequence_steps_media_type_chk
    check (media_type is null or media_type in ('image', 'video', 'file'));

-- A URL with no type would leave the sender guessing at the Send API's
-- attachment.type, which is required and not inferable from the URL.
alter table public.sequence_steps
  drop constraint if exists sequence_steps_media_pair_chk;
alter table public.sequence_steps
  add constraint sequence_steps_media_pair_chk
    check ((media_url is null) = (media_type is null));

comment on column public.sequence_steps.media_url is
  'Public URL of an optional attachment sent before this step''s text. Uploaded by a human; never model-chosen.';

-- ---------------------------------------------------------------------------
-- 2. AI follow-up: media pinned per playbook step.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_followup_step_media (
  id            uuid primary key default gen_random_uuid(),
  sequence_id   uuid not null references public.sequences(id) on delete cascade,
  playbook_step smallint not null check (playbook_step between 1 and 4),
  media_url     text not null,
  media_type    text not null check (media_type in ('image', 'video', 'file')),
  -- The real mismatch risk in this design is not the file (a human picked it)
  -- but the words: the model cannot see the image, so without a description it
  -- can caption a pool photo as a floor plan. This short human-written line is
  -- injected into the prompt so the copy matches what the lead actually sees.
  media_description text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (sequence_id, playbook_step)
);

comment on table public.ai_followup_step_media is
  'Human-pinned attachment for AI follow-up playbook steps 1-4. The model writes wording only; it never selects media.';

create index if not exists ai_followup_step_media_sequence_idx
  on public.ai_followup_step_media (sequence_id);

alter table public.ai_followup_step_media enable row level security;

-- Mirrors the sequences / sequence_steps policy set exactly.
drop policy if exists ai_followup_media_baymo_admin on public.ai_followup_step_media;
create policy ai_followup_media_baymo_admin on public.ai_followup_step_media
  as permissive for all
  using (get_my_role() = 'baymo_admin')
  with check (get_my_role() = 'baymo_admin');

drop policy if exists ai_followup_media_client_admin_manager on public.ai_followup_step_media;
create policy ai_followup_media_client_admin_manager on public.ai_followup_step_media
  as permissive for all
  using (
    get_my_role() = any (array['client_admin', 'manager'])
    and exists (
      select 1 from public.sequences s
      where s.id = ai_followup_step_media.sequence_id
        and s.client_id = get_my_client_id()
    )
  )
  with check (
    get_my_role() = any (array['client_admin', 'manager'])
    and exists (
      select 1 from public.sequences s
      where s.id = ai_followup_step_media.sequence_id
        and s.client_id = get_my_client_id()
    )
  );

drop policy if exists ai_followup_media_agent_read on public.ai_followup_step_media;
create policy ai_followup_media_agent_read on public.ai_followup_step_media
  as permissive for select
  using (
    get_my_role() = 'agent'
    and exists (
      select 1 from public.sequences s
      where s.id = ai_followup_step_media.sequence_id
        and s.client_id = get_my_client_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Reusable Meta attachment_id cache.
-- ---------------------------------------------------------------------------
-- Sending `attachment.payload.url` makes Meta re-download the file on EVERY
-- send — 200 leads on one photo is 200 fetches. Uploading once via
-- POST /{page-id}/message_attachments with is_reusable=true returns an
-- attachment_id that sends instantly thereafter.
--
-- That id is PAGE-scoped: the same file used by three clients needs three ids,
-- hence the (client_id, media_url) key rather than media_url alone.
create table if not exists public.messenger_media_attachments (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  media_url         text not null,
  media_type        text not null check (media_type in ('image', 'video', 'file')),
  fb_attachment_id  text not null,
  uploaded_at       timestamptz not null default now(),
  unique (client_id, media_url)
);

comment on table public.messenger_media_attachments is
  'Cache of Meta reusable attachment_ids. Page-scoped: keyed by (client_id, media_url), never media_url alone.';

alter table public.messenger_media_attachments enable row level security;

-- Written only by the n8n workflows / server routes via service_role, which
-- bypasses RLS. Read access is granted so the CRM can show upload state.
drop policy if exists messenger_media_baymo_admin on public.messenger_media_attachments;
create policy messenger_media_baymo_admin on public.messenger_media_attachments
  as permissive for all
  using (get_my_role() = 'baymo_admin')
  with check (get_my_role() = 'baymo_admin');

drop policy if exists messenger_media_client_read on public.messenger_media_attachments;
create policy messenger_media_client_read on public.messenger_media_attachments
  as permissive for select
  using (
    get_my_role() = any (array['client_admin', 'manager', 'agent'])
    and client_id = get_my_client_id()
  );
