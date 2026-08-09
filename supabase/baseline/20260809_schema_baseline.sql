-- =====================================================================
-- BaMo CRM / Ads Manager - SCHEMA BASELINE
-- Project: zyfkjxepykwpfzmkxitb   Captured: 2026-08-09
-- =====================================================================
--
-- WHY THIS FILE EXISTS
--
-- The database had 205 applied migrations; the repo had 79 migration
-- files. 97 applied migrations had no .sql file on any branch - they
-- were applied directly in-DB (dashboard / MCP apply_migration) and
-- their original SQL is gone. The schema could not be rebuilt from the
-- repo, and the drift hid real bugs (see the 2026-06-19
-- get_leads_with_details incident, and the followup_requests
-- nullability error that survived three weeks in database.types.ts).
--
-- This file is that missing history, collapsed into one snapshot:
-- the schema as it actually exists, reconstructed from the live
-- catalog rather than from the migration log.
--
-- IT IS NOT IN supabase/migrations/ ON PURPOSE.
--
-- The 79 existing migration files still replay from an empty database.
-- Dropping a baseline beside them would double-apply. Treat this file
-- as the reference for what production really looks like, and as the
-- starting point if the migration history is ever formally rebased.
--
-- HOW IT WAS BUILT
--
-- Generated from pg_catalog / information_schema, in dependency order:
--   extensions -> tables -> constraints -> indexes -> functions
--   -> triggers -> RLS -> policies -> grants -> cron jobs
--
-- Object counts verified against the live catalog at capture time:
--   73 tables      314 constraints   116 non-constraint indexes
--   202 functions   59 triggers       73 tables with RLS enabled
--  194 policies      7 extensions      6 cron jobs
--   0 views          0 sequences       0 enums
--
-- WHAT IT DOES NOT CONTAIN
--
--   * No table data (except none is needed - this is schema only).
--   * No auth/storage schema objects - Supabase manages those.
--   * No network_* objects: BaMo Network moved to its own project
--     (xzzlxpbkikqcznafwtfx) and the residue was dropped 2026-08-09.
--   * Vault secrets and edge-function bodies live outside Postgres.
--
-- REGENERATE with supabase/baseline/README.md's query pair.
-- =====================================================================


-- ===== EXTENSIONS / TABLES / CONSTRAINTS / INDEXES =====
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists vector with schema public;

create table if not exists public.ad_activity_log (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  performed_by uuid,
  role text,
  action text not null,
  entity_type text,
  entity_id uuid,
  meta jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.ad_analytics (
  id uuid default gen_random_uuid() not null,
  campaign_id uuid,
  client_id uuid,
  date date not null,
  impressions integer default 0,
  reach integer default 0,
  clicks integer default 0,
  cpc numeric,
  cpm numeric,
  spend numeric,
  leads integer default 0,
  link_clicks integer default 0,
  meta_campaign_id text,
  meta_campaign_name text,
  meta_ad_id text,
  meta_ad_name text,
  synced_at timestamp with time zone default now() not null
);

create table if not exists public.ad_campaigns (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  social_account_id uuid,
  content_id uuid,
  creative_id uuid,
  listing_id uuid,
  name text not null,
  objective text,
  budget_daily numeric,
  budget_total numeric,
  audience_config jsonb,
  placement text[],
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  status text default 'draft'::text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  launched_at timestamp with time zone,
  launched_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.ad_content (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  title text,
  platform text,
  tone text,
  target_audience text,
  caption text,
  hook text,
  hashtags text[],
  cta text,
  ai_generated boolean default true,
  listing_id text,
  status text default 'draft'::text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.ad_creatives (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  content_id uuid,
  type text not null,
  source text not null,
  asset_url text not null,
  thumbnail_url text,
  width integer,
  height integer,
  duration_seconds integer,
  render_job_id text,
  status text default 'pending'::text,
  created_at timestamp with time zone default now()
);

create table if not exists public.ad_listings (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  marketplace_listing_id text not null,
  property_name text,
  property_type text,
  description text,
  price numeric,
  location text,
  city text,
  bedrooms integer,
  bathrooms integer,
  floor_area numeric,
  lot_area numeric,
  primary_photo_url text,
  photo_urls text[],
  listing_url text,
  agent_name text,
  agent_prc_number text,
  agent_email text,
  agent_phone text,
  snapshotted_at timestamp with time zone default now(),
  agent_photo_url text
);

create table if not exists public.ad_music_tracks (
  id uuid default gen_random_uuid() not null,
  name text not null,
  mood text,
  url text not null,
  duration_seconds integer,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  license_note text
);

create table if not exists public.ad_notifications (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  type text not null,
  title text not null,
  message text,
  is_read boolean default false,
  entity_type text,
  entity_id uuid,
  created_at timestamp with time zone default now()
);

create table if not exists public.ad_operator_tokens (
  id uuid default gen_random_uuid() not null,
  fb_user_id text not null,
  fb_user_name text,
  access_token text not null,
  token_type text default 'long_lived_user'::text not null,
  scopes text[] default '{}'::text[],
  expires_at timestamp with time zone,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.ad_posts (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  social_account_id uuid,
  content_id uuid,
  creative_id uuid,
  platform text not null,
  post_type text,
  meta_post_id text,
  scheduled_at timestamp with time zone,
  published_at timestamp with time zone,
  status text default 'draft'::text,
  created_at timestamp with time zone default now(),
  message text,
  link_url text,
  media_urls text[] default '{}'::text[],
  error_message text,
  retry_count integer default 0 not null,
  created_by uuid,
  updated_at timestamp with time zone default now(),
  source text default 'manual'::text not null
);

create table if not exists public.ad_reports (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  period_start date not null,
  period_end date not null,
  status text default 'completed'::text not null,
  summary text,
  verdicts jsonb default '[]'::jsonb not null,
  totals jsonb default '{}'::jsonb not null,
  model text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.ad_social_accounts (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  platform text not null,
  account_id text not null,
  account_name text,
  access_token text,
  token_expires_at timestamp with time zone,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  meta jsonb default '{}'::jsonb
);

create table if not exists public.ad_templates (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  name text not null,
  type text not null,
  source text not null,
  template_id text not null,
  thumbnail_url text,
  is_default boolean default false,
  created_at timestamp with time zone default now(),
  supports_music boolean default false not null
);

create table if not exists public.ad_usage_limits (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  month text not null,
  images_generated integer default 0,
  videos_generated integer default 0,
  carousel_generated integer default 0
);

create table if not exists public.agent_documents (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  created_by uuid not null,
  type text not null,
  title text not null,
  body text default ''::text not null,
  lead_id uuid,
  status text default 'draft'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.agent_listings (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  created_by uuid,
  title text,
  listing_type text,
  property_type text,
  price numeric,
  lot_area numeric,
  floor_area numeric,
  bedrooms integer,
  bathrooms integer,
  location text,
  city text,
  description text,
  photo_urls text[] default '{}'::text[] not null,
  status text default 'draft'::text not null,
  source text default 'mobile_app'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.agent_performance_scores (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  user_id uuid not null,
  window_days integer default 90 not null,
  assigned_count integer default 0 not null,
  won_count integer default 0 not null,
  conversion_smoothed numeric,
  touches integer default 0 not null,
  open_leads integer default 0 not null,
  hustle_raw numeric,
  median_response_seconds numeric,
  conversion_score numeric,
  hustle_score numeric,
  responsiveness_score numeric,
  composite_score numeric,
  weight numeric,
  is_grace boolean default false not null,
  computed_at timestamp with time zone default now() not null
);

create table if not exists public.agent_website_requests (
  id uuid default gen_random_uuid() not null,
  website_id uuid not null,
  client_id uuid not null,
  created_by uuid not null,
  type text not null,
  note text,
  status text default 'open'::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.agent_websites (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  created_by uuid not null,
  status text default 'requested'::text not null,
  hero_photo_url text,
  linked_listing_ids uuid[] default '{}'::uuid[] not null,
  assets_drive_url text,
  facts text,
  agent_name text,
  agent_phone text,
  agent_email text,
  prc_number text,
  area_coverage text,
  company text,
  messenger_link text,
  whatsapp_link text,
  website_url text,
  requested_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  admin_stage text,
  assigned_admin uuid,
  build_notes text,
  site_config jsonb,
  generated_brief text,
  brief_generated_at timestamp with time zone,
  repo_url text,
  preflight_report jsonb,
  preflight_at timestamp with time zone,
  vercel_project_id text,
  deploy_url text,
  deployed_at timestamp with time zone
);

create table if not exists public.ai_usage (
  client_id uuid not null,
  period_month date not null,
  count integer default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.announcements (
  id uuid default gen_random_uuid() not null,
  scope text default 'client'::text not null,
  client_id uuid,
  title text not null,
  body text default ''::text not null,
  pinned boolean default false not null,
  expires_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.appointments (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  created_by uuid,
  lead_id uuid,
  contact_name text,
  contact_phone text,
  appointment_type text not null,
  scheduled_at timestamp with time zone not null,
  location text,
  notes text,
  status text default 'scheduled'::text not null,
  source text default 'mobile_app'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  reminded_day_at timestamp with time zone,
  reminded_hour_at timestamp with time zone,
  title text
);

create table if not exists public.campaign_knowledge_base (
  id uuid default gen_random_uuid() not null,
  campaign_id uuid not null,
  client_id uuid not null,
  title text not null,
  content text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  type text default 'knowledge'::text not null,
  campaign_name text,
  source_type text,
  fields jsonb,
  availability_status text,
  promo_valid_until date,
  review_status text default 'draft'::text not null,
  proposed_content text,
  review_notes text,
  raw_document_path text,
  source_url text,
  approved_at timestamp with time zone,
  approved_by uuid,
  source_text text,
  scope text default 'campaign'::text not null,
  source_label text,
  raw_document_paths jsonb,
  replaces_kb_id uuid
);

create table if not exists public.campaign_lead_assignments (
  id uuid default gen_random_uuid() not null,
  campaign_id uuid not null,
  lead_id uuid not null,
  client_id uuid not null,
  assigned_at timestamp with time zone default now(),
  sequence_step integer default 0,
  status text default 'active'::text
);

create table if not exists public.campaign_prompt_backup_20260807 (
  id uuid default gen_random_uuid() not null,
  campaign_id uuid not null,
  ai_message_instructions text,
  note text,
  backed_up_at timestamp with time zone default now() not null
);

create table if not exists public.campaign_prompt_backup_20260809 (
  id uuid,
  name text,
  ai_message_instructions text,
  taken_at timestamp with time zone
);

create table if not exists public.campaign_requests (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  created_by uuid,
  listing_id uuid,
  creative_id uuid,
  goal text not null,
  budget_range text not null,
  duration_days integer default 7 not null,
  notes text,
  status text default 'requested'::text not null,
  ad_campaign_id uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.campaign_steps (
  id uuid default gen_random_uuid() not null,
  campaign_id uuid not null,
  client_id uuid not null,
  step_order integer not null,
  step_type text not null,
  delay_hours integer default 0 not null,
  channel text,
  message_template text,
  ai_screen_before_send boolean default true not null,
  notification_message text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.campaigns (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  name text not null,
  channel text default 'all'::text,
  status text default 'draft'::text,
  target_action text,
  tone text,
  additional_instructions text,
  config jsonb default '{}'::jsonb,
  email_subject text,
  email_template_id uuid,
  is_locked boolean default false,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  currency text default 'PHP'::text,
  target_industries text[],
  job_titles text[],
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  success_metric text,
  source_detail text,
  campaign_rules jsonb,
  enrollment_rules jsonb,
  priority integer default 10 not null,
  scheduled_steps_enabled boolean default true not null,
  conversational_ai_enabled boolean default false not null,
  is_active boolean default false,
  ai_decision_instructions text,
  ai_message_instructions text,
  ai_instruction text,
  campaign_type text default 'buyer_leadgen'::text not null,
  automation_scope text default 'general'::text not null,
  is_organic_owner boolean default false not null,
  scoped_ref jsonb,
  intro_line text
);

create table if not exists public.client_assets (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  file_name text not null,
  file_type text not null,
  mime_type text,
  file_size_bytes bigint,
  storage_path text not null,
  public_url text not null,
  width integer,
  height integer,
  duration_seconds integer,
  thumbnail_url text,
  tags text[] default '{}'::text[],
  folder text default 'general'::text,
  alt_text text,
  caption text,
  used_in_creatives boolean default false,
  used_in_website boolean default false,
  used_in_posts boolean default false,
  usage_count integer default 0,
  uploaded_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.client_campaigns (
  id uuid default gen_random_uuid() not null,
  campaign_id uuid not null,
  client_id uuid not null,
  assigned_at timestamp with time zone default now(),
  assigned_by uuid
);

create table if not exists public.client_onboarding (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  profile_id uuid,
  source text default 'mobile_app'::text not null,
  status text default 'in_progress'::text not null,
  current_step integer default 1 not null,
  business_type text,
  full_name text,
  company_name text,
  email text,
  phone text,
  answers jsonb default '{}'::jsonb not null,
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.client_reference_documents (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  filename text not null,
  storage_path text not null,
  file_type text not null,
  size_bytes integer not null,
  extracted_text text not null,
  extracted_chars integer not null,
  truncated boolean default false not null,
  created_at timestamp with time zone default now() not null,
  created_by uuid
);

create table if not exists public.clients (
  id uuid default gen_random_uuid() not null,
  name text not null,
  company_name text,
  email text,
  phone text,
  webhook_secret text default encode(gen_random_bytes(32), 'hex'::text),
  integrations jsonb default '{}'::jsonb,
  settings jsonb default '{}'::jsonb,
  is_active boolean default true,
  bamo_api_key text,
  bamo_webhook_url text,
  bamo_connected boolean default false,
  created_at timestamp with time zone default now(),
  business_industry text,
  business_type text,
  fb_page_token text,
  fb_page_id text,
  ads_enabled boolean default false,
  ads_plan text default 'starter'::text,
  ads_plan_started_at timestamp with time zone,
  ad_account_id text,
  assignment_mode text default 'manual'::text not null,
  assignment_sources text[],
  plan text default 'free'::text not null
);

create table if not exists public.conversations (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  client_id uuid not null,
  sender text,
  sender_id uuid,
  message_content text,
  channel text default 'email'::text,
  direction text default 'inbound'::text,
  sent_via text,
  external_msg_id text,
  delivery_status text default 'sent'::text,
  intent_tag text,
  created_at timestamp with time zone default now(),
  attachment_url text,
  attachment_type text,
  ai_decision text,
  lead_temperature text,
  ai_reason text,
  lead_score integer
);

create table if not exists public.creative_jobs (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  creative_id uuid,
  job_id character varying(255),
  job_type character varying(50) not null,
  request_payload jsonb not null,
  response_payload jsonb,
  status character varying(50) default 'pending'::character varying,
  progress_percent integer default 0,
  poll_count integer default 0,
  max_polls integer default 120,
  last_polled_at timestamp with time zone,
  result_url text,
  error_message text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

create table if not exists public.creative_prompts (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  creative_type character varying(50) not null,
  generation_method character varying(50) not null,
  prompt_text text not null,
  variant_count integer default 1,
  template_id uuid,
  is_favorite boolean default false,
  use_count integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.creatives (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  creative_type character varying(50) not null,
  generation_method character varying(50) not null,
  prompt_id uuid,
  parent_creative_id uuid,
  variant_index integer,
  asset_url text not null,
  thumbnail_url text,
  original_filename character varying(255),
  dimensions character varying(20),
  file_size_bytes integer,
  duration_seconds integer,
  job_id character varying(255),
  job_status character varying(50) default 'completed'::character varying,
  render_job_id text,
  job_error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone
);

create table if not exists public.daily_digests (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  digest_date date not null,
  metrics jsonb default '{}'::jsonb not null,
  suggestions jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.email_templates (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  campaign_id uuid,
  name text not null,
  subject text,
  body text,
  created_at timestamp with time zone default now()
);

create table if not exists public.enrollment_rules (
  id uuid default gen_random_uuid() not null,
  sequence_id uuid not null,
  rule_name text not null,
  source_filter text[],
  inactivity_days integer,
  temperature_filter text[],
  conversation_stage_filter text[],
  enabled boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  last_inbound_max_hours integer,
  last_contacted_min_hours integer,
  quality_filter text[],
  pipeline_stage_filter text[],
  ai_outbound_min_hours integer,
  fb_ad_id_filter text[]
);

create table if not exists public.follow_up_decisions (
  id uuid default gen_random_uuid() not null,
  enrollment_id uuid not null,
  lead_id uuid not null,
  client_id uuid not null,
  decision text not null,
  reason text,
  message_sent text,
  goal_status text,
  window_open boolean,
  context_snapshot jsonb,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.followup_requests (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  requested_by uuid not null,
  style text,
  duration_days integer,
  notes text,
  status text default 'pending'::text not null,
  admin_notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  campaign_id uuid,
  action text default 'enable'::text not null,
  decided_at timestamp with time zone,
  decided_by uuid
);

create table if not exists public.kb_chunks (
  id uuid default gen_random_uuid() not null,
  document_id uuid not null,
  client_id uuid not null,
  campaign_id uuid,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  token_count integer,
  created_at timestamp with time zone default now()
);

create table if not exists public.kb_documents (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  campaign_id uuid,
  file_name text not null,
  file_url text,
  file_type text,
  status text default 'processing'::text,
  created_at timestamp with time zone default now()
);

create table if not exists public.lead_alert_emails (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  client_id uuid not null,
  alert_kind text not null,
  trigger_at timestamp with time zone,
  recipients text,
  status text default 'sent'::text not null,
  provider_id text,
  error text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.lead_assignment_events (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  client_id uuid not null,
  from_user_id uuid,
  to_user_id uuid,
  method text not null,
  actor_id uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.lead_assignment_pool (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  user_id uuid not null,
  is_active boolean default true not null,
  weight numeric default 1.0 not null,
  last_assigned_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.lead_campaign_states (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  campaign_id uuid not null,
  client_id uuid not null,
  current_step integer default 1 not null,
  state text default 'active'::text not null,
  paused_by uuid,
  paused_reason text,
  last_ai_decision text,
  enrolled_at timestamp with time zone default now() not null,
  started_at timestamp with time zone,
  last_step_at timestamp with time zone,
  next_step_at timestamp with time zone,
  completed_at timestamp with time zone,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  conversational_ai boolean default true not null,
  last_message_hash text,
  send_lock boolean default false,
  last_execution_id text
);

create table if not exists public.lead_memory (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  client_id uuid not null,
  campaign_id uuid,
  memory_type text,
  memory_label text not null,
  value_text text,
  value_number numeric,
  value_json jsonb,
  confidence text default 'medium'::text,
  importance_score numeric default 0.5,
  source_message_id uuid,
  is_active boolean default true,
  superseded_by uuid,
  last_accessed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.lead_notes (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  client_id uuid not null,
  content text not null,
  created_by uuid,
  created_at timestamp with time zone default now()
);

create table if not exists public.lead_qualifications (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  client_id uuid not null,
  budget_min numeric,
  budget_max numeric,
  preferred_location text[] default '{}'::text[],
  property_type text,
  property_sub_type text,
  bedrooms integer,
  floor_area_min numeric,
  lot_area_min numeric,
  unit_preferred text,
  purpose text,
  preferred_financing text,
  payment_scheme text,
  timeframe text,
  move_in_date text,
  income_source text,
  motivation text,
  hesitation text,
  decision_maker text,
  competing_projects text[] default '{}'::text[],
  viewing_schedule text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.lead_temperature_events (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  client_id uuid not null,
  from_temperature text,
  to_temperature text not null,
  changed_at timestamp with time zone default now() not null
);

create table if not exists public.leads (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  campaign_id uuid,
  assigned_user_id uuid,
  name text not null,
  phone text,
  email text,
  company text,
  messenger_id text,
  viber_id text,
  bamo_user_id text,
  source text,
  source_override boolean default false,
  status text default 'New'::text,
  lead_temperature text default 'Cold'::text,
  lead_score integer default 0,
  tags text[] default '{}'::text[],
  last_message_at timestamp with time zone,
  unread_count integer default 0,
  next_follow_up_date date,
  last_contacted_at timestamp with time zone,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  industry text,
  primary_channel text,
  automation_enabled boolean default true,
  conversation_summary text,
  profile_completed_at timestamp with time zone,
  follow_up_preference text,
  questions_asked jsonb default '{}'::jsonb,
  last_question_asked text,
  last_question_attempts integer default 0,
  conversation_stage text,
  current_location text,
  lead_type text,
  viewing_stage text,
  last_inbound_at timestamp with time zone,
  last_outbound_at timestamp with time zone,
  temperature_source text default 'auto'::text not null,
  temperature_reason text,
  temperature_updated_at timestamp with time zone,
  status_source text default 'auto'::text not null,
  status_reason text,
  status_updated_at timestamp with time zone,
  lead_quality text default 'Browsing'::text,
  lead_quality_source text default 'auto'::text not null,
  lead_quality_reason text,
  lead_quality_updated_at timestamp with time zone,
  timeframe text,
  motivation text,
  automation_source text default 'auto'::text not null,
  last_ai_outbound_at timestamp with time zone,
  fb_ad_id text,
  followup_opted_out boolean default false not null,
  followup_opted_out_at timestamp with time zone,
  lead_grade text,
  lead_grade_score integer,
  lead_grade_breakdown jsonb,
  lead_grade_updated_at timestamp with time zone
);

create table if not exists public.message_templates (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  created_at timestamp with time zone default now(),
  title text not null,
  body text not null,
  channel text,
  category text not null,
  created_by uuid,
  updated_at timestamp with time zone default now(),
  last_used_at timestamp with time zone,
  topic text,
  placeholders_used jsonb default '[]'::jsonb not null,
  used_kb boolean default false not null,
  goal text
);

create table if not exists public.messenger_referrals (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  psid text not null,
  ad_id text,
  ref text,
  source text,
  raw jsonb,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.notification_preferences (
  user_id uuid not null,
  lead_assigned boolean default true not null,
  lead_hot boolean default true not null,
  lead_warm boolean default true not null,
  appointment_reminders boolean default true not null,
  ads_updates boolean default true not null,
  quiet_hours boolean default true not null,
  updated_at timestamp with time zone default now() not null,
  tasks boolean default true not null,
  daily_digest boolean default true not null
);

create table if not exists public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  client_id uuid,
  type text not null,
  title text not null,
  body text,
  data jsonb default '{}'::jsonb not null,
  read_at timestamp with time zone,
  pushed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.page_connection_requests (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  requested_by uuid not null,
  page_name text not null,
  page_url text,
  status text default 'pending'::text not null,
  admin_notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.plan_limits (
  plan text not null,
  ai_monthly integer,
  leads_total integer,
  listings_total integer
);

create table if not exists public.profiles (
  id uuid not null,
  full_name text,
  email text,
  phone text,
  role text default 'agent'::text,
  client_id uuid,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  avatar_url text,
  prc_number text,
  company text,
  company_logo_url text,
  whatsapp text,
  location_province text,
  location_city text,
  service_area text
);

create table if not exists public.prompt_templates (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  type text not null,
  name text not null,
  template text not null,
  variables jsonb,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.push_tokens (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  expo_push_token text not null,
  platform text,
  device_id text,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.seq_enroll_backup_20260803 (
  id uuid,
  lead_id uuid,
  sequence_id uuid,
  client_id uuid,
  enrollment_rule_id uuid,
  current_step integer,
  state text,
  paused_by uuid,
  paused_reason text,
  enrolled_at timestamp with time zone,
  started_at timestamp with time zone,
  last_step_at timestamp with time zone,
  next_step_at timestamp with time zone,
  completed_at timestamp with time zone,
  send_lock boolean,
  last_execution_id text,
  metadata jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  outcome text,
  pass_number integer,
  touch_count integer,
  next_action_at timestamp with time zone
);

create table if not exists public.sequence_enrollments (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  sequence_id uuid not null,
  client_id uuid not null,
  enrollment_rule_id uuid,
  current_step integer default 1 not null,
  state text default 'active'::text not null,
  paused_by uuid,
  paused_reason text,
  enrolled_at timestamp with time zone default now() not null,
  started_at timestamp with time zone,
  last_step_at timestamp with time zone,
  next_step_at timestamp with time zone,
  completed_at timestamp with time zone,
  send_lock boolean default false,
  last_execution_id text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  outcome text,
  pass_number integer default 1 not null,
  touch_count integer default 0 not null,
  next_action_at timestamp with time zone
);

create table if not exists public.sequence_steps (
  id uuid default gen_random_uuid() not null,
  sequence_id uuid not null,
  step_order integer not null,
  title text not null,
  step_type text not null,
  message_content text,
  delay_hours integer default 24 not null,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  quick_replies jsonb
);

create table if not exists public.sequences (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  name text not null,
  description text,
  is_active boolean default true,
  scheduled_steps_enabled boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  send_window_start text default '08:00'::text,
  send_window_end text default '20:00'::text,
  reenroll_cooldown_days integer default 14,
  max_passes integer default 3,
  mode text default 'fixed'::text not null,
  campaign_id uuid,
  ai_settings jsonb
);

create table if not exists public.social_autopost_plans (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  created_by uuid,
  status text default 'active'::text not null,
  starts_at timestamp with time zone default now() not null,
  ends_at timestamp with time zone not null,
  cadence jsonb default '{"video": 2, "static": 1, "posts_per_week": 3}'::jsonb not null,
  weekly_topics jsonb not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.subscription_requests (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  created_by uuid,
  product text default 'social_autopost'::text not null,
  note text,
  status text default 'open'::text not null,
  created_at timestamp with time zone default now(),
  processed_by uuid,
  processed_at timestamp with time zone
);

create table if not exists public.tasks (
  id uuid default gen_random_uuid() not null,
  lead_id uuid,
  client_id uuid not null,
  assigned_to uuid,
  created_by uuid,
  title text not null,
  task_type text default 'follow-up'::text,
  notes text,
  due_date date,
  status text default 'pending'::text,
  triggered_by text default 'manual'::text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  source text default 'manual'::text,
  deferred_until date
);

create table if not exists public.user_onboarding_tour (
  profile_id uuid not null,
  client_id uuid,
  started_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone,
  skipped boolean default false not null,
  steps jsonb default '{}'::jsonb not null,
  services_needed text[] default '{}'::text[] not null,
  help_request text,
  listing_intent boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.video_requests (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  created_by uuid,
  video_type text not null,
  duration_seconds integer default 30 not null,
  format text default 'vertical'::text not null,
  listing_id uuid,
  notes text,
  status text default 'requested'::text not null,
  delivered_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.webhook_logs (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  source text,
  payload jsonb,
  status text,
  error_message text,
  lead_id uuid,
  received_at timestamp with time zone default now()
);

alter table public.ad_activity_log add constraint ad_activity_log_pkey PRIMARY KEY (id);
alter table public.ad_analytics add constraint ad_analytics_pkey PRIMARY KEY (id);
alter table public.ad_campaigns add constraint ad_campaigns_pkey PRIMARY KEY (id);
alter table public.ad_content add constraint ad_content_pkey PRIMARY KEY (id);
alter table public.ad_creatives add constraint ad_creatives_pkey PRIMARY KEY (id);
alter table public.ad_listings add constraint ad_listings_pkey PRIMARY KEY (id);
alter table public.ad_music_tracks add constraint ad_music_tracks_pkey PRIMARY KEY (id);
alter table public.ad_notifications add constraint ad_notifications_pkey PRIMARY KEY (id);
alter table public.ad_operator_tokens add constraint ad_operator_tokens_pkey PRIMARY KEY (id);
alter table public.ad_posts add constraint ad_posts_pkey PRIMARY KEY (id);
alter table public.ad_reports add constraint ad_reports_pkey PRIMARY KEY (id);
alter table public.ad_social_accounts add constraint ad_social_accounts_pkey PRIMARY KEY (id);
alter table public.ad_templates add constraint ad_templates_pkey PRIMARY KEY (id);
alter table public.ad_usage_limits add constraint ad_usage_limits_pkey PRIMARY KEY (id);
alter table public.agent_documents add constraint agent_documents_pkey PRIMARY KEY (id);
alter table public.agent_listings add constraint agent_listings_pkey PRIMARY KEY (id);
alter table public.agent_performance_scores add constraint agent_performance_scores_pkey PRIMARY KEY (id);
alter table public.agent_website_requests add constraint agent_website_requests_pkey PRIMARY KEY (id);
alter table public.agent_websites add constraint agent_websites_pkey PRIMARY KEY (id);
alter table public.ai_usage add constraint ai_usage_pkey PRIMARY KEY (client_id, period_month);
alter table public.announcements add constraint announcements_pkey PRIMARY KEY (id);
alter table public.appointments add constraint appointments_pkey PRIMARY KEY (id);
alter table public.campaign_knowledge_base add constraint campaign_knowledge_base_pkey PRIMARY KEY (id);
alter table public.campaign_lead_assignments add constraint campaign_lead_assignments_pkey PRIMARY KEY (id);
alter table public.campaign_prompt_backup_20260807 add constraint campaign_prompt_backup_20260807_pkey PRIMARY KEY (id);
alter table public.campaign_requests add constraint campaign_requests_pkey PRIMARY KEY (id);
alter table public.campaign_steps add constraint campaign_steps_pkey PRIMARY KEY (id);
alter table public.campaigns add constraint campaigns_pkey PRIMARY KEY (id);
alter table public.client_assets add constraint client_assets_pkey PRIMARY KEY (id);
alter table public.client_campaigns add constraint client_campaigns_pkey PRIMARY KEY (id);
alter table public.client_onboarding add constraint client_onboarding_pkey PRIMARY KEY (id);
alter table public.client_reference_documents add constraint client_reference_documents_pkey PRIMARY KEY (id);
alter table public.clients add constraint clients_pkey PRIMARY KEY (id);
alter table public.conversations add constraint conversations_pkey PRIMARY KEY (id);
alter table public.creative_jobs add constraint creative_jobs_pkey PRIMARY KEY (id);
alter table public.creative_prompts add constraint creative_prompts_pkey PRIMARY KEY (id);
alter table public.creatives add constraint creatives_pkey PRIMARY KEY (id);
alter table public.daily_digests add constraint daily_digests_pkey PRIMARY KEY (id);
alter table public.email_templates add constraint email_templates_pkey PRIMARY KEY (id);
alter table public.enrollment_rules add constraint enrollment_rules_pkey PRIMARY KEY (id);
alter table public.follow_up_decisions add constraint follow_up_decisions_pkey PRIMARY KEY (id);
alter table public.followup_requests add constraint followup_requests_pkey PRIMARY KEY (id);
alter table public.kb_chunks add constraint kb_chunks_pkey PRIMARY KEY (id);
alter table public.kb_documents add constraint kb_documents_pkey PRIMARY KEY (id);
alter table public.lead_alert_emails add constraint lead_alert_emails_pkey PRIMARY KEY (id);
alter table public.lead_assignment_events add constraint lead_assignment_events_pkey PRIMARY KEY (id);
alter table public.lead_assignment_pool add constraint lead_assignment_pool_pkey PRIMARY KEY (id);
alter table public.lead_campaign_states add constraint lead_campaign_states_pkey PRIMARY KEY (id);
alter table public.lead_memory add constraint lead_memory_pkey PRIMARY KEY (id);
alter table public.lead_notes add constraint lead_notes_pkey PRIMARY KEY (id);
alter table public.lead_qualifications add constraint lead_qualifications_pkey PRIMARY KEY (id);
alter table public.lead_temperature_events add constraint lead_temperature_events_pkey PRIMARY KEY (id);
alter table public.leads add constraint leads_pkey PRIMARY KEY (id);
alter table public.message_templates add constraint message_templates_pkey PRIMARY KEY (id);
alter table public.messenger_referrals add constraint messenger_referrals_pkey PRIMARY KEY (id);
alter table public.notification_preferences add constraint notification_preferences_pkey PRIMARY KEY (user_id);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.page_connection_requests add constraint page_connection_requests_pkey PRIMARY KEY (id);
alter table public.plan_limits add constraint plan_limits_pkey PRIMARY KEY (plan);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.prompt_templates add constraint prompt_templates_pkey PRIMARY KEY (id);
alter table public.push_tokens add constraint push_tokens_pkey PRIMARY KEY (id);
alter table public.sequence_enrollments add constraint sequence_enrollments_pkey PRIMARY KEY (id);
alter table public.sequence_steps add constraint sequence_steps_pkey PRIMARY KEY (id);
alter table public.sequences add constraint sequences_pkey PRIMARY KEY (id);
alter table public.social_autopost_plans add constraint social_autopost_plans_pkey PRIMARY KEY (id);
alter table public.subscription_requests add constraint subscription_requests_pkey PRIMARY KEY (id);
alter table public.tasks add constraint tasks_pkey PRIMARY KEY (id);
alter table public.user_onboarding_tour add constraint user_onboarding_tour_pkey PRIMARY KEY (profile_id);
alter table public.video_requests add constraint video_requests_pkey PRIMARY KEY (id);
alter table public.webhook_logs add constraint webhook_logs_pkey PRIMARY KEY (id);
alter table public.ad_analytics add constraint ad_analytics_campaign_id_date_key UNIQUE (campaign_id, date);
alter table public.ad_usage_limits add constraint ad_usage_limits_client_id_month_key UNIQUE (client_id, month);
alter table public.agent_performance_scores add constraint agent_performance_scores_client_id_user_id_key UNIQUE (client_id, user_id);
alter table public.campaign_steps add constraint campaign_steps_campaign_id_step_order_key UNIQUE (campaign_id, step_order);
alter table public.client_campaigns add constraint client_campaigns_campaign_id_client_id_key UNIQUE (campaign_id, client_id);
alter table public.clients add constraint clients_webhook_secret_key UNIQUE (webhook_secret);
alter table public.creative_jobs add constraint creative_jobs_job_id_key UNIQUE (job_id);
alter table public.daily_digests add constraint daily_digests_client_id_digest_date_key UNIQUE (client_id, digest_date);
alter table public.lead_assignment_pool add constraint lead_assignment_pool_client_id_user_id_key UNIQUE (client_id, user_id);
alter table public.lead_campaign_states add constraint lead_campaign_states_lead_id_campaign_id_key UNIQUE (lead_id, campaign_id);
alter table public.lead_qualifications add constraint lead_qualifications_lead_id_key UNIQUE (lead_id);
alter table public.push_tokens add constraint push_tokens_user_id_device_id_key UNIQUE (user_id, device_id);
alter table public.sequence_steps add constraint sequence_steps_sequence_id_step_order_key UNIQUE (sequence_id, step_order);
alter table public.ad_posts add constraint ad_posts_platform_check CHECK ((platform = ANY (ARRAY['facebook'::text, 'instagram'::text])));
alter table public.ad_posts add constraint ad_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'publishing'::text, 'published'::text, 'failed'::text, 'cancelled'::text])));
alter table public.agent_documents add constraint agent_documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'final'::text])));
alter table public.agent_listings add constraint agent_listings_listing_type_check CHECK ((listing_type = ANY (ARRAY['sale'::text, 'rent'::text])));
alter table public.agent_listings add constraint agent_listings_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])));
alter table public.agent_website_requests add constraint agent_website_requests_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text])));
alter table public.agent_website_requests add constraint agent_website_requests_type_check CHECK ((type = ANY (ARRAY['modify'::text, 'delete'::text])));
alter table public.agent_websites add constraint agent_websites_admin_stage_check CHECK ((admin_stage = ANY (ARRAY['in_review'::text, 'brief_ready'::text, 'qa'::text])));
alter table public.agent_websites add constraint agent_websites_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'building'::text, 'live'::text, 'archived'::text])));
alter table public.announcements add constraint announcements_scope_check CHECK ((scope = ANY (ARRAY['baymo'::text, 'client'::text])));
alter table public.announcements add constraint announcements_scope_client CHECK ((((scope = 'baymo'::text) AND (client_id IS NULL)) OR ((scope = 'client'::text) AND (client_id IS NOT NULL))));
alter table public.appointments add constraint appointments_appointment_type_check CHECK ((appointment_type = ANY (ARRAY['viewing'::text, 'call'::text, 'event'::text])));
alter table public.appointments add constraint appointments_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])));
alter table public.campaign_knowledge_base add constraint campaign_knowledge_base_scope_check CHECK ((scope = ANY (ARRAY['campaign'::text, 'client'::text])));
alter table public.campaign_knowledge_base add constraint cgkb_review_status_chk CHECK ((review_status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text])));
alter table public.campaign_knowledge_base add constraint cgkb_source_type_chk CHECK ((source_type = ANY (ARRAY['field'::text, 'document'::text, 'website'::text, 'listing'::text, 'image'::text])));
alter table public.campaign_knowledge_base add constraint ckb_type_check CHECK ((type = ANY (ARRAY['knowledge'::text, 'instruction'::text])));
alter table public.campaign_lead_assignments add constraint campaign_lead_assignments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'removed'::text])));
alter table public.campaign_requests add constraint campaign_requests_duration_days_check CHECK ((duration_days > 0));
alter table public.campaign_requests add constraint campaign_requests_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'reviewing'::text, 'launched'::text, 'declined'::text])));
alter table public.campaign_steps add constraint campaign_steps_channel_check CHECK ((channel = ANY (ARRAY['messenger'::text, 'email'::text, 'sms'::text, NULL::text])));
alter table public.campaign_steps add constraint campaign_steps_step_type_check CHECK ((step_type = ANY (ARRAY['message'::text, 'notify_agent'::text, 'wait'::text, 'stop'::text])));
alter table public.campaigns add constraint campaigns_automation_scope_check CHECK ((automation_scope = ANY (ARRAY['general'::text, 'project'::text, 'listing'::text])));
alter table public.campaigns add constraint campaigns_campaign_type_check CHECK ((campaign_type = ANY (ARRAY['buyer_leadgen'::text, 'bamo_b2b'::text])));
alter table public.campaigns add constraint campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'active'::text, 'paused'::text, 'completed'::text])));
alter table public.client_onboarding add constraint client_onboarding_business_type_check CHECK ((business_type = ANY (ARRAY['individual'::text, 'brokerage'::text, 'developer'::text])));
alter table public.client_onboarding add constraint client_onboarding_source_check CHECK ((source = ANY (ARRAY['mobile_app'::text, 'tally'::text, 'web'::text])));
alter table public.client_onboarding add constraint client_onboarding_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'submitted'::text, 'reviewed'::text, 'approved'::text])));
alter table public.client_reference_documents add constraint client_reference_documents_file_type_check CHECK ((file_type = ANY (ARRAY['pdf'::text, 'docx'::text, 'txt'::text, 'md'::text])));
alter table public.clients add constraint clients_assignment_mode_chk CHECK ((assignment_mode = ANY (ARRAY['manual'::text, 'round_robin'::text, 'performance'::text])));
alter table public.conversations add constraint conversations_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'messenger'::text, 'viber'::text, 'bamo'::text, 'manual'::text])));
alter table public.conversations add constraint conversations_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'received'::text])));
alter table public.conversations add constraint conversations_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])));
alter table public.conversations add constraint conversations_sent_via_check CHECK ((sent_via = ANY (ARRAY['resend'::text, 'facebook_api'::text, 'viber_api'::text, 'bamo_api'::text, 'manual'::text, NULL::text])));
alter table public.creative_jobs add constraint creative_jobs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])));
alter table public.creative_prompts add constraint creative_prompts_creative_type_check CHECK (((creative_type)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'carousel'::character varying])::text[])));
alter table public.creative_prompts add constraint creative_prompts_generation_method_check CHECK (((generation_method)::text = ANY ((ARRAY['upload'::character varying, 'canva'::character varying, 'fal'::character varying, 'creatomate'::character varying, 'pexels'::character varying])::text[])));
alter table public.creatives add constraint creatives_creative_type_check CHECK (((creative_type)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'carousel'::character varying])::text[])));
alter table public.creatives add constraint creatives_generation_method_check CHECK (((generation_method)::text = ANY (ARRAY[('upload'::character varying)::text, ('canva'::character varying)::text, ('fal'::character varying)::text, ('creatomate'::character varying)::text, ('pexels'::character varying)::text, ('bamo'::character varying)::text])));
alter table public.creatives add constraint creatives_job_status_check CHECK (((job_status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])));
alter table public.follow_up_decisions add constraint follow_up_decisions_decision_check CHECK ((decision = ANY (ARRAY['send'::text, 'wait'::text, 'escalate'::text, 'stop'::text, 'answer_pending'::text])));
alter table public.followup_requests add constraint followup_requests_action_check CHECK ((action = ANY (ARRAY['enable'::text, 'disable'::text])));
alter table public.followup_requests add constraint followup_requests_duration_days_check CHECK ((duration_days = ANY (ARRAY[7, 14, 30])));
alter table public.followup_requests add constraint followup_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text, 'disabled'::text])));
alter table public.followup_requests add constraint followup_requests_style_check CHECK ((style = ANY (ARRAY['gentle'::text, 'standard'::text, 'persistent'::text])));
alter table public.lead_alert_emails add constraint lead_alert_emails_alert_kind_check CHECK ((alert_kind = ANY (ARRAY['hot'::text, 'viewing'::text, 'hot_viewing'::text, 'backfill'::text])));
alter table public.lead_alert_emails add constraint lead_alert_emails_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'suppressed'::text, 'failed'::text])));
alter table public.lead_assignment_events add constraint lead_assignment_events_method_check CHECK ((method = ANY (ARRAY['manual'::text, 'auto_round_robin'::text, 'auto_performance'::text, 'system'::text])));
alter table public.lead_assignment_pool add constraint lead_assignment_pool_weight_check CHECK (((weight >= 0.5) AND (weight <= 2.0)));
alter table public.lead_campaign_states add constraint lead_campaign_states_last_ai_decision_check CHECK ((last_ai_decision = ANY (ARRAY['proceed'::text, 'skip'::text, 'pause'::text, 'notify_agent'::text, NULL::text])));
alter table public.lead_campaign_states add constraint lead_campaign_states_state_check CHECK ((state = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'stopped'::text])));
alter table public.lead_memory add constraint lead_memory_confidence_check CHECK ((confidence = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table public.lead_memory add constraint lead_memory_memory_label_check CHECK ((memory_label = ANY (ARRAY['budget_min'::text, 'budget_max'::text, 'preferred_location'::text, 'property_type'::text, 'hesitation'::text, 'financing_concern'::text, 'urgency'::text, 'move_in_timeline'::text, 'payment_preference'::text, 'buying_signal'::text, 'language_preference'::text, 'tone_preference'::text])));
alter table public.lead_memory add constraint lead_memory_memory_type_check CHECK ((memory_type = ANY (ARRAY['qualification'::text, 'objection'::text, 'preference'::text, 'intent_signal'::text, 'context'::text])));
alter table public.lead_qualifications add constraint lead_qualifications_decision_maker_check CHECK (((decision_maker IS NULL) OR (decision_maker = ANY (ARRAY['sole'::text, 'with_spouse'::text, 'with_family'::text]))));
alter table public.lead_qualifications add constraint lead_qualifications_income_source_check CHECK (((income_source IS NULL) OR (income_source = ANY (ARRAY['employed'::text, 'ofw'::text, 'business'::text, 'retired'::text]))));
alter table public.lead_qualifications add constraint lead_qualifications_payment_scheme_check CHECK (((payment_scheme IS NULL) OR (payment_scheme = ANY (ARRAY['spot_cash'::text, 'deferred'::text, 'installment'::text, 'rent_to_own'::text]))));
alter table public.lead_qualifications add constraint lead_qualifications_preferred_financing_check CHECK (((preferred_financing IS NULL) OR (preferred_financing = ANY (ARRAY['cash'::text, 'pag_ibig'::text, 'bank_loan'::text, 'in_house'::text, 'undecided'::text]))));
alter table public.lead_qualifications add constraint lead_qualifications_property_sub_type_check CHECK (((property_sub_type IS NULL) OR (property_sub_type = ANY (ARRAY['house_and_lot'::text, 'vacant_lot'::text, 'condo'::text, 'townhouse'::text, 'single_detached'::text, 'single_attached'::text]))));
alter table public.lead_qualifications add constraint lead_qualifications_purpose_check CHECK (((purpose IS NULL) OR (purpose = ANY (ARRAY['investment'::text, 'own_use'::text, 'both'::text]))));
alter table public.leads add constraint leads_conversation_stage_check CHECK ((conversation_stage = ANY (ARRAY['greeting'::text, 'qualifying'::text, 'profile_complete'::text, 'viewing_set'::text, 'nurturing'::text, 'reengaging'::text])));
alter table public.leads add constraint leads_follow_up_preference_check CHECK ((follow_up_preference = ANY (ARRAY['call'::text, 'chat'::text, 'email'::text, 'site_visit'::text])));
alter table public.leads add constraint leads_lead_quality_check CHECK ((lead_quality = ANY (ARRAY['Browsing'::text, 'Interested'::text, 'Motivated'::text, 'Qualified'::text, 'Ready'::text, 'Nurture'::text])));
alter table public.leads add constraint leads_lead_type_chk CHECK (((lead_type IS NULL) OR (lead_type = ANY (ARRAY['Buyer'::text, 'Seller'::text, 'Agent'::text, 'Developer'::text, 'Affiliate'::text, 'Others'::text]))));
alter table public.leads add constraint leads_status_chk CHECK ((status = ANY (ARRAY['New'::text, 'In Contact'::text, 'Qualifying'::text, 'Qualified'::text, 'Viewing'::text, 'Negotiating'::text, 'Nurture'::text, 'Won'::text, 'Lost'::text, 'Unqualified'::text])));
alter table public.leads add constraint leads_temperature_chk CHECK ((lead_temperature = ANY (ARRAY['New'::text, 'Hot'::text, 'Warm'::text, 'Cold'::text])));
alter table public.message_templates add constraint message_templates_category_check CHECK ((category = ANY (ARRAY['Introduction'::text, 'Follow-up'::text, 'Qualification'::text, 'Property Offer'::text, 'Closing'::text, 'Call-to-Action'::text])));
alter table public.message_templates add constraint message_templates_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'messenger'::text, 'sms'::text])));
alter table public.message_templates add constraint message_templates_goal_chk CHECK (((goal IS NULL) OR (goal = ANY (ARRAY['invite_viewing'::text, 'invite_open_house'::text, 'send_info'::text, 'ask_qualifying_question'::text, 'other'::text]))));
alter table public.message_templates add constraint message_templates_topic_required_chk CHECK (((goal <> 'send_info'::text) OR (topic IS NOT NULL)));
alter table public.page_connection_requests add constraint page_connection_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'connected'::text, 'rejected'::text])));
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['baymo_admin'::text, 'client_admin'::text, 'manager'::text, 'agent'::text, 'viewer'::text])));
alter table public.sequence_enrollments add constraint sequence_enrollments_state_check CHECK ((state = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'exited'::text, 'waiting_window'::text])));
alter table public.sequence_steps add constraint sequence_steps_step_type_check CHECK ((step_type = ANY (ARRAY['messenger'::text, 'email'::text, 'call'::text])));
alter table public.sequences add constraint sequences_mode_check CHECK ((mode = ANY (ARRAY['fixed'::text, 'ai_adaptive'::text])));
alter table public.social_autopost_plans add constraint social_autopost_plans_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'expired'::text, 'cancelled'::text])));
alter table public.subscription_requests add constraint subscription_requests_product_check CHECK ((product = ANY (ARRAY['social_autopost'::text, 'fb_page_connection'::text, 'ads_plan_upgrade'::text, 'ads_account_setup'::text, 'account_deletion'::text])));
alter table public.subscription_requests add constraint subscription_requests_status_check CHECK ((status = ANY (ARRAY['open'::text, 'contacted'::text, 'closed'::text])));
alter table public.tasks add constraint tasks_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'campaign'::text, 'system'::text, 'baymo'::text])));
alter table public.tasks add constraint tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'overdue'::text, 'cancelled'::text, 'deferred'::text])));
alter table public.tasks add constraint tasks_task_type_check CHECK ((task_type = ANY (ARRAY['follow-up'::text, 'send-listings'::text, 'viewing-reminder'::text, 're-engagement'::text, 'follow_up'::text, 'Call'::text, 'Email'::text, 'Follow-up'::text, 'Meeting'::text, 'Other'::text, 'takeover'::text, 'general'::text])));
alter table public.tasks add constraint tasks_triggered_by_check CHECK ((triggered_by = ANY (ARRAY['manual'::text, 'campaign'::text, 'baymo'::text, 'system'::text, 'sequence_scheduler'::text, 'followup_engine'::text])));
alter table public.video_requests add constraint video_requests_duration_seconds_check CHECK ((duration_seconds = ANY (ARRAY[15, 30, 60])));
alter table public.video_requests add constraint video_requests_format_check CHECK ((format = ANY (ARRAY['square'::text, 'vertical'::text, 'landscape'::text])));
alter table public.video_requests add constraint video_requests_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'in_production'::text, 'delivered'::text, 'cancelled'::text])));
alter table public.video_requests add constraint video_requests_video_type_check CHECK ((video_type = ANY (ARRAY['listing_tour'::text, 'teaser_reel'::text, 'open_house_invite'::text, 'agent_intro'::text, 'market_update'::text])));
alter table public.ad_activity_log add constraint ad_activity_log_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.ad_activity_log add constraint ad_activity_log_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES profiles(id);
alter table public.ad_analytics add constraint ad_analytics_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE;
alter table public.ad_analytics add constraint ad_analytics_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.ad_campaigns add constraint ad_campaigns_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.ad_campaigns add constraint ad_campaigns_content_id_fkey FOREIGN KEY (content_id) REFERENCES ad_content(id) ON DELETE SET NULL;
alter table public.ad_campaigns add constraint ad_campaigns_creative_id_fkey FOREIGN KEY (creative_id) REFERENCES creatives(id) ON DELETE SET NULL;
alter table public.ad_campaigns add constraint ad_campaigns_launched_by_fkey FOREIGN KEY (launched_by) REFERENCES profiles(id);
alter table public.ad_campaigns add constraint ad_campaigns_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES ad_listings(id) ON DELETE SET NULL;
alter table public.ad_campaigns add constraint ad_campaigns_social_account_id_fkey FOREIGN KEY (social_account_id) REFERENCES ad_social_accounts(id) ON DELETE SET NULL;
alter table public.ad_content add constraint ad_content_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.ad_content add constraint ad_content_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public.ad_creatives add constraint ad_creatives_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.ad_creatives add constraint ad_creatives_content_id_fkey FOREIGN KEY (content_id) REFERENCES ad_content(id) ON DELETE SET NULL;
alter table public.ad_listings add constraint ad_listings_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.ad_notifications add constraint ad_notifications_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.ad_posts add constraint ad_posts_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.ad_posts add constraint ad_posts_content_id_fkey FOREIGN KEY (content_id) REFERENCES ad_content(id) ON DELETE SET NULL;
alter table public.ad_posts add constraint ad_posts_creative_id_fkey FOREIGN KEY (creative_id) REFERENCES creatives(id) ON DELETE SET NULL;
alter table public.ad_posts add constraint ad_posts_social_account_id_fkey FOREIGN KEY (social_account_id) REFERENCES ad_social_accounts(id) ON DELETE SET NULL;
alter table public.ad_reports add constraint ad_reports_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.ad_social_accounts add constraint ad_social_accounts_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.ad_templates add constraint ad_templates_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.ad_usage_limits add constraint ad_usage_limits_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.agent_documents add constraint agent_documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.agent_documents add constraint agent_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.agent_documents add constraint agent_documents_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
alter table public.agent_performance_scores add constraint agent_performance_scores_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.agent_performance_scores add constraint agent_performance_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.agent_website_requests add constraint agent_website_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.agent_website_requests add constraint agent_website_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.agent_website_requests add constraint agent_website_requests_website_id_fkey FOREIGN KEY (website_id) REFERENCES agent_websites(id) ON DELETE CASCADE;
alter table public.agent_websites add constraint agent_websites_assigned_admin_fkey FOREIGN KEY (assigned_admin) REFERENCES auth.users(id);
alter table public.agent_websites add constraint agent_websites_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.agent_websites add constraint agent_websites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.ai_usage add constraint ai_usage_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.announcements add constraint announcements_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.appointments add constraint appointments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
alter table public.campaign_knowledge_base add constraint campaign_knowledge_base_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
alter table public.campaign_knowledge_base add constraint campaign_knowledge_base_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.campaign_knowledge_base add constraint campaign_knowledge_base_replaces_kb_id_fkey FOREIGN KEY (replaces_kb_id) REFERENCES campaign_knowledge_base(id) ON DELETE SET NULL;
alter table public.campaign_lead_assignments add constraint campaign_lead_assignments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
alter table public.campaign_lead_assignments add constraint campaign_lead_assignments_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.campaign_lead_assignments add constraint campaign_lead_assignments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.campaign_requests add constraint campaign_requests_ad_campaign_id_fkey FOREIGN KEY (ad_campaign_id) REFERENCES ad_campaigns(id) ON DELETE SET NULL;
alter table public.campaign_requests add constraint campaign_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.campaign_requests add constraint campaign_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.campaign_requests add constraint campaign_requests_creative_id_fkey FOREIGN KEY (creative_id) REFERENCES ad_creatives(id) ON DELETE SET NULL;
alter table public.campaign_requests add constraint campaign_requests_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES agent_listings(id) ON DELETE SET NULL;
alter table public.campaign_steps add constraint campaign_steps_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
alter table public.campaign_steps add constraint campaign_steps_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.campaigns add constraint campaigns_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.campaigns add constraint campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.client_assets add constraint client_assets_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.client_assets add constraint client_assets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id);
alter table public.client_campaigns add constraint client_campaigns_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
alter table public.client_campaigns add constraint client_campaigns_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.client_onboarding add constraint client_onboarding_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public.client_onboarding add constraint client_onboarding_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.client_reference_documents add constraint client_reference_documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.client_reference_documents add constraint client_reference_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.conversations add constraint conversations_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.conversations add constraint conversations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.conversations add constraint conversations_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.creative_jobs add constraint creative_jobs_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.creative_jobs add constraint creative_jobs_creative_id_fkey FOREIGN KEY (creative_id) REFERENCES creatives(id) ON DELETE CASCADE;
alter table public.creative_prompts add constraint creative_prompts_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.creative_prompts add constraint creative_prompts_template_id_fkey FOREIGN KEY (template_id) REFERENCES ad_templates(id) ON DELETE SET NULL;
alter table public.creatives add constraint creatives_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.creatives add constraint creatives_parent_creative_id_fkey FOREIGN KEY (parent_creative_id) REFERENCES creatives(id) ON DELETE CASCADE;
alter table public.creatives add constraint creatives_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES creative_prompts(id) ON DELETE SET NULL;
alter table public.daily_digests add constraint daily_digests_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.email_templates add constraint email_templates_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
alter table public.email_templates add constraint email_templates_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.enrollment_rules add constraint enrollment_rules_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE;
alter table public.follow_up_decisions add constraint follow_up_decisions_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.follow_up_decisions add constraint follow_up_decisions_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES sequence_enrollments(id) ON DELETE CASCADE;
alter table public.follow_up_decisions add constraint follow_up_decisions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.followup_requests add constraint followup_requests_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
alter table public.followup_requests add constraint followup_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.followup_requests add constraint followup_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.followup_requests add constraint followup_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.kb_chunks add constraint kb_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES kb_documents(id) ON DELETE CASCADE;
alter table public.kb_documents add constraint kb_documents_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
alter table public.kb_documents add constraint kb_documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.lead_alert_emails add constraint lead_alert_emails_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.lead_assignment_events add constraint lead_assignment_events_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.lead_assignment_events add constraint lead_assignment_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.lead_assignment_events add constraint lead_assignment_events_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.lead_assignment_pool add constraint lead_assignment_pool_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.lead_assignment_pool add constraint lead_assignment_pool_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.lead_campaign_states add constraint lead_campaign_states_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
alter table public.lead_campaign_states add constraint lead_campaign_states_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.lead_campaign_states add constraint lead_campaign_states_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.lead_campaign_states add constraint lead_campaign_states_paused_by_fkey FOREIGN KEY (paused_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.lead_memory add constraint lead_memory_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
alter table public.lead_memory add constraint lead_memory_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.lead_memory add constraint lead_memory_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.lead_memory add constraint lead_memory_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES conversations(id) ON DELETE SET NULL;
alter table public.lead_memory add constraint lead_memory_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES lead_memory(id) ON DELETE SET NULL;
alter table public.lead_notes add constraint lead_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.lead_notes add constraint lead_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.lead_notes add constraint lead_notes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.lead_qualifications add constraint lead_qualifications_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.lead_qualifications add constraint lead_qualifications_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.lead_temperature_events add constraint lead_temperature_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.leads add constraint leads_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.leads add constraint leads_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
alter table public.leads add constraint leads_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.message_templates add constraint message_templates_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.message_templates add constraint message_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public.messenger_referrals add constraint messenger_referrals_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
alter table public.notification_preferences add constraint notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.page_connection_requests add constraint page_connection_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.page_connection_requests add constraint page_connection_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_client_id_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL NOT VALID;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.prompt_templates add constraint prompt_templates_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.push_tokens add constraint push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.sequence_enrollments add constraint sequence_enrollments_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.sequence_enrollments add constraint sequence_enrollments_enrollment_rule_id_fkey FOREIGN KEY (enrollment_rule_id) REFERENCES enrollment_rules(id) ON DELETE SET NULL;
alter table public.sequence_enrollments add constraint sequence_enrollments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.sequence_enrollments add constraint sequence_enrollments_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE;
alter table public.sequence_steps add constraint sequence_steps_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE;
alter table public.sequences add constraint sequences_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
alter table public.sequences add constraint sequences_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.social_autopost_plans add constraint social_autopost_plans_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.social_autopost_plans add constraint social_autopost_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.subscription_requests add constraint subscription_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.subscription_requests add constraint subscription_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.subscription_requests add constraint subscription_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES auth.users(id);
alter table public.tasks add constraint tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.tasks add constraint tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.tasks add constraint tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.tasks add constraint tasks_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.user_onboarding_tour add constraint user_onboarding_tour_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public.user_onboarding_tour add constraint user_onboarding_tour_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.video_requests add constraint video_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.video_requests add constraint video_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.video_requests add constraint video_requests_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES agent_listings(id) ON DELETE SET NULL;
alter table public.webhook_logs add constraint webhook_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public.webhook_logs add constraint webhook_logs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX ad_analytics_client_metaad_date_uq ON public.ad_analytics USING btree (client_id, meta_ad_id, date) WHERE (meta_ad_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS ad_reports_client_created_idx ON public.ad_reports USING btree (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_documents_client_idx ON public.agent_documents USING btree (client_id);
CREATE INDEX IF NOT EXISTS agent_documents_created_by_idx ON public.agent_documents USING btree (created_by);
CREATE INDEX IF NOT EXISTS agent_listings_client_idx ON public.agent_listings USING btree (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_website_requests_website_idx ON public.agent_website_requests USING btree (website_id);
CREATE INDEX IF NOT EXISTS agent_websites_client_idx ON public.agent_websites USING btree (client_id);
CREATE INDEX IF NOT EXISTS agent_websites_created_by_idx ON public.agent_websites USING btree (created_by);
CREATE INDEX IF NOT EXISTS appointments_client_time_idx ON public.appointments USING btree (client_id, scheduled_at);
CREATE UNIQUE INDEX campaigns_one_organic_owner_per_client ON public.campaigns USING btree (client_id) WHERE (is_organic_owner AND (status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'active'::text, 'paused'::text])));
CREATE INDEX IF NOT EXISTS client_onboarding_client_id_idx ON public.client_onboarding USING btree (client_id);
CREATE INDEX IF NOT EXISTS client_onboarding_profile_id_idx ON public.client_onboarding USING btree (profile_id);
CREATE INDEX IF NOT EXISTS client_onboarding_status_idx ON public.client_onboarding USING btree (status);
CREATE INDEX IF NOT EXISTS client_reference_documents_client_created_idx ON public.client_reference_documents USING btree (client_id, created_at DESC);
CREATE UNIQUE INDEX clients_fb_page_id_idx ON public.clients USING btree (fb_page_id) WHERE (fb_page_id IS NOT NULL);
CREATE UNIQUE INDEX conversations_external_msg_id_uniq ON public.conversations USING btree (external_msg_id) WHERE (external_msg_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS follow_up_decisions_client_created_idx ON public.follow_up_decisions USING btree (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS follow_up_decisions_enrollment_idx ON public.follow_up_decisions USING btree (enrollment_id);
CREATE INDEX IF NOT EXISTS follow_up_decisions_lead_idx ON public.follow_up_decisions USING btree (lead_id);
CREATE UNIQUE INDEX followup_requests_one_pending_per_campaign ON public.followup_requests USING btree (campaign_id) WHERE ((status = 'pending'::text) AND (campaign_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS followup_requests_status_created_idx ON public.followup_requests USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_activity_log_client ON public.ad_activity_log USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_ad_analytics_campaign ON public.ad_analytics USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_analytics_date ON public.ad_analytics USING btree (date);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_client ON public.ad_campaigns USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON public.ad_campaigns USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ad_content_client ON public.ad_content USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_client ON public.ad_creatives USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_ad_listings_client ON public.ad_listings USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_ad_notifications_client ON public.ad_notifications USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_ad_notifications_read ON public.ad_notifications USING btree (is_read);
CREATE INDEX IF NOT EXISTS idx_ad_posts_client ON public.ad_posts USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_ad_posts_scheduler ON public.ad_posts USING btree (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ad_posts_status ON public.ad_posts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_announcements_client ON public.announcements USING btree (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_events_client_time ON public.lead_assignment_events USING btree (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_events_lead ON public.lead_assignment_events USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_assignment_events_to_user ON public.lead_assignment_events USING btree (to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign_id ON public.campaign_steps USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_client_id ON public.campaign_steps USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_order ON public.campaign_steps USING btree (campaign_id, step_order);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON public.campaigns USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ckb_campaign_id ON public.campaign_knowledge_base USING btree (campaign_id) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_ckb_campaign_type_active ON public.campaign_knowledge_base USING btree (campaign_id, type, is_active);
CREATE INDEX IF NOT EXISTS idx_ckb_client_scope ON public.campaign_knowledge_base USING btree (client_id) WHERE ((scope = 'client'::text) AND (is_active = true));
CREATE INDEX IF NOT EXISTS idx_cla_campaign_id ON public.campaign_lead_assignments USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_cla_client_id ON public.campaign_lead_assignments USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_cla_lead_id ON public.campaign_lead_assignments USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_client_assets_client ON public.client_assets USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_client_assets_created ON public.client_assets USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_assets_folder ON public.client_assets USING btree (folder);
CREATE INDEX IF NOT EXISTS idx_client_assets_type ON public.client_assets USING btree (file_type);
CREATE INDEX IF NOT EXISTS idx_client_campaigns_campaign ON public.client_campaigns USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_client_campaigns_client ON public.client_campaigns USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON public.conversations USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_direction ON public.conversations USING btree (direction);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_created ON public.conversations USING btree (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON public.conversations USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id_direction ON public.conversations USING btree (lead_id, direction);
CREATE INDEX IF NOT EXISTS idx_creative_jobs_client_id ON public.creative_jobs USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_creative_jobs_creative_id ON public.creative_jobs USING btree (creative_id);
CREATE INDEX IF NOT EXISTS idx_creative_jobs_job_id ON public.creative_jobs USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_creative_jobs_status ON public.creative_jobs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_creatives_client_id ON public.creatives USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_creatives_created_at ON public.creatives USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creatives_job_id ON public.creatives USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_creatives_job_status ON public.creatives USING btree (job_status);
CREATE INDEX IF NOT EXISTS idx_creatives_parent_id ON public.creatives USING btree (parent_creative_id);
CREATE INDEX IF NOT EXISTS idx_creatives_prompt_id ON public.creatives USING btree (prompt_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_rules_sequence_id ON public.enrollment_rules USING btree (sequence_id, enabled);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_campaign ON public.kb_chunks USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_client ON public.kb_chunks USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_lead_campaign_states_campaign_id ON public.lead_campaign_states USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_lead_campaign_states_client_id ON public.lead_campaign_states USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_lead_campaign_states_lead_id ON public.lead_campaign_states USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_campaign_states_n8n_scheduler ON public.lead_campaign_states USING btree (state, next_step_at) WHERE (state = 'active'::text);
CREATE INDEX IF NOT EXISTS idx_lead_notes_client_id ON public.lead_notes USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at ON public.lead_notes USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON public.lead_notes USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_user_id ON public.leads USING btree (assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON public.leads USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON public.leads USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_leads_last_message_at ON public.leads USING btree (last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_leads_lead_temperature ON public.leads USING btree (lead_temperature);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON public.leads USING btree (next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads USING btree (source);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads USING btree (status);
CREATE INDEX IF NOT EXISTS idx_leads_tags ON public.leads USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_leads_unread ON public.leads USING btree (unread_count) WHERE (unread_count > 0);
CREATE INDEX IF NOT EXISTS idx_lte_client_changed ON public.lead_temperature_events USING btree (client_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lte_lead ON public.lead_temperature_events USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_messenger_referrals_psid ON public.messenger_referrals USING btree (psid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_prompts_client_id ON public.creative_prompts USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_prompts_is_favorite ON public.creative_prompts USING btree (is_favorite);
CREATE INDEX IF NOT EXISTS idx_seq_enrollments_client ON public.sequence_enrollments USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_seq_enrollments_due ON public.sequence_enrollments USING btree (state, send_lock, next_step_at) WHERE ((state = 'active'::text) AND (send_lock = false));
CREATE INDEX IF NOT EXISTS idx_seq_enrollments_lead ON public.sequence_enrollments USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_seq_enrollments_sequence ON public.sequence_enrollments USING btree (sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence_id ON public.sequence_steps USING btree (sequence_id, step_order);
CREATE INDEX IF NOT EXISTS idx_sequences_client_id ON public.sequences USING btree (client_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status_due ON public.tasks USING btree (assigned_to, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_status_due ON public.tasks USING btree (client_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks USING btree (due_date) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON public.tasks USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_client_id ON public.webhook_logs USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at ON public.webhook_logs USING btree (received_at DESC);
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx ON public.kb_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');
CREATE INDEX IF NOT EXISTS lead_alert_emails_lead_created_idx ON public.lead_alert_emails USING btree (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_qualifications_client_id_idx ON public.lead_qualifications USING btree (client_id);
CREATE INDEX IF NOT EXISTS lead_qualifications_lead_id_idx ON public.lead_qualifications USING btree (lead_id);
CREATE UNIQUE INDEX leads_messenger_id_client_id_unique ON public.leads USING btree (messenger_id, client_id) WHERE (messenger_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS notifications_unpushed_idx ON public.notifications USING btree (created_at) WHERE (pushed_at IS NULL);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications USING btree (user_id) WHERE (read_at IS NULL);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens USING btree (user_id);
CREATE UNIQUE INDEX sequence_enrollments_live_uniq ON public.sequence_enrollments USING btree (lead_id, sequence_id) WHERE (state = ANY (ARRAY['active'::text, 'waiting_window'::text, 'paused'::text]));
CREATE UNIQUE INDEX sequences_one_adaptive_per_campaign ON public.sequences USING btree (campaign_id) WHERE (mode = 'ai_adaptive'::text);
CREATE UNIQUE INDEX uq_social_acct_client_platform_account ON public.ad_social_accounts USING btree (client_id, platform, account_id);

-- ===== FUNCTIONS =====
CREATE OR REPLACE FUNCTION public.apply_ai_followup_decision(p_enrollment_id uuid, p_action text, p_message text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_goal_status text DEFAULT NULL::text, p_next_check_hours numeric DEFAULT 6, p_window_open boolean DEFAULT true, p_opted_out boolean DEFAULT false, p_context jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_id uuid; v_client_id uuid; v_seq_name text; v_lead_name text; v_log_decision text;
  v_touch_count int; v_anchor timestamptz; v_ws text; v_we text; v_last_step timestamptz;
  v_ladder numeric[]; v_next_idx int; v_min_gap numeric;
  v_target timestamptz; v_local timestamp; v_action text := p_action;
  v_interval interval := GREATEST(p_next_check_hours, 1) * interval '1 hour';
BEGIN
  SELECT se.lead_id, se.client_id, s.name, se.touch_count, l.last_inbound_at, se.last_step_at,
         COALESCE(s.send_window_start,'08:00'), COALESCE(s.send_window_end,'20:00'),
         ARRAY(SELECT x::numeric FROM jsonb_array_elements_text(
                 COALESCE(s.ai_settings->'followup_ladder_hours','[]'::jsonb)) x),
         COALESCE((s.ai_settings->>'min_gap_hours')::numeric, 1)
    INTO v_lead_id, v_client_id, v_seq_name, v_touch_count, v_anchor, v_last_step, v_ws, v_we, v_ladder, v_min_gap
  FROM sequence_enrollments se
  JOIN sequences s ON s.id = se.sequence_id
  JOIN leads l ON l.id = se.lead_id
  WHERE se.id = p_enrollment_id;
  IF v_lead_id IS NULL THEN RETURN; END IF;

  IF array_length(v_ladder,1) IS NOT NULL AND v_action IN ('send','wait') AND v_anchor IS NOT NULL THEN
    v_next_idx := CASE WHEN v_action = 'send' THEN v_touch_count + 2 ELSE v_touch_count + 1 END;

    IF v_next_idx > array_length(v_ladder,1) THEN
      v_action := 'exhausted_ladder';
    ELSE
      -- ABSOLUTE offset from the lead's last inbound, not a cumulative sum.
      v_target := v_anchor + v_ladder[v_next_idx] * interval '1 hour';

      v_local := timezone('Asia/Manila', v_target);
      IF v_local::time < v_ws::time THEN
        v_local := v_local::date + v_ws::time;
      ELSIF v_local::time > v_we::time THEN
        v_local := (v_local::date + 1) + v_ws::time;
      END IF;
      v_target := timezone('Asia/Manila', v_local);

      -- Never schedule anything sooner than min_gap from now. Applies to waits
      -- too: without it a ladder step already in the past made the enrollment
      -- due again on the very next tick, looping every 15 minutes.
      v_target := GREATEST(v_target, now() + v_min_gap * interval '1 hour');
      IF v_last_step IS NOT NULL THEN
        v_target := GREATEST(v_target, v_last_step + v_min_gap * interval '1 hour');
      END IF;

      v_local := timezone('Asia/Manila', v_target);
      IF v_local::time < v_ws::time THEN
        v_local := v_local::date + v_ws::time;
      ELSIF v_local::time > v_we::time THEN
        v_local := (v_local::date + 1) + v_ws::time;
      END IF;
      v_target := timezone('Asia/Manila', v_local);

      IF v_target >= v_anchor + interval '24 hours' THEN
        v_action := 'park_window';
      END IF;
    END IF;
  ELSE
    v_target := now() + v_interval;
  END IF;

  IF v_action = 'send' THEN
    UPDATE sequence_enrollments
       SET touch_count = touch_count + 1, next_action_at = v_target,
           last_step_at = now(), send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'send';
  ELSIF v_action = 'wait' THEN
    UPDATE sequence_enrollments
       SET next_action_at = v_target, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'wait';
  ELSIF v_action = 'park_window' THEN
    -- The 24h window is gone and we cannot legally message again until the lead
    -- speaks first. Exit rather than park, so the lead is not blocked from
    -- re-enrolling the next time they do.
    UPDATE sequence_enrollments
       SET touch_count = touch_count + CASE WHEN p_action = 'send' THEN 1 ELSE 0 END,
           last_step_at = CASE WHEN p_action = 'send' THEN now() ELSE last_step_at END,
           state = 'exited', outcome = 'window_closed', completed_at = now(),
           next_action_at = NULL, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := CASE WHEN p_action = 'send' THEN 'send' ELSE 'stop' END;
  ELSIF v_action = 'exhausted_ladder' THEN
    UPDATE sequence_enrollments
       SET touch_count = touch_count + CASE WHEN p_action = 'send' THEN 1 ELSE 0 END,
           last_step_at = CASE WHEN p_action = 'send' THEN now() ELSE last_step_at END,
           state = 'exited', outcome = 'exhausted', completed_at = now(),
           next_action_at = NULL, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := CASE WHEN p_action = 'send' THEN 'send' ELSE 'stop' END;
  ELSIF v_action = 'paused_rejected' THEN
    UPDATE sequence_enrollments
       SET state = 'paused', paused_reason = 'send_failed_fb_rejected',
           next_action_at = NULL, send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'stop';
  ELSIF v_action = 'escalate' THEN
    UPDATE sequence_enrollments
       SET state = 'exited', outcome = 'escalated', completed_at = now(),
           send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'escalate';
  ELSE
    UPDATE sequence_enrollments
       SET state = 'exited', outcome = CASE WHEN p_opted_out THEN 'opted_out' ELSE 'exhausted' END,
           completed_at = now(), send_lock = false, updated_at = now()
     WHERE id = p_enrollment_id;
    v_log_decision := 'stop';
  END IF;

  IF p_action = 'send' AND p_message IS NOT NULL AND btrim(p_message) <> '' THEN
    INSERT INTO conversations
      (lead_id, client_id, sender, message_content, channel, direction, sent_via, delivery_status, ai_reason)
    VALUES
      (v_lead_id, v_client_id, 'ai', p_message, 'messenger', 'outbound', 'followup_engine', 'sent', p_reason);
  END IF;

  IF p_opted_out THEN
    UPDATE leads SET followup_opted_out = true, followup_opted_out_at = now()
    WHERE id = v_lead_id AND followup_opted_out = false;
  END IF;

  INSERT INTO follow_up_decisions
    (enrollment_id, lead_id, client_id, decision, reason, message_sent, goal_status, window_open, context_snapshot)
  VALUES
    (p_enrollment_id, v_lead_id, v_client_id, v_log_decision, p_reason,
     CASE WHEN p_action='send' THEN p_message ELSE NULL END, p_goal_status, p_window_open, p_context);

  IF v_action = 'escalate' THEN
    IF NOT EXISTS (SELECT 1 FROM tasks t WHERE t.lead_id = v_lead_id
                     AND t.triggered_by = 'followup_engine' AND t.status = 'pending') THEN
      SELECT name INTO v_lead_name FROM leads WHERE id = v_lead_id;
      INSERT INTO tasks (lead_id, client_id, title, task_type, notes, status, source, triggered_by, due_date)
      VALUES (v_lead_id, v_client_id,
        'Hot lead â€” BaMo follow-up flagged buying intent' || COALESCE(' (' || v_lead_name || ')', ''),
        're-engagement',
        COALESCE(p_reason, 'BaMo AI follow-up detected buying intent and escalated for a human handoff.'),
        'pending', 'system', 'followup_engine', CURRENT_DATE);
    END IF;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.array_to_halfvec(integer[], integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_halfvec$function$
;

CREATE OR REPLACE FUNCTION public.array_to_halfvec(real[], integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_halfvec$function$
;

CREATE OR REPLACE FUNCTION public.array_to_halfvec(double precision[], integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_halfvec$function$
;

CREATE OR REPLACE FUNCTION public.array_to_halfvec(numeric[], integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_halfvec$function$
;

CREATE OR REPLACE FUNCTION public.array_to_sparsevec(integer[], integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_sparsevec$function$
;

CREATE OR REPLACE FUNCTION public.array_to_sparsevec(real[], integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_sparsevec$function$
;

CREATE OR REPLACE FUNCTION public.array_to_sparsevec(double precision[], integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_sparsevec$function$
;

CREATE OR REPLACE FUNCTION public.array_to_sparsevec(numeric[], integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_sparsevec$function$
;

CREATE OR REPLACE FUNCTION public.array_to_vector(integer[], integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_vector$function$
;

CREATE OR REPLACE FUNCTION public.array_to_vector(real[], integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_vector$function$
;

CREATE OR REPLACE FUNCTION public.array_to_vector(double precision[], integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_vector$function$
;

CREATE OR REPLACE FUNCTION public.array_to_vector(numeric[], integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_vector$function$
;

CREATE OR REPLACE FUNCTION public.auto_assign_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mode text;
  v_sources text[];
  v_pick uuid;
BEGIN
  IF NEW.assigned_user_id IS NOT NULL OR auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT assignment_mode, assignment_sources
    INTO v_mode, v_sources
    FROM public.clients WHERE id = NEW.client_id;

  IF v_mode IS NULL OR v_mode = 'manual' THEN
    RETURN NEW;
  END IF;

  IF v_sources IS NOT NULL AND (NEW.source IS NULL OR NOT (NEW.source = ANY (v_sources))) THEN
    RETURN NEW;
  END IF;

  IF v_mode = 'performance' THEN
    SELECT p.user_id INTO v_pick
    FROM public.lead_assignment_pool p
    JOIN public.profiles pr ON pr.id = p.user_id AND pr.is_active
    WHERE p.client_id = NEW.client_id AND p.is_active
    ORDER BY
      extract(epoch FROM (clock_timestamp() - COALESCE(p.last_assigned_at, 'epoch'::timestamptz))) * p.weight DESC,
      p.user_id
    LIMIT 1
    FOR UPDATE OF p SKIP LOCKED;
  ELSE
    SELECT p.user_id INTO v_pick
    FROM public.lead_assignment_pool p
    JOIN public.profiles pr ON pr.id = p.user_id AND pr.is_active
    WHERE p.client_id = NEW.client_id AND p.is_active
    ORDER BY p.last_assigned_at ASC NULLS FIRST, p.user_id
    LIMIT 1
    FOR UPDATE OF p SKIP LOCKED;
  END IF;

  IF v_pick IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.lead_assignment_pool
    SET last_assigned_at = clock_timestamp()
    WHERE client_id = NEW.client_id AND user_id = v_pick;

  NEW.assigned_user_id := v_pick;
  PERFORM set_config(
    'bamo.am_' || replace(NEW.id::text, '-', ''),
    CASE v_mode WHEN 'performance' THEN 'auto_performance' ELSE 'auto_round_robin' END,
    true
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_provision_client_from_onboarding()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_name      text;
BEGIN
  -- Only Tally submissions, only on entering 'submitted', only once.
  IF NEW.source IS DISTINCT FROM 'tally' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'submitted' THEN RETURN NEW; END IF;
  IF NEW.client_id IS NOT NULL THEN RETURN NEW; END IF;

  v_name := COALESCE(
    NULLIF(btrim(NEW.full_name), ''),
    NULLIF(btrim(NEW.company_name), ''),
    NEW.email,
    'New Client'
  );

  -- Reuse an existing workspace with the same email (idempotent on resubmission).
  IF NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE lower(email) = lower(btrim(NEW.email))
    LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO clients (name, company_name, email, phone, business_type)
    VALUES (
      v_name,
      NULLIF(btrim(NEW.company_name), ''),
      NULLIF(btrim(NEW.email), ''),
      NULLIF(btrim(NEW.phone), ''),
      NEW.business_type
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- Link + approve on the same row (BEFORE trigger: mutate NEW, no re-fire).
  NEW.client_id   := v_client_id;
  NEW.status      := 'approved';
  NEW.reviewed_at := now();

  -- Notify every BaMo admin.
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT p.id,
         'client_onboarded',
         'New client onboarded: ' || v_name,
         concat_ws(' Â· ',
           NULLIF(btrim(NEW.company_name), ''),
           NULLIF(btrim(NEW.email), ''),
           NULLIF(btrim(NEW.phone), '')
         ),
         jsonb_build_object(
           'onboarding_id', NEW.id,
           'client_id',     v_client_id,
           'source',        NEW.source
         )
  FROM profiles p
  WHERE p.role = 'baymo_admin';

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.binary_quantize(vector)
 RETURNS bit
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$binary_quantize$function$
;

CREATE OR REPLACE FUNCTION public.binary_quantize(halfvec)
 RETURNS bit
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_binary_quantize$function$
;

CREATE OR REPLACE FUNCTION public.check_push_dispatch_secret(p text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'vault', 'public'
AS $function$
  select exists (
    select 1 from vault.decrypted_secrets
     where name = 'push_dispatch_secret' and decrypted_secret = p
  );
$function$
;

CREATE OR REPLACE FUNCTION public.client_has_active_campaign()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from campaigns
    where client_id = get_my_client_id()
      and status = 'active' and is_active = true
  );
$function$
;

CREATE OR REPLACE FUNCTION public.compose_kb_content(f jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT trim(both E'\n' FROM string_agg(line, E'\n\n' ORDER BY ord))
  FROM (
    SELECT ord, label || E':\n' || val AS line
    FROM (VALUES
      (1,  'PROJECT / OFFERING', f->>'project_name'),
      (2,  'LOCATION',           f->>'location'),
      (3,  'PRICING & UNITS',    f->>'pricing'),
      (4,  'FINANCING',          f->>'financing'),
      (5,  'PROMOS / DISCOUNTS', f->>'promos'),
      (6,  'AMENITIES',          f->>'amenities'),
      (7,  'TURNOVER',           f->>'turnover'),
      (8,  'RESERVATION',        f->>'reservation'),
      (9,  'VIEWING',            f->>'viewing'),
      (10, 'CONTACT',            f->>'contact'),
      (11, 'OTHER',              f->>'other')
    ) AS t(ord, label, val)
    WHERE val IS NOT NULL AND length(trim(val)) > 0
    UNION ALL
    SELECT 100 + (ROW_NUMBER() OVER ())::int,
           upper(c->>'label') || E':\n' || (c->>'value')
    FROM jsonb_array_elements(COALESCE(f->'custom','[]'::jsonb)) c
    WHERE c->>'value' IS NOT NULL AND length(trim(c->>'value')) > 0
  ) s;
$function$
;

CREATE OR REPLACE FUNCTION public.compute_agent_performance_scores(p_client_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid;
  v_window timestamptz := now() - interval '90 days';
  v_rows int;
  v_total int := 0;
BEGIN
  FOR v_client IN
    SELECT DISTINCT client_id FROM public.lead_assignment_pool
    WHERE p_client_id IS NULL OR client_id = p_client_id
  LOOP
    WITH members AS (
      SELECT pool.user_id, pool.created_at AS joined_at
      FROM public.lead_assignment_pool pool
      WHERE pool.client_id = v_client
    ),
    assigned AS (
      SELECT m.user_id, count(DISTINCT x.lead_id) AS assigned_count
      FROM members m
      LEFT JOIN (
        SELECT e.to_user_id AS uid, e.lead_id
        FROM public.lead_assignment_events e
        WHERE e.client_id = v_client AND e.created_at >= v_window AND e.to_user_id IS NOT NULL
        UNION
        SELECT l.assigned_user_id, l.id
        FROM public.leads l
        WHERE l.client_id = v_client AND l.assigned_user_id IS NOT NULL AND l.created_at >= v_window
      ) x ON x.uid = m.user_id
      GROUP BY m.user_id
    ),
    won AS (
      SELECT l.assigned_user_id AS user_id, count(*) AS won_count
      FROM public.leads l
      WHERE l.client_id = v_client AND l.status = 'Won'
        AND l.assigned_user_id IS NOT NULL
        AND COALESCE(l.status_updated_at, l.updated_at, l.created_at) >= v_window
      GROUP BY l.assigned_user_id
    ),
    touch_counts AS (
      SELECT m.user_id,
        (SELECT count(*) FROM public.lead_notes n
          WHERE n.client_id = v_client AND n.created_by = m.user_id AND n.created_at >= v_window)
        + (SELECT count(*) FROM public.tasks t
          WHERE t.client_id = v_client AND t.assigned_to = m.user_id AND t.completed_at >= v_window)
        + (SELECT count(*) FROM public.appointments a
          WHERE a.client_id = v_client AND a.created_by = m.user_id AND a.created_at >= v_window)
        + (SELECT count(*) FROM public.conversations c
          JOIN public.leads lc ON lc.id = c.lead_id
          WHERE c.client_id = v_client AND c.sender = 'agent' AND c.created_at >= v_window
            AND (c.sender_id = m.user_id OR (c.sender_id IS NULL AND lc.assigned_user_id = m.user_id)))
        AS touches
      FROM members m
    ),
    open_counts AS (
      SELECT m.user_id, count(l.id) AS open_count
      FROM members m
      LEFT JOIN public.leads l
        ON l.assigned_user_id = m.user_id AND l.client_id = v_client
        AND l.status NOT IN ('Won', 'Lost')
      GROUP BY m.user_id
    ),
    resp AS (
      SELECT m.user_id,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY d.delay_secs) AS median_secs
      FROM members m
      JOIN public.lead_assignment_events e
        ON e.client_id = v_client AND e.to_user_id = m.user_id AND e.created_at >= v_window
      JOIN LATERAL (
        SELECT extract(epoch FROM (min(t.ts) - e.created_at)) AS delay_secs
        FROM (
          SELECT c.created_at AS ts
          FROM public.conversations c
          JOIN public.leads lc ON lc.id = c.lead_id
          WHERE c.lead_id = e.lead_id AND c.sender = 'agent' AND c.created_at > e.created_at
            AND (c.sender_id = e.to_user_id OR (c.sender_id IS NULL AND lc.assigned_user_id = e.to_user_id))
          UNION ALL
          SELECT n.created_at FROM public.lead_notes n
          WHERE n.lead_id = e.lead_id AND n.created_by = e.to_user_id AND n.created_at > e.created_at
          UNION ALL
          SELECT a.created_at FROM public.appointments a
          WHERE a.lead_id = e.lead_id AND a.created_by = e.to_user_id AND a.created_at > e.created_at
        ) t
        HAVING min(t.ts) IS NOT NULL
      ) d ON true
      GROUP BY m.user_id
    ),
    team AS (
      SELECT CASE WHEN sum(a.assigned_count) > 0
        THEN sum(COALESCE(wn.won_count, 0))::numeric / sum(a.assigned_count)
        ELSE 0 END AS rate
      FROM assigned a
      LEFT JOIN won wn USING (user_id)
    ),
    raw AS (
      SELECT m.user_id, m.joined_at,
        COALESCE(a.assigned_count, 0) AS assigned_count,
        COALESCE(wn.won_count, 0) AS won_count,
        (COALESCE(wn.won_count, 0) + (SELECT rate FROM team) * 5)
          / (COALESCE(a.assigned_count, 0) + 5) AS conv_smoothed,
        COALESCE(tc.touches, 0) AS touches,
        COALESCE(o.open_count, 0) AS open_count,
        COALESCE(tc.touches, 0)::numeric / greatest(COALESCE(o.open_count, 0), 1) AS hustle_raw,
        r.median_secs
      FROM members m
      LEFT JOIN assigned a USING (user_id)
      LEFT JOIN won wn USING (user_id)
      LEFT JOIN touch_counts tc USING (user_id)
      LEFT JOIN open_counts o USING (user_id)
      LEFT JOIN resp r USING (user_id)
    ),
    norm AS (
      SELECT raw.*,
        CASE WHEN max(conv_smoothed) OVER () = min(conv_smoothed) OVER () THEN 50
             ELSE (conv_smoothed - min(conv_smoothed) OVER ())
                  / (max(conv_smoothed) OVER () - min(conv_smoothed) OVER ()) * 100 END AS conv_score,
        CASE WHEN max(hustle_raw) OVER () = min(hustle_raw) OVER () THEN 50
             ELSE (hustle_raw - min(hustle_raw) OVER ())
                  / (max(hustle_raw) OVER () - min(hustle_raw) OVER ()) * 100 END AS hustle_score,
        CASE WHEN median_secs IS NULL THEN 50
             WHEN max(median_secs) OVER () = min(median_secs) OVER () THEN 50
             ELSE (max(median_secs) OVER () - median_secs)
                  / (max(median_secs) OVER () - min(median_secs) OVER ()) * 100 END AS resp_score
      FROM raw
    )
    INSERT INTO public.agent_performance_scores AS s (
      client_id, user_id, window_days,
      assigned_count, won_count, conversion_smoothed,
      touches, open_leads, hustle_raw, median_response_seconds,
      conversion_score, hustle_score, responsiveness_score,
      composite_score, is_grace, computed_at
    )
    SELECT
      v_client, n.user_id, 90,
      n.assigned_count, n.won_count, round(n.conv_smoothed::numeric, 4),
      n.touches, n.open_count, round(n.hustle_raw::numeric, 4), n.median_secs,
      round(n.conv_score::numeric, 1), round(n.hustle_score::numeric, 1), round(n.resp_score::numeric, 1),
      round((0.40 * n.conv_score + 0.35 * n.hustle_score + 0.25 * n.resp_score)::numeric, 1),
      (n.assigned_count < 10 AND n.joined_at > now() - interval '14 days'),
      now()
    FROM norm n
    ON CONFLICT (client_id, user_id) DO UPDATE SET
      window_days = EXCLUDED.window_days,
      assigned_count = EXCLUDED.assigned_count,
      won_count = EXCLUDED.won_count,
      conversion_smoothed = EXCLUDED.conversion_smoothed,
      touches = EXCLUDED.touches,
      open_leads = EXCLUDED.open_leads,
      hustle_raw = EXCLUDED.hustle_raw,
      median_response_seconds = EXCLUDED.median_response_seconds,
      conversion_score = EXCLUDED.conversion_score,
      hustle_score = EXCLUDED.hustle_score,
      responsiveness_score = EXCLUDED.responsiveness_score,
      composite_score = EXCLUDED.composite_score,
      is_grace = EXCLUDED.is_grace,
      computed_at = EXCLUDED.computed_at;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;

    UPDATE public.agent_performance_scores s
      SET composite_score = COALESCE((
        SELECT round(avg(s2.composite_score)::numeric, 1)
        FROM public.agent_performance_scores s2
        WHERE s2.client_id = v_client AND NOT s2.is_grace
      ), 50)
      WHERE s.client_id = v_client AND s.is_grace;

    UPDATE public.agent_performance_scores
      SET weight = least(2.0, greatest(0.5, round((0.5 + composite_score / 100.0 * 1.5)::numeric, 2)))
      WHERE client_id = v_client;

    UPDATE public.lead_assignment_pool p
      SET weight = s.weight
      FROM public.agent_performance_scores s
      WHERE s.client_id = p.client_id AND s.user_id = p.user_id
        AND p.client_id = v_client;
  END LOOP;

  RETURN v_total;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_ai_credit(p_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan   text;
  v_limit  int;
  v_period date := date_trunc('month', now())::date;
  v_count  int;
BEGIN
  IF auth.uid() IS NOT NULL AND public.get_my_client_id() IS DISTINCT FROM p_client_id THEN
    RAISE EXCEPTION 'not allowed to consume credits for another client';
  END IF;

  SELECT plan INTO v_plan FROM public.clients WHERE id = p_client_id;
  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_client');
  END IF;

  SELECT ai_monthly INTO v_limit FROM public.plan_limits WHERE plan = v_plan;

  IF v_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'unlimited', true);
  END IF;

  INSERT INTO public.ai_usage (client_id, period_month, count, updated_at)
  VALUES (p_client_id, v_period, 1, now())
  ON CONFLICT (client_id, period_month)
  DO UPDATE SET count = ai_usage.count + 1, updated_at = now()
    WHERE ai_usage.count < v_limit
  RETURNING count INTO v_count;

  IF v_count IS NULL THEN
    SELECT count INTO v_count FROM public.ai_usage
      WHERE client_id = p_client_id AND period_month = v_period;
    RETURN jsonb_build_object('allowed', false, 'used', v_count, 'limit', v_limit, 'remaining', 0);
  END IF;

  RETURN jsonb_build_object(
    'allowed', true, 'used', v_count, 'limit', v_limit,
    'remaining', greatest(v_limit - v_count, 0)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cosine_distance(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$cosine_distance$function$
;

CREATE OR REPLACE FUNCTION public.cosine_distance(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_cosine_distance$function$
;

CREATE OR REPLACE FUNCTION public.cosine_distance(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_cosine_distance$function$
;

CREATE OR REPLACE FUNCTION public.create_fallback_task_on_unreachable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_name text;
  v_seq_name  text;
  v_title     text;
  v_should    boolean := false;
BEGIN
  IF NEW.state = 'waiting_window' AND OLD.state IS DISTINCT FROM 'waiting_window' THEN
    v_should := true;
    v_title  := 'Messenger window closed â€” reach lead another way';
  ELSIF NEW.state = 'paused' AND NEW.paused_reason = 'send_failed_fb_rejected'
        AND OLD.state IS DISTINCT FROM 'paused' THEN
    v_should := true;
    v_title  := 'Messenger undeliverable â€” try another channel';
  END IF;

  IF NOT v_should THEN
    RETURN NEW;
  END IF;

  -- Dedup: one open sequence-generated task per lead at a time
  IF EXISTS (
    SELECT 1 FROM tasks t
     WHERE t.lead_id = NEW.lead_id
       AND t.triggered_by = 'sequence_scheduler'
       AND t.status = 'pending'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_lead_name FROM leads WHERE id = NEW.lead_id;
  SELECT name INTO v_seq_name  FROM sequences WHERE id = NEW.sequence_id;

  INSERT INTO tasks (lead_id, client_id, title, task_type, notes, status, source, triggered_by, due_date)
  VALUES (
    NEW.lead_id, NEW.client_id,
    v_title || COALESCE(' (' || v_lead_name || ')', ''),
    're-engagement',
    'Auto-created by the "' || COALESCE(v_seq_name, 'follow-up') ||
      '" sequence: this lead could not be reached on Messenger (24h window closed or the send was rejected). Follow up by phone or another channel.',
    'pending', 'system', 'sequence_scheduler', CURRENT_DATE
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_client_id uuid, p_type text, p_title text, p_body text, p_data jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.notifications (user_id, client_id, type, title, body, data)
  values (p_user_id, p_client_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
$function$
;

CREATE OR REPLACE FUNCTION public.deactivate_pool_on_profile_deactivate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    UPDATE public.lead_assignment_pool
      SET is_active = false
      WHERE user_id = NEW.id AND is_active;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_lead_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan  text;
  v_limit int;
  v_count int;
BEGIN
  SELECT plan INTO v_plan FROM public.clients WHERE id = NEW.client_id;
  IF v_plan IS NULL THEN RETURN NEW; END IF;

  SELECT leads_total INTO v_limit FROM public.plan_limits WHERE plan = v_plan;
  IF v_limit IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count FROM public.leads WHERE client_id = NEW.client_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'lead_limit_reached: free plan allows % leads', v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_listing_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan  text;
  v_limit int;
  v_count int;
BEGIN
  SELECT plan INTO v_plan FROM public.clients WHERE id = NEW.client_id;
  IF v_plan IS NULL THEN RETURN NEW; END IF;

  SELECT listings_total INTO v_limit FROM public.plan_limits WHERE plan = v_plan;
  IF v_limit IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count FROM public.agent_listings WHERE client_id = NEW.client_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'listing_limit_reached: free plan allows % listings', v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_profile_field_locks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  my_role   text := public.get_my_role();
  my_client uuid := public.get_my_client_id();
BEGIN
  -- Service-role / backend contexts have no authenticated user.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- baymo_admin may change anything.
  IF my_role = 'baymo_admin' THEN
    RETURN NEW;
  END IF;

  -- Role changes.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NEW.id = auth.uid() THEN
      RAISE EXCEPTION 'You cannot change your own role';
    END IF;
    IF my_role <> 'client_admin' OR OLD.client_id IS DISTINCT FROM my_client THEN
      RAISE EXCEPTION 'Not permitted to change this user''s role';
    END IF;
    IF NEW.role NOT IN ('client_admin', 'manager', 'agent', 'viewer') THEN
      RAISE EXCEPTION 'Cannot assign role %', NEW.role;
    END IF;
  END IF;

  -- Client reassignment: baymo_admin only (already returned above).
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Not permitted to change client assignment';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_profile_personal_fields_owner_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_selfserve_campaign_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_role text := get_my_role();
BEGIN
  IF v_role IS NULL OR v_role = 'baymo_admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending_review') THEN
      RAISE EXCEPTION 'Only the BaMo team can activate an automation (submit it for review instead)';
    END IF;
    NEW.is_active := false;
  ELSE
    IF NEW.status = 'active' AND OLD.status <> 'active' THEN
      RAISE EXCEPTION 'Only the BaMo team can activate an automation';
    END IF;
    IF NEW.is_active AND NOT OLD.is_active THEN
      RAISE EXCEPTION 'Only the BaMo team can activate an automation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enroll_ai_followup_candidates()
 RETURNS TABLE(enrollment_id uuid, lead_id uuid, sequence_id uuid, client_id uuid)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  WITH candidates AS (
    SELECT DISTINCT ON (l.id)
           s.id AS sequence_id, l.id AS lead_id, l.client_id,
           l.last_inbound_at,
           COALESCE(
             (s.ai_settings->'followup_ladder_hours'->>0)::numeric,
             (s.ai_settings->>'first_follow_up_after_hours')::numeric,
             4
           ) AS first_delay_hours
    FROM sequences s
    JOIN campaigns c ON c.id = s.campaign_id
      AND c.status = 'active'
      AND c.conversational_ai_enabled = true
    JOIN leads l ON l.campaign_id = s.campaign_id
    WHERE s.mode = 'ai_adaptive'
      AND s.is_active = true
      AND l.messenger_id IS NOT NULL
      AND l.automation_enabled = true
      AND COALESCE(l.followup_opted_out, false) = false
      AND l.status NOT IN ('Won','Lost')
      AND (
        s.ai_settings->>'activated_at' IS NULL
        OR l.created_at >= (s.ai_settings->>'activated_at')::timestamptz
      )
      AND l.last_inbound_at IS NOT NULL
      AND l.last_inbound_at > now() - interval '24 hours'
      AND l.last_outbound_at IS NOT NULL
      AND l.last_outbound_at >= l.last_inbound_at
      AND l.last_inbound_at <= NOW() - (COALESCE(
            (s.ai_settings->'followup_ladder_hours'->>0)::numeric,
            (s.ai_settings->>'first_follow_up_after_hours')::numeric,
            4) * interval '1 hour')
      AND (SELECT count(*) FROM conversations cv WHERE cv.lead_id = l.id AND cv.direction = 'inbound')
            >= COALESCE((s.ai_settings->>'min_inbound_for_followup')::int, 0)
      AND (SELECT count(*) FROM conversations cv WHERE cv.lead_id = l.id AND cv.direction = 'inbound')
            < COALESCE((s.ai_settings->>'max_inbound_for_followup')::int, 4)
      AND NOT EXISTS (
        SELECT 1 FROM sequence_enrollments se2
        WHERE se2.lead_id = l.id AND se2.state IN ('active','waiting_window','paused')
      )
      AND (SELECT count(*) FROM sequence_enrollments se3
           WHERE se3.lead_id = l.id AND se3.sequence_id = s.id) < s.max_passes
      AND NOT EXISTS (
        SELECT 1 FROM sequence_enrollments se4
        WHERE se4.lead_id = l.id AND se4.sequence_id = s.id
          AND COALESCE(se4.completed_at, se4.enrolled_at) > NOW() - make_interval(days => s.reenroll_cooldown_days)
      )
  ),
  ins AS (
    INSERT INTO sequence_enrollments
      (lead_id, sequence_id, client_id, state, current_step, pass_number, touch_count, next_action_at, enrolled_at, started_at)
    SELECT cand.lead_id, cand.sequence_id, cand.client_id, 'active', 1,
           1 + (SELECT count(*) FROM sequence_enrollments se5
                WHERE se5.lead_id = cand.lead_id AND se5.sequence_id = cand.sequence_id),
           0,
           GREATEST(NOW(), cand.last_inbound_at + cand.first_delay_hours * interval '1 hour'),
           NOW(), NOW()
    FROM candidates cand
    ON CONFLICT (lead_id, sequence_id) WHERE state IN ('active','waiting_window','paused') DO NOTHING
    RETURNING id, lead_id, sequence_id, client_id
  )
  SELECT id, lead_id, sequence_id, client_id FROM ins;
$function$
;

CREATE OR REPLACE FUNCTION public.enroll_lead(p_lead_id uuid, p_is_new boolean DEFAULT false, p_source text DEFAULT NULL::text, p_attribution jsonb DEFAULT '{}'::jsonb, p_campaign_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead     leads%rowtype;
  v_camp     campaigns%rowtype;
  v_chosen   campaigns%rowtype;
  v_rules    jsonb;
  v_sources  jsonb;
  v_temp     text;
  v_threshold int;
  v_delay    int;
  v_next     timestamptz;
  v_by       text;
  v_found    boolean := false;
  v_attr_matched boolean;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('enrolled', false, 'reason', 'lead_not_found');
  END IF;

  IF p_force AND p_campaign_id IS NOT NULL THEN
    SELECT * INTO v_chosen FROM campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('enrolled', false, 'reason', 'campaign_not_found');
    END IF;
    v_by := 'manual';
    v_found := true;
  ELSE
    IF v_lead.automation_source = 'manual' AND v_lead.automation_enabled = false THEN
      RETURN jsonb_build_object('enrolled', false, 'reason', 'automation_opt_out');
    END IF;

    FOR v_camp IN
      SELECT * FROM campaigns
      WHERE client_id = v_lead.client_id
        AND status = 'active'
        AND is_active = true
      ORDER BY priority ASC NULLS LAST, created_at ASC
    LOOP
      v_rules := COALESCE(v_camp.enrollment_rules, '{}'::jsonb);
      v_attr_matched := false;

      v_sources := v_rules->'sources';
      IF v_sources IS NOT NULL AND jsonb_typeof(v_sources) = 'array'
         AND jsonb_array_length(v_sources) > 0 THEN
        IF p_source IS NULL OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(v_sources) s WHERE lower(s) = lower(p_source)
        ) THEN CONTINUE; END IF;
      END IF;

      IF NOT p_is_new THEN
        IF COALESCE((v_rules->>'new_leads_only')::boolean, true) THEN
          CONTINUE;
        END IF;
        v_threshold := COALESCE((v_rules->>'returning_lead_threshold_days')::int, 0);
        IF v_threshold > 0 AND v_lead.last_inbound_at IS NOT NULL
           AND v_lead.last_inbound_at > now() - make_interval(days => v_threshold) THEN
          CONTINUE;
        END IF;
      END IF;

      IF COALESCE((v_rules->>'skip_if_active_campaign')::boolean, false) THEN
        IF EXISTS (SELECT 1 FROM lead_campaign_states
                   WHERE lead_id = p_lead_id AND state IN ('active','paused')) THEN
          CONTINUE;
        END IF;
      END IF;

      v_temp := nullif(v_rules->>'lead_temperature', '');
      IF v_temp IS NOT NULL THEN
        IF v_lead.lead_temperature IS NULL OR lower(v_lead.lead_temperature) <> lower(v_temp) THEN
          CONTINUE;
        END IF;
      END IF;

      IF nullif(v_rules->>'fb_ad_id','') IS NOT NULL AND nullif(p_attribution->>'fb_ad_id','') IS NOT NULL THEN
        IF v_rules->>'fb_ad_id' <> p_attribution->>'fb_ad_id' THEN CONTINUE; END IF;
        v_attr_matched := true;
      END IF;
      IF nullif(v_rules->>'webform_id','') IS NOT NULL AND nullif(p_attribution->>'webform_id','') IS NOT NULL THEN
        IF v_rules->>'webform_id' <> p_attribution->>'webform_id' THEN CONTINUE; END IF;
        v_attr_matched := true;
      END IF;
      IF nullif(v_rules->>'sms_number','') IS NOT NULL AND nullif(p_attribution->>'sms_number','') IS NOT NULL THEN
        IF v_rules->>'sms_number' <> p_attribution->>'sms_number' THEN CONTINUE; END IF;
        v_attr_matched := true;
      END IF;
      IF nullif(v_rules->>'asset_id','') IS NOT NULL AND nullif(p_attribution->>'asset_id','') IS NOT NULL THEN
        IF v_rules->>'asset_id' <> p_attribution->>'asset_id' THEN CONTINUE; END IF;
        v_attr_matched := true;
      END IF;

      IF v_camp.automation_scope <> 'general'
         AND NOT COALESCE(v_camp.is_organic_owner, false)
         AND NOT v_attr_matched THEN
        CONTINUE;
      END IF;

      v_chosen := v_camp; v_by := 'auto'; v_found := true; EXIT;
    END LOOP;
  END IF;

  IF NOT v_found THEN
    RETURN jsonb_build_object('enrolled', false, 'reason', 'no_match');
  END IF;

  SELECT delay_hours INTO v_delay
  FROM campaign_steps
  WHERE campaign_id = v_chosen.id AND step_order = 1 AND is_active = true
  ORDER BY id LIMIT 1;
  v_next := now() + make_interval(hours => COALESCE(v_delay, 0));

  UPDATE lead_campaign_states
  SET state = 'stopped',
      paused_reason = COALESCE(paused_reason, 'Superseded by new enrollment'),
      updated_at = now()
  WHERE lead_id = p_lead_id AND campaign_id <> v_chosen.id AND state IN ('active','paused');

  INSERT INTO lead_campaign_states
    (lead_id, campaign_id, client_id, state, current_step, enrolled_at, next_step_at, metadata)
  VALUES
    (p_lead_id, v_chosen.id, v_lead.client_id, 'active', 1, now(), v_next,
     jsonb_build_object('enrolled_by', v_by))
  ON CONFLICT (lead_id, campaign_id) DO UPDATE
    SET state = 'active', current_step = 1, enrolled_at = now(), next_step_at = v_next,
        metadata = lead_campaign_states.metadata || jsonb_build_object('enrolled_by', v_by),
        updated_at = now();

  UPDATE leads
  SET campaign_id = v_chosen.id,
      automation_enabled = true,
      automation_source = CASE WHEN p_force THEN 'manual' ELSE automation_source END
  WHERE id = p_lead_id;

  RETURN jsonb_build_object('enrolled', true, 'campaign_id', v_chosen.id,
                            'campaign_name', v_chosen.name, 'enrolled_by', v_by);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.exit_active_ai_followup_on_inbound()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  WITH exited AS (
    UPDATE sequence_enrollments se
       SET state = 'exited', outcome = 'replied', completed_at = NOW(),
           send_lock = false, updated_at = NOW()
      FROM sequences s
     WHERE se.sequence_id = s.id
       AND s.mode = 'ai_adaptive'
       AND se.lead_id = NEW.lead_id
       AND se.state = 'active'
    RETURNING se.id AS enrollment_id, se.lead_id, se.client_id
  )
  INSERT INTO follow_up_decisions
    (enrollment_id, lead_id, client_id, decision, reason, goal_status, window_open)
  SELECT enrollment_id, lead_id, client_id,
         'answer_pending', 'lead replied â€” handed to live AI (W2)', 'progressing', true
    FROM exited;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.exit_waiting_enrollments_on_inbound()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE sequence_enrollments
     SET state = 'exited', outcome = 'window_reopened', completed_at = NOW(),
         send_lock = false, updated_at = NOW()
   WHERE lead_id = NEW.lead_id AND state = 'waiting_window';
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fetch_due_ai_followups(p_limit integer DEFAULT 25)
 RETURNS TABLE(enrollment_id uuid, lead_id uuid, client_id uuid, messenger_id text, fb_page_token text, context jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now_hm text := to_char(timezone('Asia/Manila', now()), 'HH24:MI');
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT se.id
    FROM sequence_enrollments se
    JOIN sequences s ON s.id = se.sequence_id AND s.mode='ai_adaptive' AND s.is_active=true
    JOIN campaigns c ON c.id = s.campaign_id
      AND c.status='active'
      AND c.conversational_ai_enabled = true
    JOIN leads l ON l.id = se.lead_id
    WHERE se.state='active' AND se.send_lock=false
      AND se.next_action_at IS NOT NULL AND se.next_action_at <= NOW()
      AND l.automation_enabled = true
      AND COALESCE(l.followup_opted_out,false) = false
      AND l.status NOT IN ('Won','Lost')
      AND CASE
            WHEN COALESCE(s.send_window_start,'08:00') <= COALESCE(s.send_window_end,'20:00')
              THEN v_now_hm >= COALESCE(s.send_window_start,'08:00') AND v_now_hm <= COALESCE(s.send_window_end,'20:00')
            ELSE v_now_hm >= COALESCE(s.send_window_start,'08:00') OR v_now_hm <= COALESCE(s.send_window_end,'20:00')
          END
    ORDER BY se.next_action_at ASC
    LIMIT p_limit
    FOR UPDATE OF se SKIP LOCKED
  ),
  locked AS (
    UPDATE sequence_enrollments se SET send_lock=true, updated_at=NOW()
    WHERE se.id IN (SELECT id FROM due)
    RETURNING se.*
  )
  SELECT
    en.id, en.lead_id, en.client_id, l.messenger_id, cl.fb_page_token,
    jsonb_build_object(
      'goal', COALESCE(s.ai_settings->>'goal','book_viewing'),
      'tone', COALESCE(s.ai_settings->>'tone','friendly'),
      'language', COALESCE(s.ai_settings->>'language','auto'),
      'custom_instructions', COALESCE(s.ai_settings->>'custom_instructions',''),
      'max_touches_per_pass', COALESCE((s.ai_settings->>'max_touches_per_pass')::int, 3),
      'escalate_after_touches', COALESCE((s.ai_settings->>'escalate_after_touches')::int, 3),
      'price_guard_terms', COALESCE(s.ai_settings->'price_guard_terms', '[]'::jsonb),
      'touch_count', en.touch_count,
      'pass_number', en.pass_number,
      'hours_since_inbound', ROUND(EXTRACT(EPOCH FROM (now() - l.last_inbound_at))/3600.0, 1),
      'window_open', (l.last_inbound_at IS NOT NULL AND l.last_inbound_at > now() - interval '24 hours'),
      'window_closing', (l.last_inbound_at IS NOT NULL AND l.last_inbound_at <= now() - interval '22 hours'),
      'client_name', cl.name,
      'lead', jsonb_build_object(
        'name', l.name, 'temperature', l.lead_temperature, 'status', l.status,
        'conversation_stage', l.conversation_stage, 'viewing_stage', l.viewing_stage,
        'last_question_asked', l.last_question_asked, 'questions_asked', l.questions_asked
      ),
      'campaign', jsonb_build_object(
        'target_action', c.target_action,
        'tone', c.tone,
        'campaign_type', COALESCE(c.campaign_type, 'buyer'),
        'ai_instruction', COALESCE(c.ai_instruction, ''),
        'additional_instructions', COALESCE(c.additional_instructions, '')
      ),
      'qualifications', to_jsonb(q.*),
      'memory', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('type', m.memory_type, 'label', m.memory_label, 'value', m.value_text)
                         ORDER BY m.importance_score DESC NULLS LAST)
        FROM lead_memory m WHERE m.lead_id = l.id AND m.is_active = true), '[]'::jsonb),
      'kb_knowledge', COALESCE((
        SELECT string_agg(kb.content, E'\n---\n')
        FROM campaign_knowledge_base kb
        WHERE kb.is_active = true AND COALESCE(kb.type,'knowledge') <> 'instruction'
          AND (kb.campaign_id = c.id OR (kb.scope = 'client' AND kb.client_id = l.client_id))), ''),
      'kb_instructions', COALESCE((
        SELECT string_agg(kb.content, E'\n')
        FROM campaign_knowledge_base kb
        WHERE kb.is_active = true AND kb.type = 'instruction'
          AND (kb.campaign_id = c.id OR (kb.scope = 'client' AND kb.client_id = l.client_id))), ''),
      'recent_messages', COALESCE((
        SELECT jsonb_agg(msg ORDER BY (msg->>'created_at') ASC) FROM (
          SELECT jsonb_build_object('direction', cv.direction, 'sender', cv.sender,
                                    'content', cv.message_content, 'created_at', cv.created_at) AS msg
          FROM conversations cv WHERE cv.lead_id = l.id
          ORDER BY cv.created_at DESC LIMIT 10
        ) t), '[]'::jsonb),
      'prior_decisions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('decision', d.decision, 'reason', d.reason, 'message', d.message_sent, 'at', d.created_at)
                         ORDER BY d.created_at ASC)
        FROM follow_up_decisions d WHERE d.enrollment_id = en.id), '[]'::jsonb)
    ) AS context
  FROM locked en
  JOIN sequences s ON s.id = en.sequence_id
  JOIN campaigns c ON c.id = s.campaign_id
  JOIN leads l ON l.id = en.lead_id
  JOIN clients cl ON cl.id = en.client_id
  LEFT JOIN lead_qualifications q ON q.lead_id = l.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_campaign_context(p_lead_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  v_lead_client_id uuid;
BEGIN
  -- Verify the lead belongs to the calling user's client
  SELECT client_id INTO v_lead_client_id
  FROM leads
  WHERE id = p_lead_id;

  IF v_lead_client_id IS NULL OR v_lead_client_id != get_my_client_id() THEN
    RAISE EXCEPTION 'Unauthorized: lead does not belong to authenticated user''s client';
  END IF;

  SELECT json_build_object(
    'campaign_id', c.id,
    'name', c.name,
    'target_action', c.target_action,
    'tone', c.tone,
    'additional_instructions', c.additional_instructions,
    'campaign_rules', c.campaign_rules,
    'conversational_ai_enabled', c.conversational_ai_enabled,
    'lead_ai_enabled', lcs.conversational_ai,
    'lead_state', lcs.state,
    'last_ai_decision', lcs.last_ai_decision,
    'knowledge_base', COALESCE(
      (
        SELECT json_agg(json_build_object('title', kb.title, 'content', kb.content))
        FROM campaign_knowledge_base kb
        WHERE kb.campaign_id = c.id AND kb.is_active = true
      ),
      '[]'::json
    )
  )
  INTO result
  FROM lead_campaign_states lcs
  JOIN campaigns c ON c.id = lcs.campaign_id
  WHERE lcs.lead_id = p_lead_id
    AND lcs.state = 'active'
  LIMIT 1;

  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_usage(p_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_month VARCHAR(7);
  v_usage RECORD;
BEGIN
  IF p_client_id != get_my_client_id() THEN
    RAISE EXCEPTION 'Unauthorized: client_id does not match authenticated user';
  END IF;

  v_current_month := TO_CHAR(NOW() AT TIME ZONE 'Asia/Manila', 'YYYY-MM');

  SELECT * INTO v_usage
  FROM ad_usage_limits
  WHERE client_id = p_client_id AND month = v_current_month;

  RETURN jsonb_build_object(
    'images_generated', COALESCE(v_usage.images_generated, 0),
    'videos_generated', COALESCE(v_usage.videos_generated, 0),
    'carousel_generated', COALESCE(v_usage.carousel_generated, 0),
    'month', v_current_month
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_leads_with_details(p_client_id uuid, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_status text DEFAULT NULL::text, p_stage text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_assigned_user_id uuid DEFAULT NULL::uuid, p_campaign_id uuid DEFAULT NULL::uuid, p_search text DEFAULT NULL::text, p_sort_by text DEFAULT 'created_at'::text, p_sort_dir text DEFAULT 'desc'::text, p_quality text DEFAULT NULL::text, p_lead_type text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, client_id uuid, campaign_id uuid, assigned_user_id uuid, name text, phone text, email text, company text, source text, source_override boolean, status text, lead_temperature text, lead_score integer, lead_quality text, lead_quality_source text, lead_quality_reason text, lead_quality_updated_at timestamp with time zone, budget_min numeric, budget_max numeric, preferred_location text, property_type text, bedrooms integer, lead_type text, next_follow_up_date date, last_contacted_at timestamp with time zone, last_inbound_at timestamp with time zone, metadata jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, agent_name text, agent_role text, campaign_name text, last_message text, next_task_title text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := get_my_role();
BEGIN
  IF v_role = 'baymo_admin' THEN
    NULL;
  ELSIF get_my_client_id() IS NOT NULL AND p_client_id = get_my_client_id() THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Unauthorized: client_id does not match authenticated user';
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.client_id, l.campaign_id, l.assigned_user_id,
    l.name, l.phone, l.email, l.company,
    l.source, l.source_override, l.status,
    l.lead_temperature, l.lead_score,
    l.lead_quality, l.lead_quality_source,
    l.lead_quality_reason, l.lead_quality_updated_at,
    lq.budget_min, lq.budget_max,
    lq.preferred_location[1], lq.property_type, lq.bedrooms,
    l.lead_type, l.next_follow_up_date, l.last_contacted_at,
    l.last_inbound_at,
    l.metadata, l.created_at, l.updated_at,
    p.full_name AS agent_name,
    p.role AS agent_role,
    c.name AS campaign_name,
    COALESCE(
      (SELECT cv.message_content FROM conversations cv
         WHERE cv.lead_id = l.id ORDER BY cv.created_at DESC LIMIT 1),
      'No messages'
    ) AS last_message,
    COALESCE(
      (SELECT tk.title FROM tasks tk
         WHERE tk.lead_id = l.id AND tk.status != 'completed'
         ORDER BY tk.due_date ASC LIMIT 1),
      'No pending tasks'
    ) AS next_task_title
  FROM leads l
  LEFT JOIN profiles p ON p.id = l.assigned_user_id
  LEFT JOIN campaigns c ON c.id = l.campaign_id
  LEFT JOIN lead_qualifications lq ON lq.lead_id = l.id
  WHERE l.client_id = p_client_id
    AND (v_role <> 'agent' OR l.assigned_user_id = auth.uid())
    AND (p_status IS NULL OR l.status = p_status)
    AND (p_stage IS NULL OR l.lead_temperature = p_stage)
    AND (p_quality IS NULL OR l.lead_quality = p_quality)
    AND (p_lead_type IS NULL OR l.lead_type = p_lead_type)
    AND (p_source IS NULL OR l.source = p_source)
    AND (p_assigned_user_id IS NULL OR l.assigned_user_id = p_assigned_user_id)
    AND (
      p_campaign_id IS NULL
      OR (p_campaign_id = '00000000-0000-0000-0000-000000000000' AND l.campaign_id IS NULL)
      OR l.campaign_id = p_campaign_id
    )
    AND (
      p_search IS NULL OR
      COALESCE(l.name, '') ILIKE '%' || p_search || '%' OR
      COALESCE(l.phone, '') ILIKE '%' || p_search || '%' OR
      COALESCE(l.email, '') ILIKE '%' || p_search || '%' OR
      COALESCE(l.company, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY
    CASE WHEN p_sort_by = 'last_inbound_at'   AND p_sort_dir = 'asc'  THEN l.last_inbound_at   END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'last_inbound_at'   AND p_sort_dir = 'desc' THEN l.last_inbound_at   END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'last_contacted_at' AND p_sort_dir = 'asc'  THEN l.last_contacted_at END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'last_contacted_at' AND p_sort_dir = 'desc' THEN l.last_contacted_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'lead_score'        AND p_sort_dir = 'asc'  THEN l.lead_score        END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'lead_score'        AND p_sort_dir = 'desc' THEN l.lead_score        END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'created_at'        AND p_sort_dir = 'asc'  THEN l.created_at        END ASC  NULLS LAST,
    l.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_ad_account_status()
 RETURNS TABLE(ad_account_id text, ads_enabled boolean, ads_plan text, is_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.ad_account_id, c.ads_enabled, c.ads_plan, c.is_active
  from clients c
  where c.id = get_my_client_id();
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_ads_plan()
 RETURNS TABLE(ads_plan text, ads_plan_started_at timestamp with time zone, ads_enabled boolean, is_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.ads_plan, c.ads_plan_started_at, c.ads_enabled, c.is_active
  from clients c
  where c.id = get_my_client_id();
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_assignment_feed(p_limit integer DEFAULT 30)
 RETURNS TABLE(id uuid, lead_id uuid, lead_name text, direction text, method text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    e.id,
    e.lead_id,
    l.name AS lead_name,
    CASE
      WHEN e.to_user_id = auth.uid() THEN 'assigned_to_me'
      ELSE 'reassigned_away'
    END AS direction,
    e.method,
    e.created_at
  FROM public.lead_assignment_events e
  LEFT JOIN public.leads l ON l.id = e.lead_id
  WHERE auth.uid() IS NOT NULL
    AND (e.to_user_id = auth.uid() OR e.from_user_id = auth.uid())
    AND e.to_user_id IS DISTINCT FROM e.from_user_id
  ORDER BY e.created_at DESC
  LIMIT least(coalesce(p_limit, 30), 100);
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_assignment_settings()
 RETURNS TABLE(assignment_mode text, assignment_sources text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.assignment_mode, c.assignment_sources
  FROM public.clients c
  WHERE c.id = public.get_my_client_id();
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_client_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_fb_page_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.fb_page_id
  FROM public.clients c
  WHERE c.id = public.get_my_client_id();
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_social_pages()
 RETURNS TABLE(platform text, account_name text, is_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.platform, s.account_name, s.is_active
  from ad_social_accounts s
  where s.client_id = get_my_client_id();
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_team_members()
 RETURNS TABLE(id uuid, full_name text, role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.role
    FROM public.profiles p
   WHERE p.client_id = get_my_client_id()
     AND p.client_id IS NOT NULL
     AND p.is_active IS TRUE
   ORDER BY p.full_name;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_usage()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client         uuid := public.get_my_client_id();
  v_plan           text;
  v_ai_limit       int;
  v_leads_limit    int;
  v_listings_limit int;
  v_ai_used        int;
  v_leads_used     int;
  v_listings_used  int;
  v_period         date := date_trunc('month', now())::date;
BEGIN
  IF v_client IS NULL THEN
    RETURN jsonb_build_object('plan', NULL);
  END IF;

  SELECT plan INTO v_plan FROM public.clients WHERE id = v_client;
  SELECT ai_monthly, leads_total, listings_total
    INTO v_ai_limit, v_leads_limit, v_listings_limit
    FROM public.plan_limits WHERE plan = v_plan;

  SELECT coalesce(ai_usage.count, 0) INTO v_ai_used
    FROM public.ai_usage WHERE client_id = v_client AND period_month = v_period;
  v_ai_used := coalesce(v_ai_used, 0);

  SELECT count(*) INTO v_leads_used FROM public.leads WHERE client_id = v_client;
  SELECT count(*) INTO v_listings_used FROM public.agent_listings WHERE client_id = v_client;

  RETURN jsonb_build_object(
    'plan', v_plan,
    'ai',       jsonb_build_object('used', v_ai_used,       'limit', v_ai_limit),
    'leads',    jsonb_build_object('used', v_leads_used,    'limit', v_leads_limit),
    'listings', jsonb_build_object('used', v_listings_used, 'limit', v_listings_limit)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_workspace_name()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.name from clients c where c.id = get_my_client_id();
$function$
;

CREATE OR REPLACE FUNCTION public.guard_profile_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- Service role / GoTrue signup: no JWT user. handle_new_user runs here.
  if auth.uid() is null then
    return new;
  end if;

  -- A user materialising their own row is harmless; the primary key already
  -- prevents duplicating an existing one.
  if new.id = auth.uid() then
    return new;
  end if;

  if public.get_my_role() = 'baymo_admin' then
    return new;
  end if;

  raise exception 'Only BaMo admins can create profile rows for other accounts';
end
$function$
;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_cols()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_role text;
begin
  -- No JWT user = service role / internal jobs (provisioning etc.) â€” bypass.
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
$function$
;

CREATE OR REPLACE FUNCTION public.halfvec(halfvec, integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_accum(double precision[], halfvec)
 RETURNS double precision[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_accum$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_add(halfvec, halfvec)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_add$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_avg(double precision[])
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_avg$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_cmp(halfvec, halfvec)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_cmp$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_combine(double precision[], double precision[])
 RETURNS double precision[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_combine$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_concat(halfvec, halfvec)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_concat$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_eq(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_eq$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_ge(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_ge$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_gt(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_gt$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_in(cstring, oid, integer)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_in$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_l2_squared_distance(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_l2_squared_distance$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_le(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_le$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_lt(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_lt$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_mul(halfvec, halfvec)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_mul$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_ne(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_ne$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_negative_inner_product(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_negative_inner_product$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_out(halfvec)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_out$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_recv(internal, oid, integer)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_recv$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_send(halfvec)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_send$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_spherical_distance(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_spherical_distance$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_sub(halfvec, halfvec)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_sub$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_to_float4(halfvec, integer, boolean)
 RETURNS real[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_to_float4$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_to_sparsevec(halfvec, integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_to_sparsevec$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_to_vector(halfvec, integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_to_vector$function$
;

CREATE OR REPLACE FUNCTION public.halfvec_typmod_in(cstring[])
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_typmod_in$function$
;

CREATE OR REPLACE FUNCTION public.hamming_distance(bit, bit)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$hamming_distance$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE
      -- raw_user_meta_data is attacker-controlled at the public signUp
      -- endpoint. Only non-privileged roles may be self-assigned.
      WHEN NEW.raw_user_meta_data->>'role' IN ('agent', 'viewer')
        THEN NEW.raw_user_meta_data->>'role'
      ELSE 'agent'
    END,
    true,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.hnsw_bit_support(internal)
 RETURNS internal
 LANGUAGE c
AS '$libdir/vector', $function$hnsw_bit_support$function$
;

CREATE OR REPLACE FUNCTION public.hnsw_halfvec_support(internal)
 RETURNS internal
 LANGUAGE c
AS '$libdir/vector', $function$hnsw_halfvec_support$function$
;

CREATE OR REPLACE FUNCTION public.hnsw_sparsevec_support(internal)
 RETURNS internal
 LANGUAGE c
AS '$libdir/vector', $function$hnsw_sparsevec_support$function$
;

CREATE OR REPLACE FUNCTION public.hnswhandler(internal)
 RETURNS index_am_handler
 LANGUAGE c
AS '$libdir/vector', $function$hnswhandler$function$
;

CREATE OR REPLACE FUNCTION public.increment_creative_usage(p_client_id uuid, p_creative_type character varying)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_month VARCHAR(7);
BEGIN
  IF p_client_id != get_my_client_id() THEN
    RAISE EXCEPTION 'Unauthorized: client_id does not match authenticated user';
  END IF;

  v_current_month := TO_CHAR(NOW() AT TIME ZONE 'Asia/Manila', 'YYYY-MM');

  UPDATE ad_usage_limits
  SET
    images_generated   = CASE WHEN p_creative_type = 'image'    THEN images_generated + 1   ELSE images_generated   END,
    videos_generated   = CASE WHEN p_creative_type = 'video'    THEN videos_generated + 1   ELSE videos_generated   END,
    carousel_generated = CASE WHEN p_creative_type = 'carousel' THEN carousel_generated + 1 ELSE carousel_generated END
  WHERE client_id = p_client_id AND month = v_current_month;

  IF NOT FOUND THEN
    INSERT INTO ad_usage_limits (client_id, month, images_generated, videos_generated, carousel_generated)
    VALUES (
      p_client_id,
      v_current_month,
      CASE WHEN p_creative_type = 'image'    THEN 1 ELSE 0 END,
      CASE WHEN p_creative_type = 'video'    THEN 1 ELSE 0 END,
      CASE WHEN p_creative_type = 'carousel' THEN 1 ELSE 0 END
    );
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_lead_unread_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.direction = 'inbound' THEN
    UPDATE public.leads
    SET unread_count = unread_count + 1
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.inner_product(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$inner_product$function$
;

CREATE OR REPLACE FUNCTION public.inner_product(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_inner_product$function$
;

CREATE OR REPLACE FUNCTION public.inner_product(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_inner_product$function$
;

CREATE OR REPLACE FUNCTION public.ivfflat_bit_support(internal)
 RETURNS internal
 LANGUAGE c
AS '$libdir/vector', $function$ivfflat_bit_support$function$
;

CREATE OR REPLACE FUNCTION public.ivfflat_halfvec_support(internal)
 RETURNS internal
 LANGUAGE c
AS '$libdir/vector', $function$ivfflat_halfvec_support$function$
;

CREATE OR REPLACE FUNCTION public.ivfflathandler(internal)
 RETURNS index_am_handler
 LANGUAGE c
AS '$libdir/vector', $function$ivfflathandler$function$
;

CREATE OR REPLACE FUNCTION public.jaccard_distance(bit, bit)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$jaccard_distance$function$
;

CREATE OR REPLACE FUNCTION public.l1_distance(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$l1_distance$function$
;

CREATE OR REPLACE FUNCTION public.l1_distance(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_l1_distance$function$
;

CREATE OR REPLACE FUNCTION public.l1_distance(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_l1_distance$function$
;

CREATE OR REPLACE FUNCTION public.l2_distance(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$l2_distance$function$
;

CREATE OR REPLACE FUNCTION public.l2_distance(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_l2_distance$function$
;

CREATE OR REPLACE FUNCTION public.l2_distance(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_l2_distance$function$
;

CREATE OR REPLACE FUNCTION public.l2_norm(halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_l2_norm$function$
;

CREATE OR REPLACE FUNCTION public.l2_norm(sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_l2_norm$function$
;

CREATE OR REPLACE FUNCTION public.l2_normalize(vector)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$l2_normalize$function$
;

CREATE OR REPLACE FUNCTION public.l2_normalize(halfvec)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_l2_normalize$function$
;

CREATE OR REPLACE FUNCTION public.l2_normalize(sparsevec)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_l2_normalize$function$
;

CREATE OR REPLACE FUNCTION public.lead_assigned_to_me(p_lead_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.leads
    WHERE id = p_lead_id AND assigned_user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.lead_grade_has_answer(v text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select v is not null
     and btrim(v) <> ''
     and lower(btrim(v)) not in ('null', 'none', 'unknown', 'n/a', 'na', 'tbd');
$function$
;

CREATE OR REPLACE FUNCTION public.log_lead_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_method text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_user_id IS NULL THEN
      RETURN NEW;
    END IF;
    v_method := NULLIF(current_setting('bamo.am_' || replace(NEW.id::text, '-', ''), true), '');
    IF v_method IS NULL THEN
      v_method := CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'manual' END;
    END IF;
    INSERT INTO public.lead_assignment_events (lead_id, client_id, from_user_id, to_user_id, method, actor_id)
    VALUES (NEW.id, NEW.client_id, NULL, NEW.assigned_user_id, v_method, auth.uid());
  ELSE
    IF NEW.assigned_user_id IS NOT DISTINCT FROM OLD.assigned_user_id THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.lead_assignment_events (lead_id, client_id, from_user_id, to_user_id, method, actor_id)
    VALUES (
      NEW.id, NEW.client_id, OLD.assigned_user_id, NEW.assigned_user_id,
      CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'manual' END,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_lead_temperature_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.lead_temperature is not null then
      insert into lead_temperature_events (lead_id, client_id, from_temperature, to_temperature)
      values (new.id, new.client_id, null, new.lead_temperature);
    end if;
  elsif new.lead_temperature is distinct from old.lead_temperature
        and new.lead_temperature is not null then
    insert into lead_temperature_events (lead_id, client_id, from_temperature, to_temperature)
    values (new.id, new.client_id, old.lead_temperature, new.lead_temperature);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector, match_campaign_id uuid, match_threshold double precision DEFAULT 0.75, match_count integer DEFAULT 5)
 RETURNS TABLE(id uuid, content text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT id, content, 1 - (embedding <=> query_embedding) AS similarity
  FROM kb_chunks
  WHERE campaign_id = match_campaign_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$function$
;

CREATE OR REPLACE FUNCTION public.match_kb_chunks(query_embedding vector, match_campaign_id uuid, match_count integer DEFAULT 5)
 RETURNS TABLE(id uuid, document_id uuid, chunk_index integer, content text, token_count integer, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    kc.id,
    kc.document_id,
    kc.chunk_index,
    kc.content,
    kc.token_count,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM kb_chunks kc
  WHERE kc.campaign_id = match_campaign_id
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_and_guard_lead_temperature()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.lead_temperature IS NOT NULL THEN
    NEW.lead_temperature = initcap(NEW.lead_temperature);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_lead_quality()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.lead_quality := initcap(NEW.lead_quality);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_appointment_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_assignee uuid; v_kind text := case when new.appointment_type = 'viewing' then 'viewing' else 'call' end;
begin
  if new.lead_id is null then return new; end if;
  select assigned_user_id into v_assignee from public.leads where id = new.lead_id;
  if v_assignee is null or v_assignee = new.created_by then return new; end if;
  perform public.create_notification(v_assignee, new.client_id, 'appointment_booked',
    'New ' || v_kind || ' scheduled',
    coalesce(new.contact_name, 'A ' || v_kind) || ' on ' ||
      to_char(new.scheduled_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM'),
    jsonb_build_object('appointment_id', new.id, 'lead_id', new.lead_id, 'route', '/(tabs)/calendar'));
  return new;
exception when others then return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.notify_automation_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  IF NEW.status <> 'pending_review'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'pending_review') THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(p.full_name, p.email, 'A client') INTO v_name
  FROM public.profiles p WHERE p.id = NEW.created_by;

  INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
  SELECT p.id, NEW.client_id, 'automation_submitted',
         coalesce(v_name, 'A client') || ' submitted an automation for review',
         NEW.name,
         jsonb_build_object('campaign_id', NEW.id, 'client_id', NEW.client_id,
                            'automation_scope', NEW.automation_scope)
  FROM public.profiles p
  WHERE p.role = 'baymo_admin' AND coalesce(p.is_active, true);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_followup_activated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign campaigns%rowtype;
BEGIN
  IF NEW.mode <> 'ai_adaptive' OR NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT (NEW.is_active AND NOT COALESCE(OLD.is_active, false)) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_campaign FROM campaigns WHERE id = NEW.campaign_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- close out the client's pending ask, if any
  UPDATE followup_requests
     SET status = 'active', decided_at = now(), updated_at = now()
   WHERE campaign_id = NEW.campaign_id AND status = 'pending';

  INSERT INTO notifications (user_id, client_id, type, title, body, data)
  SELECT p.id, v_campaign.client_id, 'followup_activated',
         'Auto follow-up is now on for ' || v_campaign.name,
         'BayMo will now follow up with leads on this campaign who go quiet, and hand the conversation back the moment they reply. You can switch it off any time from Automations.',
         jsonb_build_object('campaign_id', v_campaign.id, 'campaign_name', v_campaign.name, 'sequence_id', NEW.id)
  FROM profiles p
  WHERE COALESCE(p.is_active, true)
    AND p.client_id = v_campaign.client_id
    AND p.role IN ('client_admin','manager');

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_followup_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  SELECT coalesce(p.full_name, p.email, 'A client') INTO v_name
  FROM public.profiles p WHERE p.id = NEW.requested_by;

  INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
  SELECT p.id, NEW.client_id, 'followup_requested',
         v_name || ' wants Auto Follow-Up',
         initcap(NEW.style) || ' Â· ' || NEW.duration_days || ' days'
           || coalesce(' â€” ' || NEW.notes, ''),
         jsonb_build_object('request_id', NEW.id, 'client_id', NEW.client_id,
                            'style', NEW.style, 'duration_days', NEW.duration_days)
  FROM public.profiles p
  WHERE p.role = 'baymo_admin' AND coalesce(p.is_active, true);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_followup_request_rejected()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign_name text;
BEGIN
  IF NEW.status <> 'rejected' OR OLD.status = 'rejected' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_campaign_name FROM campaigns WHERE id = NEW.campaign_id;

  INSERT INTO notifications (user_id, client_id, type, title, body, data)
  VALUES (
    NEW.requested_by, NEW.client_id, 'followup_request_rejected',
    'Auto follow-up request needs a change'
      || COALESCE(' â€” ' || v_campaign_name, ''),
    COALESCE(NULLIF(btrim(NEW.admin_notes), ''), 'The BaMo team will be in touch about this request.'),
    jsonb_build_object('campaign_id', NEW.campaign_id, 'request_id', NEW.id)
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_followup_resolved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('active','rejected') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
  VALUES (
    NEW.requested_by, NEW.client_id, 'followup_' || NEW.status,
    CASE WHEN NEW.status = 'active'
      THEN 'Auto Follow-Up is on â€” BayMo now follows up with quiet leads'
      ELSE 'Your Auto Follow-Up request needs attention' END,
    coalesce(NEW.admin_notes, ''),
    jsonb_build_object('request_id', NEW.id, 'status', NEW.status)
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_lead_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_name text := coalesce(new.name, 'a lead');
begin
  if new.assigned_user_id is not null
     and new.assigned_user_id is distinct from (case when tg_op = 'UPDATE' then old.assigned_user_id end) then
    perform public.create_notification(new.assigned_user_id, new.client_id, 'lead_assigned',
      'New lead assigned to you', v_name || ' was assigned to you.',
      jsonb_build_object('lead_id', new.id, 'route', '/lead/' || new.id));
  end if;
  if tg_op = 'UPDATE' and old.assigned_user_id is not null
     and old.assigned_user_id is distinct from new.assigned_user_id then
    perform public.create_notification(old.assigned_user_id, new.client_id, 'lead_reassigned_away',
      'Lead reassigned', v_name || ' was reassigned to someone else.',
      jsonb_build_object('lead_id', new.id, 'route', '/activity'));
  end if;
  return new;
exception when others then return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.notify_lead_temperature()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_type text; v_title text; v_name text := coalesce(new.name, 'A lead'); r uuid;
begin
  if new.lead_temperature not in ('Hot', 'Warm') then return new; end if;
  if tg_op = 'UPDATE' and old.lead_temperature is not distinct from new.lead_temperature then return new; end if;
  if new.lead_temperature = 'Hot' then v_type := 'lead_hot'; v_title := 'ðŸ”¥ Hot lead';
  else v_type := 'lead_warm'; v_title := 'Warm lead'; end if;
  if exists (select 1 from public.notifications
     where type = v_type and data->>'lead_id' = new.id::text and created_at > now() - interval '12 hours') then
    return new;
  end if;
  for r in select public.resolve_lead_recipients(new.client_id, new.assigned_user_id) loop
    perform public.create_notification(r, new.client_id, v_type, v_title,
      v_name || ' is now ' || new.lead_temperature || '.',
      jsonb_build_object('lead_id', new.id, 'route', '/lead/' || new.id));
  end loop;
  return new;
exception when others then return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.notify_n8n_kb_extraction()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.source_type IN ('document','website') AND NEW.review_status = 'pending'
     AND NEW.proposed_content IS NULL
     AND (
       TG_OP = 'INSERT'
       OR OLD.review_status IS DISTINCT FROM 'pending'
       OR OLD.source_type IS DISTINCT FROM NEW.source_type
       OR OLD.raw_document_path IS DISTINCT FROM NEW.raw_document_path
       OR OLD.source_url IS DISTINCT FROM NEW.source_url
     )
  THEN
    PERFORM net.http_post(
      url     := 'https://n8n-bahaymo.onrender.com/webhook/kb-extraction',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'kb_id',             NEW.id,
        'campaign_id',       NEW.campaign_id,
        'source_type',       NEW.source_type,
        'raw_document_path', NEW.raw_document_path,
        'source_url',        NEW.source_url
      )
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_n8n_kb_ingestion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- NOTE: no Authorization header. kb-ingestion runs with verify_jwt = true, so
  -- this call will 401 until a credential is supplied from Vault. That is
  -- deliberate: an unauthenticated call that fails loudly beats a plaintext key.
  PERFORM net.http_post(
    url     := 'https://zyfkjxepykwpfzmkxitb.supabase.co/functions/v1/kb-ingestion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body    := jsonb_build_object(
      'document_id', NEW.id,
      'campaign_id', NEW.campaign_id,
      'client_id',   NEW.client_id,
      'file_url',    NEW.file_url,
      'file_type',   NEW.file_type
    )
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_page_connection_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  SELECT coalesce(p.full_name, p.email, 'A client') INTO v_name
  FROM public.profiles p WHERE p.id = NEW.requested_by;

  INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
  SELECT p.id, NEW.client_id, 'page_connection_requested',
         v_name || ' wants to connect a Facebook Page',
         NEW.page_name || coalesce(' â€” ' || NEW.page_url, ''),
         jsonb_build_object('request_id', NEW.id, 'client_id', NEW.client_id,
                            'page_name', NEW.page_name, 'page_url', NEW.page_url)
  FROM public.profiles p
  WHERE p.role = 'baymo_admin' AND coalesce(p.is_active, true);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_page_connection_resolved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('connected','rejected') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
  VALUES (
    NEW.requested_by, NEW.client_id, 'page_connection_' || NEW.status,
    CASE WHEN NEW.status = 'connected'
      THEN NEW.page_name || ' is connected â€” BayMo can now receive its messages'
      ELSE 'Page connection for ' || NEW.page_name || ' needs attention' END,
    coalesce(NEW.admin_notes, ''),
    jsonb_build_object('request_id', NEW.id, 'status', NEW.status)
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_task_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), CASE WHEN tg_op = 'INSERT' THEN new.created_by END);
  v_lead_name text;
  v_body text;
BEGIN
  IF new.assigned_to IS NULL THEN
    RETURN new;
  END IF;
  IF tg_op = 'UPDATE' AND old.assigned_to IS NOT DISTINCT FROM new.assigned_to THEN
    RETURN new;
  END IF;
  IF new.assigned_to = v_actor THEN
    RETURN new;
  END IF;

  IF new.lead_id IS NOT NULL THEN
    SELECT name INTO v_lead_name FROM public.leads WHERE id = new.lead_id;
  END IF;
  v_body := new.title || COALESCE(' â€” ' || v_lead_name, '');

  PERFORM public.create_notification(
    new.assigned_to, new.client_id, 'task_assigned',
    'New task assigned to you',
    v_body,
    jsonb_build_object('task_id', new.id, 'lead_id', new.lead_id, 'route', '/tasks'));

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_tour_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.pause_automation_on_unqualified()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.automation_enabled := false;
  NEW.campaign_id := NULL;
  NEW.status_updated_at := now();
  IF NEW.status_source IS NULL THEN NEW.status_source := 'manual'; END IF;

  UPDATE lead_campaign_states
     SET state = 'stopped',
         paused_reason = COALESCE(paused_reason, 'Lead marked Unqualified'),
         updated_at = now()
   WHERE lead_id = NEW.id AND state IN ('active','paused');

  UPDATE sequence_enrollments
     SET state = 'exited', outcome = 'unqualified', completed_at = now(),
         send_lock = false, updated_at = now()
   WHERE lead_id = NEW.id AND state IN ('active','waiting_window','paused');

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pending_lead_alerts(p_limit integer DEFAULT 25)
 RETURNS TABLE(lead_id uuid, client_id uuid, alert_kind text, trigger_at timestamp with time zone, lead_name text, client_name text, agent_name text, to_emails text, temperature text, lead_status text, reason text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with candidate as (
    select l.id, l.client_id, l.name, l.phone, l.email, l.messenger_id,
           l.lead_temperature, l.status, l.assigned_user_id,
           (l.lead_temperature = 'Hot' and l.temperature_updated_at > now() - interval '24 hours') as is_hot,
           (l.status = 'Viewing' and l.status_updated_at > now() - interval '24 hours') as is_viewing,
           greatest(coalesce(l.temperature_updated_at,'epoch'::timestamptz),
                    coalesce(l.status_updated_at,'epoch'::timestamptz)) as ts
      from public.leads l
     where ((l.lead_temperature = 'Hot' and l.temperature_updated_at > now() - interval '24 hours')
         or (l.status = 'Viewing' and l.status_updated_at > now() - interval '24 hours'))
       and not exists (select 1 from public.lead_alert_emails a
                        where a.lead_id = l.id and a.created_at > now() - interval '7 days')
  )
  select c.id, c.client_id,
         case when c.is_hot and c.is_viewing then 'hot_viewing'
              when c.is_viewing then 'viewing' else 'hot' end,
         c.ts,
         -- lead_name: real name first; placeholder names fall through to phone/email/messenger id
         case
           when nullif(btrim(coalesce(c.name,'')),'') is not null
            and lower(btrim(c.name)) not in (
                  'messenger lead','messenger user','facebook user','facebook lead',
                  'fb user','fb lead','unknown','unknown user','a lead','lead',
                  'guest','n/a','na','none','null','test')
             then btrim(c.name)
           when length(regexp_replace(coalesce(c.phone,''), '[^0-9]', '', 'g')) >= 7
             then btrim(c.phone)
           when coalesce(c.email,'') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
             then btrim(c.email)
           when nullif(btrim(coalesce(c.messenger_id,'')),'') is not null
             then 'Messenger lead ' || right(btrim(c.messenger_id), 4)
           else 'A lead'
         end,
         cl.name, ap.full_name,
         coalesce(
           (select string_agg(distinct p.email, ',')
              from public.resolve_lead_recipients(c.client_id, c.assigned_user_id) r
              join public.profiles p on p.id = r
             where p.is_active and p.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
           nullif(case when cl.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then cl.email end,'')
         ),
         c.lead_temperature, c.status,
         case when c.is_hot and c.is_viewing then 'Lead is Hot and moved to Viewing'
              when c.is_viewing then 'Lead moved to Viewing' else 'Lead is now Hot' end
    from candidate c
    join public.clients cl on cl.id = c.client_id
    left join public.profiles ap on ap.id = c.assigned_user_id
   order by c.ts
   limit greatest(1, least(coalesce(p_limit,25),100));
$function$
;

CREATE OR REPLACE FUNCTION public.provision_client_from_web_onboarding()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         concat_ws(' Â· ',
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
$function$
;

CREATE OR REPLACE FUNCTION public.provision_workspace_on_submit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id       uuid;
  v_existing_client uuid;
  v_name            text;
BEGIN
  IF NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT client_id INTO v_existing_client FROM public.profiles WHERE id = NEW.profile_id;
  IF v_existing_client IS NOT NULL THEN
    UPDATE public.client_onboarding
      SET client_id = v_existing_client, status = 'approved', reviewed_at = now()
      WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  v_name := COALESCE(
    NULLIF(btrim(NEW.company_name), ''),
    NULLIF(btrim(NEW.full_name), ''),
    'My Workspace'
  );

  INSERT INTO public.clients (name, company_name, email, phone, business_type, plan, is_active)
  VALUES (v_name, NEW.company_name, NEW.email, NEW.phone, NEW.business_type, 'free', true)
  RETURNING id INTO v_client_id;

  UPDATE public.profiles SET client_id = v_client_id WHERE id = NEW.profile_id;

  UPDATE public.client_onboarding
    SET client_id = v_client_id, status = 'approved', reviewed_at = now()
    WHERE id = NEW.id;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reassign_task(p_task_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task record;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task not found';
  END IF;

  IF NOT (
    get_my_role() = 'baymo_admin'
    OR (v_task.client_id = get_my_client_id()
        AND (get_my_role() <> 'agent'
             OR lead_assigned_to_me(v_task.lead_id)
             OR v_task.assigned_to = auth.uid()
             OR v_task.created_by = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
     WHERE id = p_user_id AND client_id = v_task.client_id AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'assignee is not an active member of this workspace';
  END IF;

  UPDATE tasks SET assigned_to = p_user_id, updated_at = now() WHERE id = p_task_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_lead_grade(p_lead_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
begin
  with calc as (
    select
      l.id,
      lead_grade_has_answer(l.phone) as has_phone,
      lead_grade_has_answer(l.email) as has_email,
      (lq.budget_min is not null or lq.budget_max is not null) as has_budget,
      (lead_grade_has_answer(coalesce(lq.timeframe, l.timeframe))
        or lead_grade_has_answer(lq.move_in_date)) as has_timeline,
      lead_grade_has_answer(coalesce(lq.motivation, l.motivation)) as has_motivation,
      lead_grade_has_answer(lq.purpose) as has_purpose,
      lead_grade_has_answer(lq.preferred_financing) as has_financing,
      lead_grade_has_answer(lq.payment_scheme) as has_payment_scheme,
      lead_grade_has_answer(lq.income_source) as has_income_source,
      lead_grade_has_answer(lq.property_type) as has_property_type,
      (lead_grade_has_answer(lq.property_sub_type)
        or lead_grade_has_answer(lq.unit_preferred)) as has_unit_type,
      (lq.bedrooms is not null or lq.floor_area_min is not null
        or lq.lot_area_min is not null) as has_size,
      (coalesce(array_length(lq.preferred_location, 1), 0) > 0) as has_pref_location,
      lead_grade_has_answer(l.current_location) as has_current_location,
      lead_grade_has_answer(lq.decision_maker) as has_decision_maker,
      lead_grade_has_answer(lq.hesitation) as has_hesitation,
      (coalesce(array_length(lq.competing_projects, 1), 0) > 0) as has_competing,
      lead_grade_has_answer(lq.viewing_schedule) as has_viewing,
      coalesce(ic.inbound_ct, 0) as inbound_ct,
      l.last_inbound_at
    from leads l
    left join lead_qualifications lq on lq.lead_id = l.id
    left join lateral (
      select count(*) as inbound_ct
      from conversations c
      where c.lead_id = l.id
        and (c.direction = 'inbound' or c.sender = 'lead')
    ) ic on true
    where p_lead_id is null or l.id = p_lead_id
  ),
  scored as (
    select id,
      (case when has_phone then 12 else 0 end
     + case when has_email then 8 else 0 end) as contact_pts,
      (case when has_budget then 8 else 0 end
     + case when has_timeline then 7 else 0 end
     + case when has_motivation then 4 else 0 end
     + case when has_purpose then 4 else 0 end
     + case when has_financing then 4 else 0 end
     + case when has_payment_scheme then 3 else 0 end
     + case when has_income_source then 3 else 0 end
     + case when has_property_type then 2 else 0 end
     + case when has_unit_type then 3 else 0 end
     + case when has_size then 2 else 0 end
     + case when has_pref_location then 3 else 0 end
     + case when has_current_location then 2 else 0 end
     + case when has_decision_maker then 2 else 0 end
     + case when has_hesitation then 1 else 0 end
     + case when has_competing then 1 else 0 end
     + case when has_viewing then 1 else 0 end) as qual_pts,
      (case
         when last_inbound_at is null
           or last_inbound_at < now() - interval '21 days' then 0
         else
           (case when inbound_ct > 8 then 20
                 when inbound_ct >= 3 then 12
                 else 5 end)
         + (case when last_inbound_at >= now() - interval '7 days' then 10 else 0 end)
       end) as eng_pts,
      -- ALL unanswered fields, highest weight first
      array_remove(array[
         case when not has_phone then 'phone' end,
         case when not has_budget then 'budget' end,
         case when not has_email then 'email' end,
         case when not has_timeline then 'timeframe' end,
         case when not has_motivation then 'motivation' end,
         case when not has_purpose then 'purpose' end,
         case when not has_financing then 'preferred_financing' end,
         case when not has_payment_scheme then 'payment_scheme' end,
         case when not has_income_source then 'income_source' end,
         case when not has_unit_type then 'unit_preferred' end,
         case when not has_pref_location then 'preferred_location' end,
         case when not has_property_type then 'property_type' end,
         case when not has_size then 'bedroom' end,
         case when not has_current_location then 'current_location' end,
         case when not has_decision_maker then 'decision_maker' end,
         case when not has_hesitation then 'hesitation' end,
         case when not has_competing then 'competing_projects' end,
         case when not has_viewing then 'viewing_schedule' end
       ], null) as missing_all
    from calc
  ),
  finalized as (
    select id,
      contact_pts + qual_pts + eng_pts as total,
      case
        when contact_pts + qual_pts + eng_pts >= 75 then 'A'
        when contact_pts + qual_pts + eng_pts >= 50 then 'B'
        when contact_pts + qual_pts + eng_pts >= 25 then 'C'
        else 'D'
      end as grade,
      jsonb_build_object(
        'contactability', contact_pts,
        'qualification', qual_pts,
        'engagement', eng_pts,
        'missing', to_jsonb(missing_all)
      ) as breakdown
    from scored
  )
  update leads l
  set lead_grade = f.grade,
      lead_grade_score = f.total,
      lead_grade_breakdown = f.breakdown,
      lead_grade_updated_at = now()
  from finalized f
  where l.id = f.id
    and (l.lead_grade_score is distinct from f.total
         or l.lead_grade_breakdown is distinct from f.breakdown);

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_my_performance_scores()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.get_my_role() NOT IN ('client_admin', 'baymo_admin') THEN
    RAISE EXCEPTION 'Only a client admin can recompute performance scores';
  END IF;
  IF public.get_my_client_id() IS NULL THEN
    RAISE EXCEPTION 'No client workspace found for this user';
  END IF;
  RETURN public.compute_agent_performance_scores(public.get_my_client_id());
END;
$function$
;

CREATE OR REPLACE FUNCTION public.request_followup_disable(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := get_my_role();
  v_client uuid := get_my_client_id();
  v_campaign campaigns%rowtype;
  v_seq_id uuid;
BEGIN
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'campaign_not_found');
  END IF;

  IF v_role IS DISTINCT FROM 'baymo_admin' AND v_campaign.client_id IS DISTINCT FROM v_client THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  UPDATE sequences
     SET is_active = false, updated_at = now()
   WHERE campaign_id = p_campaign_id AND mode = 'ai_adaptive'
  RETURNING id INTO v_seq_id;

  IF v_seq_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_off', true);
  END IF;

  -- resolve any pending enable request for this campaign; the client changed
  -- their mind before it was reviewed
  UPDATE followup_requests
     SET status = 'disabled', decided_at = now(), updated_at = now(),
         admin_notes = COALESCE(admin_notes, 'Withdrawn - client switched follow-up off')
   WHERE campaign_id = p_campaign_id AND status = 'pending';

  INSERT INTO followup_requests
    (client_id, requested_by, campaign_id, action, status, notes, decided_at, decided_by)
  VALUES
    (v_campaign.client_id, auth.uid(), p_campaign_id, 'disable', 'disabled',
     'Switched off from the mobile app', now(), auth.uid());

  RETURN jsonb_build_object('ok', true, 'sequence_id', v_seq_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_lead_recipients(p_client_id uuid, p_assigned uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_assigned where p_assigned is not null
  union
  select id from public.profiles
   where p_assigned is null and client_id = p_client_id and is_active is true
     and role in ('client_admin', 'manager');
$function$
;

CREATE OR REPLACE FUNCTION public.run_appointment_reminders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare rec record; v_kind text; v_where text;
begin
  for rec in select * from public.appointments
     where status = 'scheduled' and reminded_day_at is null
       and scheduled_at > now() + interval '1 hour'
       and scheduled_at <= now() + interval '24 hours'
       and scheduled_at - created_at >= interval '24 hours'
     for update skip locked loop
    v_kind := case when rec.appointment_type = 'viewing' then 'Viewing' else 'Phone appointment' end;
    v_where := case when rec.appointment_type = 'viewing' and rec.location is not null then ' at ' || rec.location else '' end;
    perform public.create_notification(rec.created_by, rec.client_id, 'appointment_reminder_day',
      v_kind || ' tomorrow',
      v_kind || ' with ' || coalesce(rec.contact_name, 'your contact') || ' ' ||
        to_char(rec.scheduled_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM') || v_where || '.',
      jsonb_build_object('appointment_id', rec.id, 'lead_id', rec.lead_id, 'route', '/(tabs)/calendar'));
    update public.appointments set reminded_day_at = now() where id = rec.id;
  end loop;
  for rec in select * from public.appointments
     where status = 'scheduled' and reminded_hour_at is null
       and scheduled_at > now() and scheduled_at <= now() + interval '1 hour'
     for update skip locked loop
    v_kind := case when rec.appointment_type = 'viewing' then 'Viewing' else 'Phone appointment' end;
    v_where := case when rec.appointment_type = 'viewing' and rec.location is not null then ' at ' || rec.location else '' end;
    perform public.create_notification(rec.created_by, rec.client_id, 'appointment_reminder_hour',
      v_kind || ' in 1 hour',
      v_kind || ' with ' || coalesce(rec.contact_name, 'your contact') || ' at ' ||
        to_char(rec.scheduled_at at time zone 'Asia/Manila', 'HH12:MI AM') || v_where || '.',
      jsonb_build_object('appointment_id', rec.id, 'lead_id', rec.lead_id, 'route', '/(tabs)/calendar'));
    update public.appointments set reminded_hour_at = now() where id = rec.id;
  end loop;
end; $function$
;

CREATE OR REPLACE FUNCTION public.run_deferred_task_sweep()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.tasks
     SET status = 'pending',
         due_date = deferred_until,
         updated_at = now()
   WHERE status = 'deferred'
     AND deferred_until IS NOT NULL
     AND deferred_until <= (now() AT TIME ZONE 'Asia/Manila')::date;
$function$
;

CREATE OR REPLACE FUNCTION public.set_campaign_priority_from_scope()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.automation_scope IN ('listing','project')
     AND (NEW.priority IS NULL OR NEW.priority = 10) THEN
    NEW.priority := CASE NEW.automation_scope WHEN 'listing' THEN 1 ELSE 2 END;
  ELSIF NEW.priority IS NULL THEN
    NEW.priority := 10;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_my_assignment_settings(p_mode text, p_sources text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.get_my_role() <> 'client_admin' THEN
    RAISE EXCEPTION 'Only a client admin can change assignment settings';
  END IF;
  IF p_mode NOT IN ('manual', 'round_robin', 'performance') THEN
    RAISE EXCEPTION 'Invalid assignment mode %', p_mode;
  END IF;

  UPDATE public.clients
    SET assignment_mode = p_mode,
        assignment_sources = p_sources
    WHERE id = public.get_my_client_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No client workspace found for this user';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_task_client_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.client_id IS NULL THEN
    NEW.client_id := get_my_client_id();
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec(sparsevec, integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_cmp(sparsevec, sparsevec)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_cmp$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_eq(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_eq$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_ge(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_ge$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_gt(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_gt$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_in(cstring, oid, integer)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_in$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_l2_squared_distance(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_l2_squared_distance$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_le(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_le$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_lt(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_lt$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_ne(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_ne$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_negative_inner_product(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_negative_inner_product$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_out(sparsevec)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_out$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_recv(internal, oid, integer)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_recv$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_send(sparsevec)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_send$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_to_halfvec(sparsevec, integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_to_halfvec$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_to_vector(sparsevec, integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_to_vector$function$
;

CREATE OR REPLACE FUNCTION public.sparsevec_typmod_in(cstring[])
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_typmod_in$function$
;

CREATE OR REPLACE FUNCTION public.subvector(vector, integer, integer)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$subvector$function$
;

CREATE OR REPLACE FUNCTION public.subvector(halfvec, integer, integer)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_subvector$function$
;

CREATE OR REPLACE FUNCTION public.sync_campaign_lead_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO campaign_lead_assignments (campaign_id, lead_id, client_id, assigned_at, sequence_step, status)
    VALUES (NEW.campaign_id, NEW.lead_id, NEW.client_id, NEW.enrolled_at, NEW.current_step, 'active')
    ON CONFLICT DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE campaign_lead_assignments
    SET 
      status = CASE 
        WHEN NEW.state = 'active' THEN 'active'
        WHEN NEW.state = 'paused' THEN 'paused'
        WHEN NEW.state IN ('completed', 'stopped') THEN 'completed'
        ELSE 'active'
      END,
      sequence_step = NEW.current_step
    WHERE lead_id = NEW.lead_id AND campaign_id = NEW.campaign_id;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_ckb_campaign_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'campaign_knowledge_base' THEN
    SELECT name INTO NEW.campaign_name
    FROM campaigns WHERE id = NEW.campaign_id;
  ELSIF TG_TABLE_NAME = 'campaigns' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      UPDATE campaign_knowledge_base
      SET campaign_name = NEW.name
      WHERE campaign_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_lead_grade_from_conversations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.lead_id is not null
     and (new.direction = 'inbound' or new.sender = 'lead') then
    perform recompute_lead_grade(new.lead_id);
  end if;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_lead_grade_from_leads()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform recompute_lead_grade(new.id);
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_lead_grade_from_qualifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform recompute_lead_grade(coalesce(new.lead_id, old.lead_id));
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.unenroll_lead_on_automation_off()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE lead_campaign_states
    SET state = 'stopped',
        paused_reason = COALESCE(paused_reason, 'AI disabled by agent'),
        updated_at = now()
  WHERE lead_id = NEW.id AND state IN ('active','paused');
  UPDATE sequence_enrollments
    SET state = 'exited', outcome = 'automation_disabled', completed_at = now(),
        send_lock = false, updated_at = now()
  WHERE lead_id = NEW.id AND state IN ('active','waiting_window','paused');
  NEW.campaign_id := NULL;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_lead_last_message_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.leads
  SET last_message_at     = NEW.created_at,
      last_inbound_at     = CASE WHEN NEW.direction = 'inbound'
                              THEN GREATEST(last_inbound_at, NEW.created_at)
                              ELSE last_inbound_at END,
      last_outbound_at    = CASE WHEN NEW.direction = 'outbound'
                              THEN GREATEST(last_outbound_at, NEW.created_at)
                              ELSE last_outbound_at END,
      last_contacted_at   = CASE WHEN NEW.direction = 'outbound'
                              THEN GREATEST(last_contacted_at, NEW.created_at)
                              ELSE last_contacted_at END,
      last_ai_outbound_at = CASE WHEN NEW.direction = 'outbound' AND NEW.sender = 'ai'
                              THEN GREATEST(last_ai_outbound_at, NEW.created_at)
                              ELSE last_ai_outbound_at END
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_message_templates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_onboarding_tour_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null then
    new.profile_id := auth.uid();
    select p.client_id into new.client_id from public.profiles p where p.id = new.profile_id;
  end if;
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_assignment_pool_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p record;
BEGIN
  SELECT client_id, role INTO p FROM public.profiles WHERE id = NEW.user_id;
  IF p IS NULL THEN
    RAISE EXCEPTION 'Pool member % has no profile', NEW.user_id;
  END IF;
  IF p.client_id IS DISTINCT FROM NEW.client_id THEN
    RAISE EXCEPTION 'Pool member must belong to the same client';
  END IF;
  IF p.role = 'baymo_admin' THEN
    RAISE EXCEPTION 'baymo_admin cannot join an assignment pool';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.vector(vector, integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector$function$
;

CREATE OR REPLACE FUNCTION public.vector_accum(double precision[], vector)
 RETURNS double precision[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_accum$function$
;

CREATE OR REPLACE FUNCTION public.vector_add(vector, vector)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_add$function$
;

CREATE OR REPLACE FUNCTION public.vector_avg(double precision[])
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_avg$function$
;

CREATE OR REPLACE FUNCTION public.vector_cmp(vector, vector)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_cmp$function$
;

CREATE OR REPLACE FUNCTION public.vector_combine(double precision[], double precision[])
 RETURNS double precision[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_combine$function$
;

CREATE OR REPLACE FUNCTION public.vector_concat(vector, vector)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_concat$function$
;

CREATE OR REPLACE FUNCTION public.vector_dims(vector)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_dims$function$
;

CREATE OR REPLACE FUNCTION public.vector_dims(halfvec)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_vector_dims$function$
;

CREATE OR REPLACE FUNCTION public.vector_eq(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_eq$function$
;

CREATE OR REPLACE FUNCTION public.vector_ge(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_ge$function$
;

CREATE OR REPLACE FUNCTION public.vector_gt(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_gt$function$
;

CREATE OR REPLACE FUNCTION public.vector_in(cstring, oid, integer)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_in$function$
;

CREATE OR REPLACE FUNCTION public.vector_l2_squared_distance(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_l2_squared_distance$function$
;

CREATE OR REPLACE FUNCTION public.vector_le(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_le$function$
;

CREATE OR REPLACE FUNCTION public.vector_lt(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_lt$function$
;

CREATE OR REPLACE FUNCTION public.vector_mul(vector, vector)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_mul$function$
;

CREATE OR REPLACE FUNCTION public.vector_ne(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_ne$function$
;

CREATE OR REPLACE FUNCTION public.vector_negative_inner_product(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_negative_inner_product$function$
;

CREATE OR REPLACE FUNCTION public.vector_norm(vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_norm$function$
;

CREATE OR REPLACE FUNCTION public.vector_out(vector)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_out$function$
;

CREATE OR REPLACE FUNCTION public.vector_recv(internal, oid, integer)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_recv$function$
;

CREATE OR REPLACE FUNCTION public.vector_send(vector)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_send$function$
;

CREATE OR REPLACE FUNCTION public.vector_spherical_distance(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_spherical_distance$function$
;

CREATE OR REPLACE FUNCTION public.vector_sub(vector, vector)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_sub$function$
;

CREATE OR REPLACE FUNCTION public.vector_to_float4(vector, integer, boolean)
 RETURNS real[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_to_float4$function$
;

CREATE OR REPLACE FUNCTION public.vector_to_halfvec(vector, integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_to_halfvec$function$
;

CREATE OR REPLACE FUNCTION public.vector_to_sparsevec(vector, integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_to_sparsevec$function$
;

CREATE OR REPLACE FUNCTION public.vector_typmod_in(cstring[])
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_typmod_in$function$
;

-- ===== TRIGGERS =====
CREATE TRIGGER trg_ad_operator_tokens_updated_at BEFORE UPDATE ON public.ad_operator_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER enforce_listing_cap BEFORE INSERT ON public.agent_listings FOR EACH ROW EXECUTE FUNCTION enforce_listing_cap();
CREATE TRIGGER trg_notify_appointment_created AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION notify_appointment_created();
CREATE TRIGGER trg_ckb_sync_campaign_name BEFORE INSERT OR UPDATE OF campaign_id ON public.campaign_knowledge_base FOR EACH ROW EXECUTE FUNCTION sync_ckb_campaign_name();
CREATE TRIGGER trg_kb_extraction_n8n AFTER INSERT OR UPDATE ON public.campaign_knowledge_base FOR EACH ROW EXECUTE FUNCTION notify_n8n_kb_extraction();
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_campaign_priority_from_scope BEFORE INSERT ON public.campaigns FOR EACH ROW EXECUTE FUNCTION set_campaign_priority_from_scope();
CREATE TRIGGER trg_campaigns_name_cascade_ckb AFTER UPDATE OF name ON public.campaigns FOR EACH ROW EXECUTE FUNCTION sync_ckb_campaign_name();
CREATE TRIGGER trg_notify_automation_submitted AFTER INSERT OR UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION notify_automation_submitted();
CREATE TRIGGER trg_selfserve_campaign_guard BEFORE INSERT OR UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION enforce_selfserve_campaign_guard();
CREATE TRIGGER client_onboarding_autoprovision AFTER UPDATE ON public.client_onboarding FOR EACH ROW WHEN (((new.status = 'submitted'::text) AND (old.status IS DISTINCT FROM 'submitted'::text))) EXECUTE FUNCTION provision_workspace_on_submit();
CREATE TRIGGER client_onboarding_set_updated_at BEFORE UPDATE ON public.client_onboarding FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_auto_provision_client BEFORE INSERT OR UPDATE OF status ON public.client_onboarding FOR EACH ROW EXECUTE FUNCTION auto_provision_client_from_onboarding();
CREATE TRIGGER trg_provision_client_web BEFORE UPDATE OF status ON public.client_onboarding FOR EACH ROW WHEN (((new.source = 'web'::text) AND (new.status = 'approved'::text) AND (old.status IS DISTINCT FROM 'approved'::text))) EXECUTE FUNCTION provision_client_from_web_onboarding();
CREATE TRIGGER conversations_increment_unread AFTER INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION increment_lead_unread_count();
CREATE TRIGGER conversations_update_lead_last_message AFTER INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION update_lead_last_message_at();
CREATE TRIGGER lead_grade_on_inbound AFTER INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION trg_lead_grade_from_conversations();
CREATE TRIGGER trg_conversations_inbound_exit_active_ai AFTER INSERT ON public.conversations FOR EACH ROW WHEN ((new.direction = 'inbound'::text)) EXECUTE FUNCTION exit_active_ai_followup_on_inbound();
CREATE TRIGGER trg_conversations_inbound_exit_waiting AFTER INSERT ON public.conversations FOR EACH ROW WHEN ((new.direction = 'inbound'::text)) EXECUTE FUNCTION exit_waiting_enrollments_on_inbound();
CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON public.creative_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER prompts_set_updated_at BEFORE UPDATE ON public.creative_prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER creatives_set_updated_at BEFORE UPDATE ON public.creatives FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_followup_request_rejected AFTER UPDATE OF status ON public.followup_requests FOR EACH ROW EXECUTE FUNCTION notify_followup_request_rejected();
CREATE TRIGGER trg_notify_followup_request AFTER INSERT ON public.followup_requests FOR EACH ROW EXECUTE FUNCTION notify_followup_request();
CREATE TRIGGER trg_notify_followup_resolved AFTER UPDATE ON public.followup_requests FOR EACH ROW EXECUTE FUNCTION notify_followup_resolved();
CREATE TRIGGER trg_kb_documents_n8n AFTER INSERT ON public.kb_documents FOR EACH ROW EXECUTE FUNCTION notify_n8n_kb_ingestion();
CREATE TRIGGER trg_validate_assignment_pool_member BEFORE INSERT OR UPDATE ON public.lead_assignment_pool FOR EACH ROW EXECUTE FUNCTION validate_assignment_pool_member();
CREATE TRIGGER trg_sync_campaign_lead_assignment AFTER INSERT OR UPDATE ON public.lead_campaign_states FOR EACH ROW EXECUTE FUNCTION sync_campaign_lead_assignment();
CREATE TRIGGER lead_grade_on_qualification AFTER INSERT OR DELETE OR UPDATE ON public.lead_qualifications FOR EACH ROW EXECUTE FUNCTION trg_lead_grade_from_qualifications();
CREATE TRIGGER enforce_lead_cap BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION enforce_lead_cap();
CREATE TRIGGER lead_grade_on_lead_update AFTER UPDATE OF phone, email, current_location, timeframe, motivation, last_inbound_at ON public.leads FOR EACH ROW WHEN (((old.phone IS DISTINCT FROM new.phone) OR (old.email IS DISTINCT FROM new.email) OR (old.current_location IS DISTINCT FROM new.current_location) OR (old.timeframe IS DISTINCT FROM new.timeframe) OR (old.motivation IS DISTINCT FROM new.motivation) OR (old.last_inbound_at IS DISTINCT FROM new.last_inbound_at))) EXECUTE FUNCTION trg_lead_grade_from_leads();
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_auto_assign_lead BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION auto_assign_lead();
CREATE TRIGGER trg_leads_automation_off_unenroll BEFORE UPDATE OF automation_enabled ON public.leads FOR EACH ROW WHEN (((new.automation_enabled = false) AND (old.automation_enabled = true))) EXECUTE FUNCTION unenroll_lead_on_automation_off();
CREATE TRIGGER trg_leads_temperature_event AFTER INSERT OR UPDATE OF lead_temperature ON public.leads FOR EACH ROW EXECUTE FUNCTION log_lead_temperature_event();
CREATE TRIGGER trg_log_lead_assignment_ins AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION log_lead_assignment();
CREATE TRIGGER trg_log_lead_assignment_upd AFTER UPDATE OF assigned_user_id ON public.leads FOR EACH ROW EXECUTE FUNCTION log_lead_assignment();
CREATE TRIGGER trg_normalize_and_guard_temperature BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION normalize_and_guard_lead_temperature();
CREATE TRIGGER trg_normalize_lead_quality BEFORE INSERT OR UPDATE OF lead_quality ON public.leads FOR EACH ROW EXECUTE FUNCTION normalize_lead_quality();
CREATE TRIGGER trg_notify_lead_assignment_ins AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION notify_lead_assignment();
CREATE TRIGGER trg_notify_lead_assignment_upd AFTER UPDATE OF assigned_user_id ON public.leads FOR EACH ROW EXECUTE FUNCTION notify_lead_assignment();
CREATE TRIGGER trg_notify_lead_temperature AFTER INSERT OR UPDATE OF lead_temperature ON public.leads FOR EACH ROW EXECUTE FUNCTION notify_lead_temperature();
CREATE TRIGGER trg_status_unqualified BEFORE UPDATE OF status ON public.leads FOR EACH ROW WHEN (((new.status = 'Unqualified'::text) AND (old.status IS DISTINCT FROM 'Unqualified'::text))) EXECUTE FUNCTION pause_automation_on_unqualified();
CREATE TRIGGER message_templates_updated_at BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION update_message_templates_updated_at();
CREATE TRIGGER trg_notify_page_connection_request AFTER INSERT ON public.page_connection_requests FOR EACH ROW EXECUTE FUNCTION notify_page_connection_request();
CREATE TRIGGER trg_notify_page_connection_resolved AFTER UPDATE ON public.page_connection_requests FOR EACH ROW EXECUTE FUNCTION notify_page_connection_resolved();
CREATE TRIGGER trg_deactivate_pool_on_profile AFTER UPDATE OF is_active ON public.profiles FOR EACH ROW EXECUTE FUNCTION deactivate_pool_on_profile_deactivate();
CREATE TRIGGER trg_enforce_profile_field_locks BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION enforce_profile_field_locks();
CREATE TRIGGER trg_enforce_profile_personal_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION enforce_profile_personal_fields_owner_only();
CREATE TRIGGER trg_guard_profile_insert BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_insert();
CREATE TRIGGER trg_guard_profile_privileged_cols BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_privileged_cols();
CREATE TRIGGER trg_seq_enrollment_fallback_task AFTER UPDATE OF state ON public.sequence_enrollments FOR EACH ROW EXECUTE FUNCTION create_fallback_task_on_unreachable();
CREATE TRIGGER trg_sequences_followup_activated AFTER UPDATE OF is_active ON public.sequences FOR EACH ROW EXECUTE FUNCTION notify_followup_activated();
CREATE TRIGGER tasks_set_client_id BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION set_task_client_id();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notify_task_assigned_ins AFTER INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION notify_task_assigned();
CREATE TRIGGER trg_notify_task_assigned_upd AFTER UPDATE OF assigned_to ON public.tasks FOR EACH ROW EXECUTE FUNCTION notify_task_assigned();
CREATE TRIGGER trg_notify_tour_completed AFTER INSERT OR UPDATE ON public.user_onboarding_tour FOR EACH ROW EXECUTE FUNCTION notify_tour_completed();
CREATE TRIGGER trg_user_onboarding_tour_guard BEFORE INSERT OR UPDATE ON public.user_onboarding_tour FOR EACH ROW EXECUTE FUNCTION user_onboarding_tour_guard();

-- ===== RLS =====
alter table public.ad_activity_log enable row level security;
alter table public.ad_analytics enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_content enable row level security;
alter table public.ad_creatives enable row level security;
alter table public.ad_listings enable row level security;
alter table public.ad_music_tracks enable row level security;
alter table public.ad_notifications enable row level security;
alter table public.ad_operator_tokens enable row level security;
alter table public.ad_posts enable row level security;
alter table public.ad_reports enable row level security;
alter table public.ad_social_accounts enable row level security;
alter table public.ad_templates enable row level security;
alter table public.ad_usage_limits enable row level security;
alter table public.agent_documents enable row level security;
alter table public.agent_listings enable row level security;
alter table public.agent_performance_scores enable row level security;
alter table public.agent_website_requests enable row level security;
alter table public.agent_websites enable row level security;
alter table public.ai_usage enable row level security;
alter table public.announcements enable row level security;
alter table public.appointments enable row level security;
alter table public.campaign_knowledge_base enable row level security;
alter table public.campaign_lead_assignments enable row level security;
alter table public.campaign_prompt_backup_20260807 enable row level security;
alter table public.campaign_prompt_backup_20260809 enable row level security;
alter table public.campaign_requests enable row level security;
alter table public.campaign_steps enable row level security;
alter table public.campaigns enable row level security;
alter table public.client_assets enable row level security;
alter table public.client_campaigns enable row level security;
alter table public.client_onboarding enable row level security;
alter table public.client_reference_documents enable row level security;
alter table public.clients enable row level security;
alter table public.conversations enable row level security;
alter table public.creative_jobs enable row level security;
alter table public.creative_prompts enable row level security;
alter table public.creatives enable row level security;
alter table public.daily_digests enable row level security;
alter table public.email_templates enable row level security;
alter table public.enrollment_rules enable row level security;
alter table public.follow_up_decisions enable row level security;
alter table public.followup_requests enable row level security;
alter table public.kb_chunks enable row level security;
alter table public.kb_documents enable row level security;
alter table public.lead_alert_emails enable row level security;
alter table public.lead_assignment_events enable row level security;
alter table public.lead_assignment_pool enable row level security;
alter table public.lead_campaign_states enable row level security;
alter table public.lead_memory enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_qualifications enable row level security;
alter table public.lead_temperature_events enable row level security;
alter table public.leads enable row level security;
alter table public.message_templates enable row level security;
alter table public.messenger_referrals enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.page_connection_requests enable row level security;
alter table public.plan_limits enable row level security;
alter table public.profiles enable row level security;
alter table public.prompt_templates enable row level security;
alter table public.push_tokens enable row level security;
alter table public.seq_enroll_backup_20260803 enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.sequences enable row level security;
alter table public.social_autopost_plans enable row level security;
alter table public.subscription_requests enable row level security;
alter table public.tasks enable row level security;
alter table public.user_onboarding_tour enable row level security;
alter table public.video_requests enable row level security;
alter table public.webhook_logs enable row level security;

-- ===== POLICIES =====
create policy baymo_admin_all_activity on public.ad_activity_log as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_activity on public.ad_activity_log as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = ad_activity_log.client_id)))));
create policy ad_analytics_member_select on public.ad_analytics as PERMISSIVE for SELECT to public
  using ((client_id = get_my_client_id()));
create policy baymo_admin_all_analytics on public.ad_analytics as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_analytics on public.ad_analytics as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = ad_analytics.client_id)))));
create policy ad_campaigns_member_select on public.ad_campaigns as PERMISSIVE for SELECT to public
  using ((client_id = get_my_client_id()));
create policy baymo_admin_all_campaigns on public.ad_campaigns as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_campaigns on public.ad_campaigns as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = ad_campaigns.client_id)))));
create policy ad_content_member_select on public.ad_content as PERMISSIVE for SELECT to public
  using ((client_id = get_my_client_id()));
create policy baymo_admin_all_content on public.ad_content as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_content on public.ad_content as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = ad_content.client_id)))));
create policy ad_creatives_member_select on public.ad_creatives as PERMISSIVE for SELECT to public
  using ((client_id = get_my_client_id()));
create policy baymo_admin_all_creatives on public.ad_creatives as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_creatives on public.ad_creatives as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = ad_creatives.client_id)))));
create policy baymo_admin_all_listings on public.ad_listings as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_listings on public.ad_listings as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = ad_listings.client_id)))));
create policy all_users_read_music on public.ad_music_tracks as PERMISSIVE for SELECT to public
  using (((is_active = true) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
create policy baymo_admin_all_music on public.ad_music_tracks as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy ad_notifications_member_select on public.ad_notifications as PERMISSIVE for SELECT to public
  using ((client_id = get_my_client_id()));
create policy ad_notifications_member_update on public.ad_notifications as PERMISSIVE for UPDATE to public
  using ((client_id = get_my_client_id()))
  with check ((client_id = get_my_client_id()));
create policy baymo_admin_all_notifications on public.ad_notifications as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_notifications on public.ad_notifications as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = ad_notifications.client_id)))));
create policy "Admin only: delete operator tokens" on public.ad_operator_tokens as PERMISSIVE for DELETE to authenticated
  using ((get_my_role() = 'baymo_admin'::text));
create policy "Admin only: insert operator tokens" on public.ad_operator_tokens as PERMISSIVE for INSERT to authenticated
  with check ((get_my_role() = 'baymo_admin'::text));
create policy "Admin only: read operator tokens" on public.ad_operator_tokens as PERMISSIVE for SELECT to authenticated
  using ((get_my_role() = 'baymo_admin'::text));
create policy "Admin only: update operator tokens" on public.ad_operator_tokens as PERMISSIVE for UPDATE to authenticated
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy ad_posts_member_insert on public.ad_posts as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (created_by = auth.uid())));
create policy ad_posts_member_select on public.ad_posts as PERMISSIVE for SELECT to public
  using ((client_id = get_my_client_id()));
create policy ad_posts_member_update on public.ad_posts as PERMISSIVE for UPDATE to public
  using ((client_id = get_my_client_id()))
  with check ((client_id = get_my_client_id()));
create policy baymo_admin_all_posts on public.ad_posts as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_posts on public.ad_posts as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = ad_posts.client_id)))));
create policy ad_reports_select on public.ad_reports as PERMISSIVE for SELECT to authenticated
  using (((client_id IN ( SELECT profiles.client_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text))))));
create policy baymo_admin_all_social_accounts on public.ad_social_accounts as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_social_accounts on public.ad_social_accounts as PERMISSIVE for ALL to public
  using ((client_id IN ( SELECT clients.id
   FROM clients
  WHERE ((clients.id = ad_social_accounts.client_id) AND (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = clients.id))))))));
create policy baymo_admin_all_templates on public.ad_templates as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_templates on public.ad_templates as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = ad_templates.client_id)))));
create policy client_admin_read_global_templates on public.ad_templates as PERMISSIVE for SELECT to public
  using (((client_id IS NULL) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text))))));
create policy baymo_admin_all_usage on public.ad_usage_limits as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_usage on public.ad_usage_limits as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = ad_usage_limits.client_id)))));
create policy agent_documents_delete on public.agent_documents as PERMISSIVE for DELETE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy agent_documents_insert on public.agent_documents as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (created_by = auth.uid())));
create policy agent_documents_select on public.agent_documents as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy agent_documents_update on public.agent_documents as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))))
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy agent_listings_delete on public.agent_listings as PERMISSIVE for DELETE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy agent_listings_insert on public.agent_listings as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (created_by = auth.uid())));
create policy agent_listings_select on public.agent_listings as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy agent_listings_update on public.agent_listings as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))))
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy perf_scores_select on public.agent_performance_scores as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (user_id = auth.uid())))));
create policy agent_website_requests_insert on public.agent_website_requests as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (created_by = auth.uid())));
create policy agent_website_requests_select on public.agent_website_requests as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy agent_website_requests_update on public.agent_website_requests as PERMISSIVE for UPDATE to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy agent_websites_delete on public.agent_websites as PERMISSIVE for DELETE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy agent_websites_insert on public.agent_websites as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (created_by = auth.uid())));
create policy agent_websites_select on public.agent_websites as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy agent_websites_update on public.agent_websites as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))))
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy announcements_delete on public.announcements as PERMISSIVE for DELETE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((get_my_role() = 'client_admin'::text) AND (scope = 'client'::text) AND (client_id = get_my_client_id()))));
create policy announcements_insert on public.announcements as PERMISSIVE for INSERT to public
  with check (((get_my_role() = 'baymo_admin'::text) OR ((get_my_role() = 'client_admin'::text) AND (scope = 'client'::text) AND (client_id = get_my_client_id()))));
create policy announcements_select on public.announcements as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR (scope = 'baymo'::text) OR (client_id = get_my_client_id())));
create policy announcements_update on public.announcements as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((get_my_role() = 'client_admin'::text) AND (scope = 'client'::text) AND (client_id = get_my_client_id()))));
create policy appointments_delete on public.appointments as PERMISSIVE for DELETE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy appointments_insert on public.appointments as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (created_by = auth.uid())));
create policy appointments_select on public.appointments as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy appointments_update on public.appointments as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))))
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy ckb_agent_read on public.campaign_knowledge_base as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'agent'::text) AND (client_id = get_my_client_id())));
create policy ckb_baymo_admin on public.campaign_knowledge_base as PERMISSIVE for ALL to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy ckb_client_admin_manager on public.campaign_knowledge_base as PERMISSIVE for ALL to public
  using (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (client_id = get_my_client_id())))
  with check (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (client_id = get_my_client_id())));
create policy cla_insert on public.campaign_lead_assignments as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy cla_select on public.campaign_lead_assignments as PERMISSIVE for SELECT to public
  using (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy cla_update on public.campaign_lead_assignments as PERMISSIVE for UPDATE to public
  using (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)))
  with check (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy campaign_requests_insert on public.campaign_requests as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (created_by = auth.uid())));
create policy campaign_requests_select on public.campaign_requests as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy campaign_requests_update on public.campaign_requests as PERMISSIVE for UPDATE to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy cie_campaign_steps_baymo_admin on public.campaign_steps as PERMISSIVE for ALL to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy cie_campaign_steps_client_read on public.campaign_steps as PERMISSIVE for SELECT to public
  using (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text, 'agent'::text])) AND (client_id = get_my_client_id())));
create policy campaigns_delete on public.campaigns as PERMISSIVE for DELETE to public
  using ((get_my_role() = 'baymo_admin'::text));
create policy campaigns_insert on public.campaigns as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy campaigns_select on public.campaigns as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR (client_id = get_my_client_id()) OR (EXISTS ( SELECT 1
   FROM client_campaigns cc
  WHERE ((cc.campaign_id = campaigns.id) AND (cc.client_id = get_my_client_id()))))));
create policy campaigns_update on public.campaigns as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR (client_id = get_my_client_id()) OR (EXISTS ( SELECT 1
   FROM client_campaigns cc
  WHERE ((cc.campaign_id = campaigns.id) AND (cc.client_id = get_my_client_id()))))));
create policy baymo_admin_all_assets on public.client_assets as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_assets on public.client_assets as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = client_assets.client_id)))));
create policy cc_delete on public.client_campaigns as PERMISSIVE for DELETE to public
  using ((get_my_role() = 'baymo_admin'::text));
create policy cc_insert on public.client_campaigns as PERMISSIVE for INSERT to public
  with check ((get_my_role() = 'baymo_admin'::text));
create policy cc_select on public.client_campaigns as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR (client_id = get_my_client_id())));
create policy cc_update on public.client_campaigns as PERMISSIVE for UPDATE to public
  using ((get_my_role() = 'baymo_admin'::text));
create policy client_onboarding_admin_all on public.client_onboarding as PERMISSIVE for ALL to public
  using ((get_my_role() = 'baymo_admin'::text));
create policy client_onboarding_own_insert on public.client_onboarding as PERMISSIVE for INSERT to public
  with check ((profile_id = auth.uid()));
create policy client_onboarding_own_select on public.client_onboarding as PERMISSIVE for SELECT to public
  using (((profile_id = auth.uid()) OR ((client_id IS NOT NULL) AND (client_id = get_my_client_id()))));
create policy client_onboarding_own_update on public.client_onboarding as PERMISSIVE for UPDATE to public
  using (((profile_id = auth.uid()) AND (status = 'in_progress'::text)))
  with check (((profile_id = auth.uid()) AND (status = ANY (ARRAY['in_progress'::text, 'submitted'::text]))));
create policy baymo_admin_all_reference_documents on public.client_reference_documents as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_reference_documents on public.client_reference_documents as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = client_reference_documents.client_id)))));
create policy reference_documents_member_select on public.client_reference_documents as PERMISSIVE for SELECT to public
  using ((client_id = get_my_client_id()));
create policy clients_all_admin_only on public.clients as PERMISSIVE for ALL to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy conversations_insert on public.conversations as PERMISSIVE for INSERT to public
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy conversations_select on public.conversations as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy conversations_update on public.conversations as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))))
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy baymo_admin_all_jobs on public.creative_jobs as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_jobs on public.creative_jobs as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = creative_jobs.client_id)))));
create policy baymo_admin_all_prompts on public.creative_prompts as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_prompts on public.creative_prompts as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = creative_prompts.client_id)))));
create policy baymo_admin_all_creatives_new on public.creatives as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'baymo_admin'::text)))));
create policy client_admin_own_creatives_new on public.creatives as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client_admin'::text) AND (profiles.client_id = creatives.client_id)))));
create policy creatives_member_select on public.creatives as PERMISSIVE for SELECT to public
  using ((client_id = get_my_client_id()));
create policy daily_digests_select on public.daily_digests as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR (client_id = get_my_client_id())));
create policy email_templates_delete on public.email_templates as PERMISSIVE for DELETE to public
  using (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy email_templates_insert on public.email_templates as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy email_templates_select on public.email_templates as PERMISSIVE for SELECT to public
  using (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy email_templates_update on public.email_templates as PERMISSIVE for UPDATE to public
  using (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)))
  with check (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy enrollment_rules_agent_read on public.enrollment_rules as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'agent'::text) AND (EXISTS ( SELECT 1
   FROM sequences s
  WHERE ((s.id = enrollment_rules.sequence_id) AND (s.client_id = get_my_client_id()))))));
create policy enrollment_rules_baymo_admin on public.enrollment_rules as PERMISSIVE for ALL to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy enrollment_rules_client_admin_manager on public.enrollment_rules as PERMISSIVE for ALL to public
  using (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (EXISTS ( SELECT 1
   FROM sequences s
  WHERE ((s.id = enrollment_rules.sequence_id) AND (s.client_id = get_my_client_id()))))))
  with check (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (EXISTS ( SELECT 1
   FROM sequences s
  WHERE ((s.id = enrollment_rules.sequence_id) AND (s.client_id = get_my_client_id()))))));
create policy follow_up_decisions_agent_read on public.follow_up_decisions as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'agent'::text) AND (client_id = get_my_client_id())));
create policy follow_up_decisions_baymo_admin on public.follow_up_decisions as PERMISSIVE for ALL to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy follow_up_decisions_client_admin_manager on public.follow_up_decisions as PERMISSIVE for ALL to public
  using (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (client_id = get_my_client_id())))
  with check (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (client_id = get_my_client_id())));
create policy fur_admin_update on public.followup_requests as PERMISSIVE for UPDATE to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy fur_insert on public.followup_requests as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (requested_by = auth.uid())));
create policy fur_select on public.followup_requests as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR (client_id = get_my_client_id())));
create policy "Admin delete kb_chunks" on public.kb_chunks as PERMISSIVE for DELETE to authenticated
  using ((get_my_role() = 'baymo_admin'::text));
create policy "Admin update kb_chunks" on public.kb_chunks as PERMISSIVE for UPDATE to authenticated
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy "Admin write kb_chunks" on public.kb_chunks as PERMISSIVE for INSERT to authenticated
  with check ((get_my_role() = 'baymo_admin'::text));
create policy "Client read own kb_chunks" on public.kb_chunks as PERMISSIVE for SELECT to authenticated
  using ((client_id = get_my_client_id()));
create policy kb_documents_delete_admin_only on public.kb_documents as PERMISSIVE for DELETE to authenticated
  using ((((client_id = get_my_client_id()) AND (get_my_role() = 'client_admin'::text)) OR (get_my_role() = 'baymo_admin'::text)));
create policy kb_documents_insert_own_client on public.kb_documents as PERMISSIVE for INSERT to authenticated
  with check (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy kb_documents_select_own_client on public.kb_documents as PERMISSIVE for SELECT to authenticated
  using (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy lead_alert_emails_admin_read on public.lead_alert_emails as PERMISSIVE for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'baymo_admin'::text)))));
create policy assignment_events_select on public.lead_assignment_events as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (to_user_id = auth.uid()) OR (from_user_id = auth.uid())))));
create policy pool_delete on public.lead_assignment_pool as PERMISSIVE for DELETE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((get_my_role() = 'client_admin'::text) AND (client_id = get_my_client_id()))));
create policy pool_insert on public.lead_assignment_pool as PERMISSIVE for INSERT to public
  with check (((get_my_role() = 'baymo_admin'::text) OR ((get_my_role() = 'client_admin'::text) AND (client_id = get_my_client_id()))));
create policy pool_select on public.lead_assignment_pool as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR (client_id = get_my_client_id())));
create policy pool_update on public.lead_assignment_pool as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((get_my_role() = 'client_admin'::text) AND (client_id = get_my_client_id()))));
create policy cie_lead_states_agent_pause_resume on public.lead_campaign_states as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'agent'::text) AND (client_id = get_my_client_id())))
  with check (((get_my_role() = 'agent'::text) AND (client_id = get_my_client_id()) AND (state = ANY (ARRAY['active'::text, 'paused'::text]))));
create policy cie_lead_states_agent_read on public.lead_campaign_states as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'agent'::text) AND (client_id = get_my_client_id())));
create policy cie_lead_states_baymo_admin on public.lead_campaign_states as PERMISSIVE for ALL to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy cie_lead_states_client_admin_manager on public.lead_campaign_states as PERMISSIVE for ALL to public
  using (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (client_id = get_my_client_id())))
  with check (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (client_id = get_my_client_id())));
create policy "Admin delete lead_memory" on public.lead_memory as PERMISSIVE for DELETE to authenticated
  using ((get_my_role() = 'baymo_admin'::text));
create policy "Admin update lead_memory" on public.lead_memory as PERMISSIVE for UPDATE to authenticated
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy "Admin write lead_memory" on public.lead_memory as PERMISSIVE for INSERT to authenticated
  with check ((get_my_role() = 'baymo_admin'::text));
create policy "Client read own lead_memory" on public.lead_memory as PERMISSIVE for SELECT to authenticated
  using ((client_id = get_my_client_id()));
create policy lead_notes_delete on public.lead_notes as PERMISSIVE for DELETE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy lead_notes_insert on public.lead_notes as PERMISSIVE for INSERT to public
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy lead_notes_select on public.lead_notes as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy lead_notes_update on public.lead_notes as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))))
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy lead_qualifications_delete on public.lead_qualifications as PERMISSIVE for DELETE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy lead_qualifications_insert on public.lead_qualifications as PERMISSIVE for INSERT to public
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy lead_qualifications_select on public.lead_qualifications as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy lead_qualifications_update on public.lead_qualifications as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))))
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy lte_select on public.lead_temperature_events as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id)))));
create policy leads_delete on public.leads as PERMISSIVE for DELETE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (assigned_user_id = auth.uid())))));
create policy leads_insert on public.leads as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy leads_select on public.leads as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (assigned_user_id = auth.uid())))));
create policy leads_update on public.leads as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (assigned_user_id = auth.uid())))))
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (assigned_user_id = auth.uid())))));
create policy message_templates_delete on public.message_templates as PERMISSIVE for DELETE to public
  using (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy message_templates_insert on public.message_templates as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy message_templates_select on public.message_templates as PERMISSIVE for SELECT to public
  using (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy message_templates_update on public.message_templates as PERMISSIVE for UPDATE to public
  using (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)))
  with check (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));
create policy notif_prefs_own on public.notification_preferences as PERMISSIVE for ALL to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy notifications_select_own on public.notifications as PERMISSIVE for SELECT to public
  using ((user_id = auth.uid()));
create policy notifications_update_own on public.notifications as PERMISSIVE for UPDATE to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy pcr_admin_update on public.page_connection_requests as PERMISSIVE for UPDATE to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy pcr_insert on public.page_connection_requests as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (requested_by = auth.uid())));
create policy pcr_select on public.page_connection_requests as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR (client_id = get_my_client_id())));
create policy profiles_insert on public.profiles as PERMISSIVE for INSERT to authenticated
  with check ((get_my_role() = 'baymo_admin'::text));
create policy profiles_select on public.profiles as PERMISSIVE for SELECT to public
  using (((auth.uid() = id) OR (get_my_role() = 'baymo_admin'::text) OR ((get_my_role() = 'client_admin'::text) AND (client_id = get_my_client_id()))));
create policy profiles_update on public.profiles as PERMISSIVE for UPDATE to public
  using (((auth.uid() = id) OR (get_my_role() = 'baymo_admin'::text) OR ((get_my_role() = 'client_admin'::text) AND (client_id = get_my_client_id()))));
create policy baymo_admin_all on public.prompt_templates as PERMISSIVE for ALL to public
  using ((get_my_role() = 'baymo_admin'::text));
create policy client_read on public.prompt_templates as PERMISSIVE for SELECT to public
  using (((client_id = get_my_client_id()) OR (client_id IS NULL)));
create policy push_tokens_own on public.push_tokens as PERMISSIVE for ALL to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy seq_enrollments_agent_pause_resume on public.sequence_enrollments as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'agent'::text) AND (client_id = get_my_client_id())))
  with check (((get_my_role() = 'agent'::text) AND (client_id = get_my_client_id()) AND (state = ANY (ARRAY['active'::text, 'paused'::text]))));
create policy seq_enrollments_agent_read on public.sequence_enrollments as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'agent'::text) AND (client_id = get_my_client_id())));
create policy seq_enrollments_baymo_admin on public.sequence_enrollments as PERMISSIVE for ALL to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy seq_enrollments_client_admin_manager on public.sequence_enrollments as PERMISSIVE for ALL to public
  using (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (client_id = get_my_client_id())))
  with check (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (client_id = get_my_client_id())));
create policy seq_steps_agent_read on public.sequence_steps as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'agent'::text) AND (EXISTS ( SELECT 1
   FROM sequences s
  WHERE ((s.id = sequence_steps.sequence_id) AND (s.client_id = get_my_client_id()))))));
create policy seq_steps_baymo_admin on public.sequence_steps as PERMISSIVE for ALL to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy seq_steps_client_admin_manager on public.sequence_steps as PERMISSIVE for ALL to public
  using (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (EXISTS ( SELECT 1
   FROM sequences s
  WHERE ((s.id = sequence_steps.sequence_id) AND (s.client_id = get_my_client_id()))))))
  with check (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (EXISTS ( SELECT 1
   FROM sequences s
  WHERE ((s.id = sequence_steps.sequence_id) AND (s.client_id = get_my_client_id()))))));
create policy sequences_agent_read on public.sequences as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'agent'::text) AND (client_id = get_my_client_id())));
create policy sequences_baymo_admin on public.sequences as PERMISSIVE for ALL to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy sequences_client_admin_manager on public.sequences as PERMISSIVE for ALL to public
  using (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (client_id = get_my_client_id())))
  with check (((get_my_role() = ANY (ARRAY['client_admin'::text, 'manager'::text])) AND (client_id = get_my_client_id())));
create policy autopost_plans_insert on public.social_autopost_plans as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (created_by = auth.uid())));
create policy autopost_plans_select on public.social_autopost_plans as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy autopost_plans_update on public.social_autopost_plans as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))))
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy subscription_requests_insert on public.subscription_requests as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (created_by = auth.uid())));
create policy subscription_requests_select on public.subscription_requests as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy subscription_requests_update on public.subscription_requests as PERMISSIVE for UPDATE to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy tasks_delete on public.tasks as PERMISSIVE for DELETE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id) OR (assigned_to = auth.uid()) OR (created_by = auth.uid())))));
create policy tasks_insert on public.tasks as PERMISSIVE for INSERT to public
  with check (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id) OR (assigned_to = auth.uid()) OR (created_by = auth.uid())))));
create policy tasks_select on public.tasks as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id) OR (assigned_to = auth.uid()) OR (created_by = auth.uid())))));
create policy tasks_update on public.tasks as PERMISSIVE for UPDATE to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR lead_assigned_to_me(lead_id) OR (assigned_to = auth.uid()) OR (created_by = auth.uid())))))
  with check (((get_my_role() = 'baymo_admin'::text) OR (client_id = get_my_client_id())));
create policy tour_admin_select on public.user_onboarding_tour as PERMISSIVE for SELECT to public
  using ((get_my_role() = 'baymo_admin'::text));
create policy tour_own_insert on public.user_onboarding_tour as PERMISSIVE for INSERT to public
  with check ((profile_id = auth.uid()));
create policy tour_own_select on public.user_onboarding_tour as PERMISSIVE for SELECT to public
  using ((profile_id = auth.uid()));
create policy tour_own_update on public.user_onboarding_tour as PERMISSIVE for UPDATE to public
  using ((profile_id = auth.uid()))
  with check ((profile_id = auth.uid()));
create policy video_requests_insert on public.video_requests as PERMISSIVE for INSERT to public
  with check (((client_id = get_my_client_id()) AND (created_by = auth.uid())));
create policy video_requests_select on public.video_requests as PERMISSIVE for SELECT to public
  using (((get_my_role() = 'baymo_admin'::text) OR ((client_id = get_my_client_id()) AND ((get_my_role() <> 'agent'::text) OR (created_by = auth.uid())))));
create policy video_requests_update on public.video_requests as PERMISSIVE for UPDATE to public
  using ((get_my_role() = 'baymo_admin'::text))
  with check ((get_my_role() = 'baymo_admin'::text));
create policy webhook_logs_select on public.webhook_logs as PERMISSIVE for SELECT to public
  using (((client_id = get_my_client_id()) OR (get_my_role() = 'baymo_admin'::text)));

-- ===== GRANTS (anon/authenticated/service_role) =====
grant DELETE on public.ad_activity_log to anon;
grant INSERT on public.ad_activity_log to anon;
grant REFERENCES on public.ad_activity_log to anon;
grant SELECT on public.ad_activity_log to anon;
grant TRIGGER on public.ad_activity_log to anon;
grant TRUNCATE on public.ad_activity_log to anon;
grant UPDATE on public.ad_activity_log to anon;
grant DELETE on public.ad_activity_log to authenticated;
grant INSERT on public.ad_activity_log to authenticated;
grant REFERENCES on public.ad_activity_log to authenticated;
grant SELECT on public.ad_activity_log to authenticated;
grant TRIGGER on public.ad_activity_log to authenticated;
grant TRUNCATE on public.ad_activity_log to authenticated;
grant UPDATE on public.ad_activity_log to authenticated;
grant DELETE on public.ad_activity_log to service_role;
grant INSERT on public.ad_activity_log to service_role;
grant REFERENCES on public.ad_activity_log to service_role;
grant SELECT on public.ad_activity_log to service_role;
grant TRIGGER on public.ad_activity_log to service_role;
grant TRUNCATE on public.ad_activity_log to service_role;
grant UPDATE on public.ad_activity_log to service_role;
grant DELETE on public.ad_analytics to anon;
grant INSERT on public.ad_analytics to anon;
grant REFERENCES on public.ad_analytics to anon;
grant SELECT on public.ad_analytics to anon;
grant TRIGGER on public.ad_analytics to anon;
grant TRUNCATE on public.ad_analytics to anon;
grant UPDATE on public.ad_analytics to anon;
grant DELETE on public.ad_analytics to authenticated;
grant INSERT on public.ad_analytics to authenticated;
grant REFERENCES on public.ad_analytics to authenticated;
grant SELECT on public.ad_analytics to authenticated;
grant TRIGGER on public.ad_analytics to authenticated;
grant TRUNCATE on public.ad_analytics to authenticated;
grant UPDATE on public.ad_analytics to authenticated;
grant DELETE on public.ad_analytics to service_role;
grant INSERT on public.ad_analytics to service_role;
grant REFERENCES on public.ad_analytics to service_role;
grant SELECT on public.ad_analytics to service_role;
grant TRIGGER on public.ad_analytics to service_role;
grant TRUNCATE on public.ad_analytics to service_role;
grant UPDATE on public.ad_analytics to service_role;
grant DELETE on public.ad_campaigns to anon;
grant INSERT on public.ad_campaigns to anon;
grant REFERENCES on public.ad_campaigns to anon;
grant SELECT on public.ad_campaigns to anon;
grant TRIGGER on public.ad_campaigns to anon;
grant TRUNCATE on public.ad_campaigns to anon;
grant UPDATE on public.ad_campaigns to anon;
grant DELETE on public.ad_campaigns to authenticated;
grant INSERT on public.ad_campaigns to authenticated;
grant REFERENCES on public.ad_campaigns to authenticated;
grant SELECT on public.ad_campaigns to authenticated;
grant TRIGGER on public.ad_campaigns to authenticated;
grant TRUNCATE on public.ad_campaigns to authenticated;
grant UPDATE on public.ad_campaigns to authenticated;
grant DELETE on public.ad_campaigns to service_role;
grant INSERT on public.ad_campaigns to service_role;
grant REFERENCES on public.ad_campaigns to service_role;
grant SELECT on public.ad_campaigns to service_role;
grant TRIGGER on public.ad_campaigns to service_role;
grant TRUNCATE on public.ad_campaigns to service_role;
grant UPDATE on public.ad_campaigns to service_role;
grant DELETE on public.ad_content to anon;
grant INSERT on public.ad_content to anon;
grant REFERENCES on public.ad_content to anon;
grant SELECT on public.ad_content to anon;
grant TRIGGER on public.ad_content to anon;
grant TRUNCATE on public.ad_content to anon;
grant UPDATE on public.ad_content to anon;
grant DELETE on public.ad_content to authenticated;
grant INSERT on public.ad_content to authenticated;
grant REFERENCES on public.ad_content to authenticated;
grant SELECT on public.ad_content to authenticated;
grant TRIGGER on public.ad_content to authenticated;
grant TRUNCATE on public.ad_content to authenticated;
grant UPDATE on public.ad_content to authenticated;
grant DELETE on public.ad_content to service_role;
grant INSERT on public.ad_content to service_role;
grant REFERENCES on public.ad_content to service_role;
grant SELECT on public.ad_content to service_role;
grant TRIGGER on public.ad_content to service_role;
grant TRUNCATE on public.ad_content to service_role;
grant UPDATE on public.ad_content to service_role;
grant DELETE on public.ad_creatives to anon;
grant INSERT on public.ad_creatives to anon;
grant REFERENCES on public.ad_creatives to anon;
grant SELECT on public.ad_creatives to anon;
grant TRIGGER on public.ad_creatives to anon;
grant TRUNCATE on public.ad_creatives to anon;
grant UPDATE on public.ad_creatives to anon;
grant DELETE on public.ad_creatives to authenticated;
grant INSERT on public.ad_creatives to authenticated;
grant REFERENCES on public.ad_creatives to authenticated;
grant SELECT on public.ad_creatives to authenticated;
grant TRIGGER on public.ad_creatives to authenticated;
grant TRUNCATE on public.ad_creatives to authenticated;
grant UPDATE on public.ad_creatives to authenticated;
grant DELETE on public.ad_creatives to service_role;
grant INSERT on public.ad_creatives to service_role;
grant REFERENCES on public.ad_creatives to service_role;
grant SELECT on public.ad_creatives to service_role;
grant TRIGGER on public.ad_creatives to service_role;
grant TRUNCATE on public.ad_creatives to service_role;
grant UPDATE on public.ad_creatives to service_role;
grant DELETE on public.ad_listings to anon;
grant INSERT on public.ad_listings to anon;
grant REFERENCES on public.ad_listings to anon;
grant SELECT on public.ad_listings to anon;
grant TRIGGER on public.ad_listings to anon;
grant TRUNCATE on public.ad_listings to anon;
grant UPDATE on public.ad_listings to anon;
grant DELETE on public.ad_listings to authenticated;
grant INSERT on public.ad_listings to authenticated;
grant REFERENCES on public.ad_listings to authenticated;
grant SELECT on public.ad_listings to authenticated;
grant TRIGGER on public.ad_listings to authenticated;
grant TRUNCATE on public.ad_listings to authenticated;
grant UPDATE on public.ad_listings to authenticated;
grant DELETE on public.ad_listings to service_role;
grant INSERT on public.ad_listings to service_role;
grant REFERENCES on public.ad_listings to service_role;
grant SELECT on public.ad_listings to service_role;
grant TRIGGER on public.ad_listings to service_role;
grant TRUNCATE on public.ad_listings to service_role;
grant UPDATE on public.ad_listings to service_role;
grant DELETE on public.ad_music_tracks to anon;
grant INSERT on public.ad_music_tracks to anon;
grant REFERENCES on public.ad_music_tracks to anon;
grant SELECT on public.ad_music_tracks to anon;
grant TRIGGER on public.ad_music_tracks to anon;
grant TRUNCATE on public.ad_music_tracks to anon;
grant UPDATE on public.ad_music_tracks to anon;
grant DELETE on public.ad_music_tracks to authenticated;
grant INSERT on public.ad_music_tracks to authenticated;
grant REFERENCES on public.ad_music_tracks to authenticated;
grant SELECT on public.ad_music_tracks to authenticated;
grant TRIGGER on public.ad_music_tracks to authenticated;
grant TRUNCATE on public.ad_music_tracks to authenticated;
grant UPDATE on public.ad_music_tracks to authenticated;
grant DELETE on public.ad_music_tracks to service_role;
grant INSERT on public.ad_music_tracks to service_role;
grant REFERENCES on public.ad_music_tracks to service_role;
grant SELECT on public.ad_music_tracks to service_role;
grant TRIGGER on public.ad_music_tracks to service_role;
grant TRUNCATE on public.ad_music_tracks to service_role;
grant UPDATE on public.ad_music_tracks to service_role;
grant DELETE on public.ad_notifications to anon;
grant INSERT on public.ad_notifications to anon;
grant REFERENCES on public.ad_notifications to anon;
grant SELECT on public.ad_notifications to anon;
grant TRIGGER on public.ad_notifications to anon;
grant TRUNCATE on public.ad_notifications to anon;
grant UPDATE on public.ad_notifications to anon;
grant DELETE on public.ad_notifications to authenticated;
grant INSERT on public.ad_notifications to authenticated;
grant REFERENCES on public.ad_notifications to authenticated;
grant SELECT on public.ad_notifications to authenticated;
grant TRIGGER on public.ad_notifications to authenticated;
grant TRUNCATE on public.ad_notifications to authenticated;
grant UPDATE on public.ad_notifications to authenticated;
grant DELETE on public.ad_notifications to service_role;
grant INSERT on public.ad_notifications to service_role;
grant REFERENCES on public.ad_notifications to service_role;
grant SELECT on public.ad_notifications to service_role;
grant TRIGGER on public.ad_notifications to service_role;
grant TRUNCATE on public.ad_notifications to service_role;
grant UPDATE on public.ad_notifications to service_role;
grant DELETE on public.ad_operator_tokens to anon;
grant INSERT on public.ad_operator_tokens to anon;
grant REFERENCES on public.ad_operator_tokens to anon;
grant SELECT on public.ad_operator_tokens to anon;
grant TRIGGER on public.ad_operator_tokens to anon;
grant TRUNCATE on public.ad_operator_tokens to anon;
grant UPDATE on public.ad_operator_tokens to anon;
grant DELETE on public.ad_operator_tokens to authenticated;
grant INSERT on public.ad_operator_tokens to authenticated;
grant REFERENCES on public.ad_operator_tokens to authenticated;
grant SELECT on public.ad_operator_tokens to authenticated;
grant TRIGGER on public.ad_operator_tokens to authenticated;
grant TRUNCATE on public.ad_operator_tokens to authenticated;
grant UPDATE on public.ad_operator_tokens to authenticated;
grant DELETE on public.ad_operator_tokens to service_role;
grant INSERT on public.ad_operator_tokens to service_role;
grant REFERENCES on public.ad_operator_tokens to service_role;
grant SELECT on public.ad_operator_tokens to service_role;
grant TRIGGER on public.ad_operator_tokens to service_role;
grant TRUNCATE on public.ad_operator_tokens to service_role;
grant UPDATE on public.ad_operator_tokens to service_role;
grant DELETE on public.ad_posts to anon;
grant INSERT on public.ad_posts to anon;
grant REFERENCES on public.ad_posts to anon;
grant SELECT on public.ad_posts to anon;
grant TRIGGER on public.ad_posts to anon;
grant TRUNCATE on public.ad_posts to anon;
grant UPDATE on public.ad_posts to anon;
grant DELETE on public.ad_posts to authenticated;
grant INSERT on public.ad_posts to authenticated;
grant REFERENCES on public.ad_posts to authenticated;
grant SELECT on public.ad_posts to authenticated;
grant TRIGGER on public.ad_posts to authenticated;
grant TRUNCATE on public.ad_posts to authenticated;
grant UPDATE on public.ad_posts to authenticated;
grant DELETE on public.ad_posts to service_role;
grant INSERT on public.ad_posts to service_role;
grant REFERENCES on public.ad_posts to service_role;
grant SELECT on public.ad_posts to service_role;
grant TRIGGER on public.ad_posts to service_role;
grant TRUNCATE on public.ad_posts to service_role;
grant UPDATE on public.ad_posts to service_role;
grant DELETE on public.ad_reports to anon;
grant INSERT on public.ad_reports to anon;
grant REFERENCES on public.ad_reports to anon;
grant SELECT on public.ad_reports to anon;
grant TRIGGER on public.ad_reports to anon;
grant TRUNCATE on public.ad_reports to anon;
grant UPDATE on public.ad_reports to anon;
grant DELETE on public.ad_reports to authenticated;
grant INSERT on public.ad_reports to authenticated;
grant REFERENCES on public.ad_reports to authenticated;
grant SELECT on public.ad_reports to authenticated;
grant TRIGGER on public.ad_reports to authenticated;
grant TRUNCATE on public.ad_reports to authenticated;
grant UPDATE on public.ad_reports to authenticated;
grant DELETE on public.ad_reports to service_role;
grant INSERT on public.ad_reports to service_role;
grant REFERENCES on public.ad_reports to service_role;
grant SELECT on public.ad_reports to service_role;
grant TRIGGER on public.ad_reports to service_role;
grant TRUNCATE on public.ad_reports to service_role;
grant UPDATE on public.ad_reports to service_role;
grant DELETE on public.ad_social_accounts to anon;
grant INSERT on public.ad_social_accounts to anon;
grant REFERENCES on public.ad_social_accounts to anon;
grant SELECT on public.ad_social_accounts to anon;
grant TRIGGER on public.ad_social_accounts to anon;
grant TRUNCATE on public.ad_social_accounts to anon;
grant UPDATE on public.ad_social_accounts to anon;
grant DELETE on public.ad_social_accounts to authenticated;
grant INSERT on public.ad_social_accounts to authenticated;
grant REFERENCES on public.ad_social_accounts to authenticated;
grant SELECT on public.ad_social_accounts to authenticated;
grant TRIGGER on public.ad_social_accounts to authenticated;
grant TRUNCATE on public.ad_social_accounts to authenticated;
grant UPDATE on public.ad_social_accounts to authenticated;
grant DELETE on public.ad_social_accounts to service_role;
grant INSERT on public.ad_social_accounts to service_role;
grant REFERENCES on public.ad_social_accounts to service_role;
grant SELECT on public.ad_social_accounts to service_role;
grant TRIGGER on public.ad_social_accounts to service_role;
grant TRUNCATE on public.ad_social_accounts to service_role;
grant UPDATE on public.ad_social_accounts to service_role;
grant DELETE on public.ad_templates to anon;
grant INSERT on public.ad_templates to anon;
grant REFERENCES on public.ad_templates to anon;
grant SELECT on public.ad_templates to anon;
grant TRIGGER on public.ad_templates to anon;
grant TRUNCATE on public.ad_templates to anon;
grant UPDATE on public.ad_templates to anon;
grant DELETE on public.ad_templates to authenticated;
grant INSERT on public.ad_templates to authenticated;
grant REFERENCES on public.ad_templates to authenticated;
grant SELECT on public.ad_templates to authenticated;
grant TRIGGER on public.ad_templates to authenticated;
grant TRUNCATE on public.ad_templates to authenticated;
grant UPDATE on public.ad_templates to authenticated;
grant DELETE on public.ad_templates to service_role;
grant INSERT on public.ad_templates to service_role;
grant REFERENCES on public.ad_templates to service_role;
grant SELECT on public.ad_templates to service_role;
grant TRIGGER on public.ad_templates to service_role;
grant TRUNCATE on public.ad_templates to service_role;
grant UPDATE on public.ad_templates to service_role;
grant DELETE on public.ad_usage_limits to anon;
grant INSERT on public.ad_usage_limits to anon;
grant REFERENCES on public.ad_usage_limits to anon;
grant SELECT on public.ad_usage_limits to anon;
grant TRIGGER on public.ad_usage_limits to anon;
grant TRUNCATE on public.ad_usage_limits to anon;
grant UPDATE on public.ad_usage_limits to anon;
grant DELETE on public.ad_usage_limits to authenticated;
grant INSERT on public.ad_usage_limits to authenticated;
grant REFERENCES on public.ad_usage_limits to authenticated;
grant SELECT on public.ad_usage_limits to authenticated;
grant TRIGGER on public.ad_usage_limits to authenticated;
grant TRUNCATE on public.ad_usage_limits to authenticated;
grant UPDATE on public.ad_usage_limits to authenticated;
grant DELETE on public.ad_usage_limits to service_role;
grant INSERT on public.ad_usage_limits to service_role;
grant REFERENCES on public.ad_usage_limits to service_role;
grant SELECT on public.ad_usage_limits to service_role;
grant TRIGGER on public.ad_usage_limits to service_role;
grant TRUNCATE on public.ad_usage_limits to service_role;
grant UPDATE on public.ad_usage_limits to service_role;
grant DELETE on public.agent_documents to anon;
grant INSERT on public.agent_documents to anon;
grant REFERENCES on public.agent_documents to anon;
grant SELECT on public.agent_documents to anon;
grant TRIGGER on public.agent_documents to anon;
grant TRUNCATE on public.agent_documents to anon;
grant UPDATE on public.agent_documents to anon;
grant DELETE on public.agent_documents to authenticated;
grant INSERT on public.agent_documents to authenticated;
grant REFERENCES on public.agent_documents to authenticated;
grant SELECT on public.agent_documents to authenticated;
grant TRIGGER on public.agent_documents to authenticated;
grant TRUNCATE on public.agent_documents to authenticated;
grant UPDATE on public.agent_documents to authenticated;
grant DELETE on public.agent_documents to service_role;
grant INSERT on public.agent_documents to service_role;
grant REFERENCES on public.agent_documents to service_role;
grant SELECT on public.agent_documents to service_role;
grant TRIGGER on public.agent_documents to service_role;
grant TRUNCATE on public.agent_documents to service_role;
grant UPDATE on public.agent_documents to service_role;
grant DELETE on public.agent_listings to anon;
grant INSERT on public.agent_listings to anon;
grant REFERENCES on public.agent_listings to anon;
grant SELECT on public.agent_listings to anon;
grant TRIGGER on public.agent_listings to anon;
grant TRUNCATE on public.agent_listings to anon;
grant UPDATE on public.agent_listings to anon;
grant DELETE on public.agent_listings to authenticated;
grant INSERT on public.agent_listings to authenticated;
grant REFERENCES on public.agent_listings to authenticated;
grant SELECT on public.agent_listings to authenticated;
grant TRIGGER on public.agent_listings to authenticated;
grant TRUNCATE on public.agent_listings to authenticated;
grant UPDATE on public.agent_listings to authenticated;
grant DELETE on public.agent_listings to service_role;
grant INSERT on public.agent_listings to service_role;
grant REFERENCES on public.agent_listings to service_role;
grant SELECT on public.agent_listings to service_role;
grant TRIGGER on public.agent_listings to service_role;
grant TRUNCATE on public.agent_listings to service_role;
grant UPDATE on public.agent_listings to service_role;
grant DELETE on public.agent_performance_scores to anon;
grant INSERT on public.agent_performance_scores to anon;
grant REFERENCES on public.agent_performance_scores to anon;
grant SELECT on public.agent_performance_scores to anon;
grant TRIGGER on public.agent_performance_scores to anon;
grant TRUNCATE on public.agent_performance_scores to anon;
grant UPDATE on public.agent_performance_scores to anon;
grant DELETE on public.agent_performance_scores to authenticated;
grant INSERT on public.agent_performance_scores to authenticated;
grant REFERENCES on public.agent_performance_scores to authenticated;
grant SELECT on public.agent_performance_scores to authenticated;
grant TRIGGER on public.agent_performance_scores to authenticated;
grant TRUNCATE on public.agent_performance_scores to authenticated;
grant UPDATE on public.agent_performance_scores to authenticated;
grant DELETE on public.agent_performance_scores to service_role;
grant INSERT on public.agent_performance_scores to service_role;
grant REFERENCES on public.agent_performance_scores to service_role;
grant SELECT on public.agent_performance_scores to service_role;
grant TRIGGER on public.agent_performance_scores to service_role;
grant TRUNCATE on public.agent_performance_scores to service_role;
grant UPDATE on public.agent_performance_scores to service_role;
grant DELETE on public.agent_website_requests to anon;
grant INSERT on public.agent_website_requests to anon;
grant REFERENCES on public.agent_website_requests to anon;
grant SELECT on public.agent_website_requests to anon;
grant TRIGGER on public.agent_website_requests to anon;
grant TRUNCATE on public.agent_website_requests to anon;
grant UPDATE on public.agent_website_requests to anon;
grant DELETE on public.agent_website_requests to authenticated;
grant INSERT on public.agent_website_requests to authenticated;
grant REFERENCES on public.agent_website_requests to authenticated;
grant SELECT on public.agent_website_requests to authenticated;
grant TRIGGER on public.agent_website_requests to authenticated;
grant TRUNCATE on public.agent_website_requests to authenticated;
grant UPDATE on public.agent_website_requests to authenticated;
grant DELETE on public.agent_website_requests to service_role;
grant INSERT on public.agent_website_requests to service_role;
grant REFERENCES on public.agent_website_requests to service_role;
grant SELECT on public.agent_website_requests to service_role;
grant TRIGGER on public.agent_website_requests to service_role;
grant TRUNCATE on public.agent_website_requests to service_role;
grant UPDATE on public.agent_website_requests to service_role;
grant DELETE on public.agent_websites to anon;
grant INSERT on public.agent_websites to anon;
grant REFERENCES on public.agent_websites to anon;
grant SELECT on public.agent_websites to anon;
grant TRIGGER on public.agent_websites to anon;
grant TRUNCATE on public.agent_websites to anon;
grant UPDATE on public.agent_websites to anon;
grant DELETE on public.agent_websites to authenticated;
grant INSERT on public.agent_websites to authenticated;
grant REFERENCES on public.agent_websites to authenticated;
grant SELECT on public.agent_websites to authenticated;
grant TRIGGER on public.agent_websites to authenticated;
grant TRUNCATE on public.agent_websites to authenticated;
grant UPDATE on public.agent_websites to authenticated;
grant DELETE on public.agent_websites to service_role;
grant INSERT on public.agent_websites to service_role;
grant REFERENCES on public.agent_websites to service_role;
grant SELECT on public.agent_websites to service_role;
grant TRIGGER on public.agent_websites to service_role;
grant TRUNCATE on public.agent_websites to service_role;
grant UPDATE on public.agent_websites to service_role;
grant DELETE on public.ai_usage to anon;
grant INSERT on public.ai_usage to anon;
grant REFERENCES on public.ai_usage to anon;
grant SELECT on public.ai_usage to anon;
grant TRIGGER on public.ai_usage to anon;
grant TRUNCATE on public.ai_usage to anon;
grant UPDATE on public.ai_usage to anon;
grant DELETE on public.ai_usage to authenticated;
grant INSERT on public.ai_usage to authenticated;
grant REFERENCES on public.ai_usage to authenticated;
grant SELECT on public.ai_usage to authenticated;
grant TRIGGER on public.ai_usage to authenticated;
grant TRUNCATE on public.ai_usage to authenticated;
grant UPDATE on public.ai_usage to authenticated;
grant DELETE on public.ai_usage to service_role;
grant INSERT on public.ai_usage to service_role;
grant REFERENCES on public.ai_usage to service_role;
grant SELECT on public.ai_usage to service_role;
grant TRIGGER on public.ai_usage to service_role;
grant TRUNCATE on public.ai_usage to service_role;
grant UPDATE on public.ai_usage to service_role;
grant DELETE on public.announcements to anon;
grant INSERT on public.announcements to anon;
grant REFERENCES on public.announcements to anon;
grant SELECT on public.announcements to anon;
grant TRIGGER on public.announcements to anon;
grant TRUNCATE on public.announcements to anon;
grant UPDATE on public.announcements to anon;
grant DELETE on public.announcements to authenticated;
grant INSERT on public.announcements to authenticated;
grant REFERENCES on public.announcements to authenticated;
grant SELECT on public.announcements to authenticated;
grant TRIGGER on public.announcements to authenticated;
grant TRUNCATE on public.announcements to authenticated;
grant UPDATE on public.announcements to authenticated;
grant DELETE on public.announcements to service_role;
grant INSERT on public.announcements to service_role;
grant REFERENCES on public.announcements to service_role;
grant SELECT on public.announcements to service_role;
grant TRIGGER on public.announcements to service_role;
grant TRUNCATE on public.announcements to service_role;
grant UPDATE on public.announcements to service_role;
grant DELETE on public.appointments to anon;
grant INSERT on public.appointments to anon;
grant REFERENCES on public.appointments to anon;
grant SELECT on public.appointments to anon;
grant TRIGGER on public.appointments to anon;
grant TRUNCATE on public.appointments to anon;
grant UPDATE on public.appointments to anon;
grant DELETE on public.appointments to authenticated;
grant INSERT on public.appointments to authenticated;
grant REFERENCES on public.appointments to authenticated;
grant SELECT on public.appointments to authenticated;
grant TRIGGER on public.appointments to authenticated;
grant TRUNCATE on public.appointments to authenticated;
grant UPDATE on public.appointments to authenticated;
grant DELETE on public.appointments to service_role;
grant INSERT on public.appointments to service_role;
grant REFERENCES on public.appointments to service_role;
grant SELECT on public.appointments to service_role;
grant TRIGGER on public.appointments to service_role;
grant TRUNCATE on public.appointments to service_role;
grant UPDATE on public.appointments to service_role;
grant DELETE on public.campaign_knowledge_base to anon;
grant INSERT on public.campaign_knowledge_base to anon;
grant REFERENCES on public.campaign_knowledge_base to anon;
grant SELECT on public.campaign_knowledge_base to anon;
grant TRIGGER on public.campaign_knowledge_base to anon;
grant TRUNCATE on public.campaign_knowledge_base to anon;
grant UPDATE on public.campaign_knowledge_base to anon;
grant DELETE on public.campaign_knowledge_base to authenticated;
grant INSERT on public.campaign_knowledge_base to authenticated;
grant REFERENCES on public.campaign_knowledge_base to authenticated;
grant SELECT on public.campaign_knowledge_base to authenticated;
grant TRIGGER on public.campaign_knowledge_base to authenticated;
grant TRUNCATE on public.campaign_knowledge_base to authenticated;
grant UPDATE on public.campaign_knowledge_base to authenticated;
grant DELETE on public.campaign_knowledge_base to service_role;
grant INSERT on public.campaign_knowledge_base to service_role;
grant REFERENCES on public.campaign_knowledge_base to service_role;
grant SELECT on public.campaign_knowledge_base to service_role;
grant TRIGGER on public.campaign_knowledge_base to service_role;
grant TRUNCATE on public.campaign_knowledge_base to service_role;
grant UPDATE on public.campaign_knowledge_base to service_role;
grant DELETE on public.campaign_lead_assignments to anon;
grant INSERT on public.campaign_lead_assignments to anon;
grant REFERENCES on public.campaign_lead_assignments to anon;
grant SELECT on public.campaign_lead_assignments to anon;
grant TRIGGER on public.campaign_lead_assignments to anon;
grant TRUNCATE on public.campaign_lead_assignments to anon;
grant UPDATE on public.campaign_lead_assignments to anon;
grant DELETE on public.campaign_lead_assignments to authenticated;
grant INSERT on public.campaign_lead_assignments to authenticated;
grant REFERENCES on public.campaign_lead_assignments to authenticated;
grant SELECT on public.campaign_lead_assignments to authenticated;
grant TRIGGER on public.campaign_lead_assignments to authenticated;
grant TRUNCATE on public.campaign_lead_assignments to authenticated;
grant UPDATE on public.campaign_lead_assignments to authenticated;
grant DELETE on public.campaign_lead_assignments to service_role;
grant INSERT on public.campaign_lead_assignments to service_role;
grant REFERENCES on public.campaign_lead_assignments to service_role;
grant SELECT on public.campaign_lead_assignments to service_role;
grant TRIGGER on public.campaign_lead_assignments to service_role;
grant TRUNCATE on public.campaign_lead_assignments to service_role;
grant UPDATE on public.campaign_lead_assignments to service_role;
grant DELETE on public.campaign_prompt_backup_20260807 to service_role;
grant INSERT on public.campaign_prompt_backup_20260807 to service_role;
grant REFERENCES on public.campaign_prompt_backup_20260807 to service_role;
grant SELECT on public.campaign_prompt_backup_20260807 to service_role;
grant TRIGGER on public.campaign_prompt_backup_20260807 to service_role;
grant TRUNCATE on public.campaign_prompt_backup_20260807 to service_role;
grant UPDATE on public.campaign_prompt_backup_20260807 to service_role;
grant DELETE on public.campaign_prompt_backup_20260809 to service_role;
grant INSERT on public.campaign_prompt_backup_20260809 to service_role;
grant REFERENCES on public.campaign_prompt_backup_20260809 to service_role;
grant SELECT on public.campaign_prompt_backup_20260809 to service_role;
grant TRIGGER on public.campaign_prompt_backup_20260809 to service_role;
grant TRUNCATE on public.campaign_prompt_backup_20260809 to service_role;
grant UPDATE on public.campaign_prompt_backup_20260809 to service_role;
grant DELETE on public.campaign_requests to anon;
grant INSERT on public.campaign_requests to anon;
grant REFERENCES on public.campaign_requests to anon;
grant SELECT on public.campaign_requests to anon;
grant TRIGGER on public.campaign_requests to anon;
grant TRUNCATE on public.campaign_requests to anon;
grant UPDATE on public.campaign_requests to anon;
grant DELETE on public.campaign_requests to authenticated;
grant INSERT on public.campaign_requests to authenticated;
grant REFERENCES on public.campaign_requests to authenticated;
grant SELECT on public.campaign_requests to authenticated;
grant TRIGGER on public.campaign_requests to authenticated;
grant TRUNCATE on public.campaign_requests to authenticated;
grant UPDATE on public.campaign_requests to authenticated;
grant DELETE on public.campaign_requests to service_role;
grant INSERT on public.campaign_requests to service_role;
grant REFERENCES on public.campaign_requests to service_role;
grant SELECT on public.campaign_requests to service_role;
grant TRIGGER on public.campaign_requests to service_role;
grant TRUNCATE on public.campaign_requests to service_role;
grant UPDATE on public.campaign_requests to service_role;
grant DELETE on public.campaign_steps to anon;
grant INSERT on public.campaign_steps to anon;
grant REFERENCES on public.campaign_steps to anon;
grant SELECT on public.campaign_steps to anon;
grant TRIGGER on public.campaign_steps to anon;
grant TRUNCATE on public.campaign_steps to anon;
grant UPDATE on public.campaign_steps to anon;
grant DELETE on public.campaign_steps to authenticated;
grant INSERT on public.campaign_steps to authenticated;
grant REFERENCES on public.campaign_steps to authenticated;
grant SELECT on public.campaign_steps to authenticated;
grant TRIGGER on public.campaign_steps to authenticated;
grant TRUNCATE on public.campaign_steps to authenticated;
grant UPDATE on public.campaign_steps to authenticated;
grant DELETE on public.campaign_steps to service_role;
grant INSERT on public.campaign_steps to service_role;
grant REFERENCES on public.campaign_steps to service_role;
grant SELECT on public.campaign_steps to service_role;
grant TRIGGER on public.campaign_steps to service_role;
grant TRUNCATE on public.campaign_steps to service_role;
grant UPDATE on public.campaign_steps to service_role;
grant DELETE on public.campaigns to anon;
grant INSERT on public.campaigns to anon;
grant REFERENCES on public.campaigns to anon;
grant SELECT on public.campaigns to anon;
grant TRIGGER on public.campaigns to anon;
grant TRUNCATE on public.campaigns to anon;
grant UPDATE on public.campaigns to anon;
grant DELETE on public.campaigns to authenticated;
grant INSERT on public.campaigns to authenticated;
grant REFERENCES on public.campaigns to authenticated;
grant SELECT on public.campaigns to authenticated;
grant TRIGGER on public.campaigns to authenticated;
grant TRUNCATE on public.campaigns to authenticated;
grant UPDATE on public.campaigns to authenticated;
grant DELETE on public.campaigns to service_role;
grant INSERT on public.campaigns to service_role;
grant REFERENCES on public.campaigns to service_role;
grant SELECT on public.campaigns to service_role;
grant TRIGGER on public.campaigns to service_role;
grant TRUNCATE on public.campaigns to service_role;
grant UPDATE on public.campaigns to service_role;
grant DELETE on public.client_assets to anon;
grant INSERT on public.client_assets to anon;
grant REFERENCES on public.client_assets to anon;
grant SELECT on public.client_assets to anon;
grant TRIGGER on public.client_assets to anon;
grant TRUNCATE on public.client_assets to anon;
grant UPDATE on public.client_assets to anon;
grant DELETE on public.client_assets to authenticated;
grant INSERT on public.client_assets to authenticated;
grant REFERENCES on public.client_assets to authenticated;
grant SELECT on public.client_assets to authenticated;
grant TRIGGER on public.client_assets to authenticated;
grant TRUNCATE on public.client_assets to authenticated;
grant UPDATE on public.client_assets to authenticated;
grant DELETE on public.client_assets to service_role;
grant INSERT on public.client_assets to service_role;
grant REFERENCES on public.client_assets to service_role;
grant SELECT on public.client_assets to service_role;
grant TRIGGER on public.client_assets to service_role;
grant TRUNCATE on public.client_assets to service_role;
grant UPDATE on public.client_assets to service_role;
grant DELETE on public.client_campaigns to anon;
grant INSERT on public.client_campaigns to anon;
grant REFERENCES on public.client_campaigns to anon;
grant SELECT on public.client_campaigns to anon;
grant TRIGGER on public.client_campaigns to anon;
grant TRUNCATE on public.client_campaigns to anon;
grant UPDATE on public.client_campaigns to anon;
grant DELETE on public.client_campaigns to authenticated;
grant INSERT on public.client_campaigns to authenticated;
grant REFERENCES on public.client_campaigns to authenticated;
grant SELECT on public.client_campaigns to authenticated;
grant TRIGGER on public.client_campaigns to authenticated;
grant TRUNCATE on public.client_campaigns to authenticated;
grant UPDATE on public.client_campaigns to authenticated;
grant DELETE on public.client_campaigns to service_role;
grant INSERT on public.client_campaigns to service_role;
grant REFERENCES on public.client_campaigns to service_role;
grant SELECT on public.client_campaigns to service_role;
grant TRIGGER on public.client_campaigns to service_role;
grant TRUNCATE on public.client_campaigns to service_role;
grant UPDATE on public.client_campaigns to service_role;
grant DELETE on public.client_onboarding to anon;
grant INSERT on public.client_onboarding to anon;
grant REFERENCES on public.client_onboarding to anon;
grant SELECT on public.client_onboarding to anon;
grant TRIGGER on public.client_onboarding to anon;
grant TRUNCATE on public.client_onboarding to anon;
grant UPDATE on public.client_onboarding to anon;
grant DELETE on public.client_onboarding to authenticated;
grant INSERT on public.client_onboarding to authenticated;
grant REFERENCES on public.client_onboarding to authenticated;
grant SELECT on public.client_onboarding to authenticated;
grant TRIGGER on public.client_onboarding to authenticated;
grant TRUNCATE on public.client_onboarding to authenticated;
grant UPDATE on public.client_onboarding to authenticated;
grant DELETE on public.client_onboarding to service_role;
grant INSERT on public.client_onboarding to service_role;
grant REFERENCES on public.client_onboarding to service_role;
grant SELECT on public.client_onboarding to service_role;
grant TRIGGER on public.client_onboarding to service_role;
grant TRUNCATE on public.client_onboarding to service_role;
grant UPDATE on public.client_onboarding to service_role;
grant DELETE on public.client_reference_documents to anon;
grant INSERT on public.client_reference_documents to anon;
grant REFERENCES on public.client_reference_documents to anon;
grant SELECT on public.client_reference_documents to anon;
grant TRIGGER on public.client_reference_documents to anon;
grant TRUNCATE on public.client_reference_documents to anon;
grant UPDATE on public.client_reference_documents to anon;
grant DELETE on public.client_reference_documents to authenticated;
grant INSERT on public.client_reference_documents to authenticated;
grant REFERENCES on public.client_reference_documents to authenticated;
grant SELECT on public.client_reference_documents to authenticated;
grant TRIGGER on public.client_reference_documents to authenticated;
grant TRUNCATE on public.client_reference_documents to authenticated;
grant UPDATE on public.client_reference_documents to authenticated;
grant DELETE on public.client_reference_documents to service_role;
grant INSERT on public.client_reference_documents to service_role;
grant REFERENCES on public.client_reference_documents to service_role;
grant SELECT on public.client_reference_documents to service_role;
grant TRIGGER on public.client_reference_documents to service_role;
grant TRUNCATE on public.client_reference_documents to service_role;
grant UPDATE on public.client_reference_documents to service_role;
grant DELETE on public.clients to anon;
grant INSERT on public.clients to anon;
grant REFERENCES on public.clients to anon;
grant SELECT on public.clients to anon;
grant TRIGGER on public.clients to anon;
grant TRUNCATE on public.clients to anon;
grant UPDATE on public.clients to anon;
grant DELETE on public.clients to authenticated;
grant INSERT on public.clients to authenticated;
grant REFERENCES on public.clients to authenticated;
grant SELECT on public.clients to authenticated;
grant TRIGGER on public.clients to authenticated;
grant TRUNCATE on public.clients to authenticated;
grant UPDATE on public.clients to authenticated;
grant DELETE on public.clients to service_role;
grant INSERT on public.clients to service_role;
grant REFERENCES on public.clients to service_role;
grant SELECT on public.clients to service_role;
grant TRIGGER on public.clients to service_role;
grant TRUNCATE on public.clients to service_role;
grant UPDATE on public.clients to service_role;
grant DELETE on public.conversations to anon;
grant INSERT on public.conversations to anon;
grant REFERENCES on public.conversations to anon;
grant SELECT on public.conversations to anon;
grant TRIGGER on public.conversations to anon;
grant TRUNCATE on public.conversations to anon;
grant UPDATE on public.conversations to anon;
grant DELETE on public.conversations to authenticated;
grant INSERT on public.conversations to authenticated;
grant REFERENCES on public.conversations to authenticated;
grant SELECT on public.conversations to authenticated;
grant TRIGGER on public.conversations to authenticated;
grant TRUNCATE on public.conversations to authenticated;
grant UPDATE on public.conversations to authenticated;
grant DELETE on public.conversations to service_role;
grant INSERT on public.conversations to service_role;
grant REFERENCES on public.conversations to service_role;
grant SELECT on public.conversations to service_role;
grant TRIGGER on public.conversations to service_role;
grant TRUNCATE on public.conversations to service_role;
grant UPDATE on public.conversations to service_role;
grant DELETE on public.creative_jobs to anon;
grant INSERT on public.creative_jobs to anon;
grant REFERENCES on public.creative_jobs to anon;
grant SELECT on public.creative_jobs to anon;
grant TRIGGER on public.creative_jobs to anon;
grant TRUNCATE on public.creative_jobs to anon;
grant UPDATE on public.creative_jobs to anon;
grant DELETE on public.creative_jobs to authenticated;
grant INSERT on public.creative_jobs to authenticated;
grant REFERENCES on public.creative_jobs to authenticated;
grant SELECT on public.creative_jobs to authenticated;
grant TRIGGER on public.creative_jobs to authenticated;
grant TRUNCATE on public.creative_jobs to authenticated;
grant UPDATE on public.creative_jobs to authenticated;
grant DELETE on public.creative_jobs to service_role;
grant INSERT on public.creative_jobs to service_role;
grant REFERENCES on public.creative_jobs to service_role;
grant SELECT on public.creative_jobs to service_role;
grant TRIGGER on public.creative_jobs to service_role;
grant TRUNCATE on public.creative_jobs to service_role;
grant UPDATE on public.creative_jobs to service_role;
grant DELETE on public.creative_prompts to anon;
grant INSERT on public.creative_prompts to anon;
grant REFERENCES on public.creative_prompts to anon;
grant SELECT on public.creative_prompts to anon;
grant TRIGGER on public.creative_prompts to anon;
grant TRUNCATE on public.creative_prompts to anon;
grant UPDATE on public.creative_prompts to anon;
grant DELETE on public.creative_prompts to authenticated;
grant INSERT on public.creative_prompts to authenticated;
grant REFERENCES on public.creative_prompts to authenticated;
grant SELECT on public.creative_prompts to authenticated;
grant TRIGGER on public.creative_prompts to authenticated;
grant TRUNCATE on public.creative_prompts to authenticated;
grant UPDATE on public.creative_prompts to authenticated;
grant DELETE on public.creative_prompts to service_role;
grant INSERT on public.creative_prompts to service_role;
grant REFERENCES on public.creative_prompts to service_role;
grant SELECT on public.creative_prompts to service_role;
grant TRIGGER on public.creative_prompts to service_role;
grant TRUNCATE on public.creative_prompts to service_role;
grant UPDATE on public.creative_prompts to service_role;
grant DELETE on public.creatives to anon;
grant INSERT on public.creatives to anon;
grant REFERENCES on public.creatives to anon;
grant SELECT on public.creatives to anon;
grant TRIGGER on public.creatives to anon;
grant TRUNCATE on public.creatives to anon;
grant UPDATE on public.creatives to anon;
grant DELETE on public.creatives to authenticated;
grant INSERT on public.creatives to authenticated;
grant REFERENCES on public.creatives to authenticated;
grant SELECT on public.creatives to authenticated;
grant TRIGGER on public.creatives to authenticated;
grant TRUNCATE on public.creatives to authenticated;
grant UPDATE on public.creatives to authenticated;
grant DELETE on public.creatives to service_role;
grant INSERT on public.creatives to service_role;
grant REFERENCES on public.creatives to service_role;
grant SELECT on public.creatives to service_role;
grant TRIGGER on public.creatives to service_role;
grant TRUNCATE on public.creatives to service_role;
grant UPDATE on public.creatives to service_role;
grant DELETE on public.daily_digests to anon;
grant INSERT on public.daily_digests to anon;
grant REFERENCES on public.daily_digests to anon;
grant SELECT on public.daily_digests to anon;
grant TRIGGER on public.daily_digests to anon;
grant TRUNCATE on public.daily_digests to anon;
grant UPDATE on public.daily_digests to anon;
grant DELETE on public.daily_digests to authenticated;
grant INSERT on public.daily_digests to authenticated;
grant REFERENCES on public.daily_digests to authenticated;
grant SELECT on public.daily_digests to authenticated;
grant TRIGGER on public.daily_digests to authenticated;
grant TRUNCATE on public.daily_digests to authenticated;
grant UPDATE on public.daily_digests to authenticated;
grant DELETE on public.daily_digests to service_role;
grant INSERT on public.daily_digests to service_role;
grant REFERENCES on public.daily_digests to service_role;
grant SELECT on public.daily_digests to service_role;
grant TRIGGER on public.daily_digests to service_role;
grant TRUNCATE on public.daily_digests to service_role;
grant UPDATE on public.daily_digests to service_role;
grant DELETE on public.email_templates to anon;
grant INSERT on public.email_templates to anon;
grant REFERENCES on public.email_templates to anon;
grant SELECT on public.email_templates to anon;
grant TRIGGER on public.email_templates to anon;
grant TRUNCATE on public.email_templates to anon;
grant UPDATE on public.email_templates to anon;
grant DELETE on public.email_templates to authenticated;
grant INSERT on public.email_templates to authenticated;
grant REFERENCES on public.email_templates to authenticated;
grant SELECT on public.email_templates to authenticated;
grant TRIGGER on public.email_templates to authenticated;
grant TRUNCATE on public.email_templates to authenticated;
grant UPDATE on public.email_templates to authenticated;
grant DELETE on public.email_templates to service_role;
grant INSERT on public.email_templates to service_role;
grant REFERENCES on public.email_templates to service_role;
grant SELECT on public.email_templates to service_role;
grant TRIGGER on public.email_templates to service_role;
grant TRUNCATE on public.email_templates to service_role;
grant UPDATE on public.email_templates to service_role;
grant DELETE on public.enrollment_rules to anon;
grant INSERT on public.enrollment_rules to anon;
grant REFERENCES on public.enrollment_rules to anon;
grant SELECT on public.enrollment_rules to anon;
grant TRIGGER on public.enrollment_rules to anon;
grant TRUNCATE on public.enrollment_rules to anon;
grant UPDATE on public.enrollment_rules to anon;
grant DELETE on public.enrollment_rules to authenticated;
grant INSERT on public.enrollment_rules to authenticated;
grant REFERENCES on public.enrollment_rules to authenticated;
grant SELECT on public.enrollment_rules to authenticated;
grant TRIGGER on public.enrollment_rules to authenticated;
grant TRUNCATE on public.enrollment_rules to authenticated;
grant UPDATE on public.enrollment_rules to authenticated;
grant DELETE on public.enrollment_rules to service_role;
grant INSERT on public.enrollment_rules to service_role;
grant REFERENCES on public.enrollment_rules to service_role;
grant SELECT on public.enrollment_rules to service_role;
grant TRIGGER on public.enrollment_rules to service_role;
grant TRUNCATE on public.enrollment_rules to service_role;
grant UPDATE on public.enrollment_rules to service_role;
grant DELETE on public.follow_up_decisions to anon;
grant INSERT on public.follow_up_decisions to anon;
grant REFERENCES on public.follow_up_decisions to anon;
grant SELECT on public.follow_up_decisions to anon;
grant TRIGGER on public.follow_up_decisions to anon;
grant TRUNCATE on public.follow_up_decisions to anon;
grant UPDATE on public.follow_up_decisions to anon;
grant DELETE on public.follow_up_decisions to authenticated;
grant INSERT on public.follow_up_decisions to authenticated;
grant REFERENCES on public.follow_up_decisions to authenticated;
grant SELECT on public.follow_up_decisions to authenticated;
grant TRIGGER on public.follow_up_decisions to authenticated;
grant TRUNCATE on public.follow_up_decisions to authenticated;
grant UPDATE on public.follow_up_decisions to authenticated;
grant DELETE on public.follow_up_decisions to service_role;
grant INSERT on public.follow_up_decisions to service_role;
grant REFERENCES on public.follow_up_decisions to service_role;
grant SELECT on public.follow_up_decisions to service_role;
grant TRIGGER on public.follow_up_decisions to service_role;
grant TRUNCATE on public.follow_up_decisions to service_role;
grant UPDATE on public.follow_up_decisions to service_role;
grant DELETE on public.followup_requests to anon;
grant INSERT on public.followup_requests to anon;
grant REFERENCES on public.followup_requests to anon;
grant SELECT on public.followup_requests to anon;
grant TRIGGER on public.followup_requests to anon;
grant TRUNCATE on public.followup_requests to anon;
grant UPDATE on public.followup_requests to anon;
grant DELETE on public.followup_requests to authenticated;
grant INSERT on public.followup_requests to authenticated;
grant REFERENCES on public.followup_requests to authenticated;
grant SELECT on public.followup_requests to authenticated;
grant TRIGGER on public.followup_requests to authenticated;
grant TRUNCATE on public.followup_requests to authenticated;
grant UPDATE on public.followup_requests to authenticated;
grant DELETE on public.followup_requests to service_role;
grant INSERT on public.followup_requests to service_role;
grant REFERENCES on public.followup_requests to service_role;
grant SELECT on public.followup_requests to service_role;
grant TRIGGER on public.followup_requests to service_role;
grant TRUNCATE on public.followup_requests to service_role;
grant UPDATE on public.followup_requests to service_role;
grant DELETE on public.kb_chunks to anon;
grant INSERT on public.kb_chunks to anon;
grant REFERENCES on public.kb_chunks to anon;
grant SELECT on public.kb_chunks to anon;
grant TRIGGER on public.kb_chunks to anon;
grant TRUNCATE on public.kb_chunks to anon;
grant UPDATE on public.kb_chunks to anon;
grant DELETE on public.kb_chunks to authenticated;
grant INSERT on public.kb_chunks to authenticated;
grant REFERENCES on public.kb_chunks to authenticated;
grant SELECT on public.kb_chunks to authenticated;
grant TRIGGER on public.kb_chunks to authenticated;
grant TRUNCATE on public.kb_chunks to authenticated;
grant UPDATE on public.kb_chunks to authenticated;
grant DELETE on public.kb_chunks to service_role;
grant INSERT on public.kb_chunks to service_role;
grant REFERENCES on public.kb_chunks to service_role;
grant SELECT on public.kb_chunks to service_role;
grant TRIGGER on public.kb_chunks to service_role;
grant TRUNCATE on public.kb_chunks to service_role;
grant UPDATE on public.kb_chunks to service_role;
grant DELETE on public.kb_documents to anon;
grant INSERT on public.kb_documents to anon;
grant REFERENCES on public.kb_documents to anon;
grant SELECT on public.kb_documents to anon;
grant TRIGGER on public.kb_documents to anon;
grant TRUNCATE on public.kb_documents to anon;
grant UPDATE on public.kb_documents to anon;
grant DELETE on public.kb_documents to authenticated;
grant INSERT on public.kb_documents to authenticated;
grant REFERENCES on public.kb_documents to authenticated;
grant SELECT on public.kb_documents to authenticated;
grant TRIGGER on public.kb_documents to authenticated;
grant TRUNCATE on public.kb_documents to authenticated;
grant UPDATE on public.kb_documents to authenticated;
grant DELETE on public.kb_documents to service_role;
grant INSERT on public.kb_documents to service_role;
grant REFERENCES on public.kb_documents to service_role;
grant SELECT on public.kb_documents to service_role;
grant TRIGGER on public.kb_documents to service_role;
grant TRUNCATE on public.kb_documents to service_role;
grant UPDATE on public.kb_documents to service_role;
grant DELETE on public.lead_alert_emails to service_role;
grant INSERT on public.lead_alert_emails to service_role;
grant REFERENCES on public.lead_alert_emails to service_role;
grant SELECT on public.lead_alert_emails to service_role;
grant TRIGGER on public.lead_alert_emails to service_role;
grant TRUNCATE on public.lead_alert_emails to service_role;
grant UPDATE on public.lead_alert_emails to service_role;
grant DELETE on public.lead_assignment_events to anon;
grant INSERT on public.lead_assignment_events to anon;
grant REFERENCES on public.lead_assignment_events to anon;
grant SELECT on public.lead_assignment_events to anon;
grant TRIGGER on public.lead_assignment_events to anon;
grant TRUNCATE on public.lead_assignment_events to anon;
grant UPDATE on public.lead_assignment_events to anon;
grant DELETE on public.lead_assignment_events to authenticated;
grant INSERT on public.lead_assignment_events to authenticated;
grant REFERENCES on public.lead_assignment_events to authenticated;
grant SELECT on public.lead_assignment_events to authenticated;
grant TRIGGER on public.lead_assignment_events to authenticated;
grant TRUNCATE on public.lead_assignment_events to authenticated;
grant UPDATE on public.lead_assignment_events to authenticated;
grant DELETE on public.lead_assignment_events to service_role;
grant INSERT on public.lead_assignment_events to service_role;
grant REFERENCES on public.lead_assignment_events to service_role;
grant SELECT on public.lead_assignment_events to service_role;
grant TRIGGER on public.lead_assignment_events to service_role;
grant TRUNCATE on public.lead_assignment_events to service_role;
grant UPDATE on public.lead_assignment_events to service_role;
grant DELETE on public.lead_assignment_pool to anon;
grant INSERT on public.lead_assignment_pool to anon;
grant REFERENCES on public.lead_assignment_pool to anon;
grant SELECT on public.lead_assignment_pool to anon;
grant TRIGGER on public.lead_assignment_pool to anon;
grant TRUNCATE on public.lead_assignment_pool to anon;
grant UPDATE on public.lead_assignment_pool to anon;
grant DELETE on public.lead_assignment_pool to authenticated;
grant INSERT on public.lead_assignment_pool to authenticated;
grant REFERENCES on public.lead_assignment_pool to authenticated;
grant SELECT on public.lead_assignment_pool to authenticated;
grant TRIGGER on public.lead_assignment_pool to authenticated;
grant TRUNCATE on public.lead_assignment_pool to authenticated;
grant UPDATE on public.lead_assignment_pool to authenticated;
grant DELETE on public.lead_assignment_pool to service_role;
grant INSERT on public.lead_assignment_pool to service_role;
grant REFERENCES on public.lead_assignment_pool to service_role;
grant SELECT on public.lead_assignment_pool to service_role;
grant TRIGGER on public.lead_assignment_pool to service_role;
grant TRUNCATE on public.lead_assignment_pool to service_role;
grant UPDATE on public.lead_assignment_pool to service_role;
grant DELETE on public.lead_campaign_states to anon;
grant INSERT on public.lead_campaign_states to anon;
grant REFERENCES on public.lead_campaign_states to anon;
grant SELECT on public.lead_campaign_states to anon;
grant TRIGGER on public.lead_campaign_states to anon;
grant TRUNCATE on public.lead_campaign_states to anon;
grant UPDATE on public.lead_campaign_states to anon;
grant DELETE on public.lead_campaign_states to authenticated;
grant INSERT on public.lead_campaign_states to authenticated;
grant REFERENCES on public.lead_campaign_states to authenticated;
grant SELECT on public.lead_campaign_states to authenticated;
grant TRIGGER on public.lead_campaign_states to authenticated;
grant TRUNCATE on public.lead_campaign_states to authenticated;
grant UPDATE on public.lead_campaign_states to authenticated;
grant DELETE on public.lead_campaign_states to service_role;
grant INSERT on public.lead_campaign_states to service_role;
grant REFERENCES on public.lead_campaign_states to service_role;
grant SELECT on public.lead_campaign_states to service_role;
grant TRIGGER on public.lead_campaign_states to service_role;
grant TRUNCATE on public.lead_campaign_states to service_role;
grant UPDATE on public.lead_campaign_states to service_role;
grant DELETE on public.lead_memory to anon;
grant INSERT on public.lead_memory to anon;
grant REFERENCES on public.lead_memory to anon;
grant SELECT on public.lead_memory to anon;
grant TRIGGER on public.lead_memory to anon;
grant TRUNCATE on public.lead_memory to anon;
grant UPDATE on public.lead_memory to anon;
grant DELETE on public.lead_memory to authenticated;
grant INSERT on public.lead_memory to authenticated;
grant REFERENCES on public.lead_memory to authenticated;
grant SELECT on public.lead_memory to authenticated;
grant TRIGGER on public.lead_memory to authenticated;
grant TRUNCATE on public.lead_memory to authenticated;
grant UPDATE on public.lead_memory to authenticated;
grant DELETE on public.lead_memory to service_role;
grant INSERT on public.lead_memory to service_role;
grant REFERENCES on public.lead_memory to service_role;
grant SELECT on public.lead_memory to service_role;
grant TRIGGER on public.lead_memory to service_role;
grant TRUNCATE on public.lead_memory to service_role;
grant UPDATE on public.lead_memory to service_role;
grant DELETE on public.lead_notes to anon;
grant INSERT on public.lead_notes to anon;
grant REFERENCES on public.lead_notes to anon;
grant SELECT on public.lead_notes to anon;
grant TRIGGER on public.lead_notes to anon;
grant TRUNCATE on public.lead_notes to anon;
grant UPDATE on public.lead_notes to anon;
grant DELETE on public.lead_notes to authenticated;
grant INSERT on public.lead_notes to authenticated;
grant REFERENCES on public.lead_notes to authenticated;
grant SELECT on public.lead_notes to authenticated;
grant TRIGGER on public.lead_notes to authenticated;
grant TRUNCATE on public.lead_notes to authenticated;
grant UPDATE on public.lead_notes to authenticated;
grant DELETE on public.lead_notes to service_role;
grant INSERT on public.lead_notes to service_role;
grant REFERENCES on public.lead_notes to service_role;
grant SELECT on public.lead_notes to service_role;
grant TRIGGER on public.lead_notes to service_role;
grant TRUNCATE on public.lead_notes to service_role;
grant UPDATE on public.lead_notes to service_role;
grant DELETE on public.lead_qualifications to anon;
grant INSERT on public.lead_qualifications to anon;
grant REFERENCES on public.lead_qualifications to anon;
grant SELECT on public.lead_qualifications to anon;
grant TRIGGER on public.lead_qualifications to anon;
grant TRUNCATE on public.lead_qualifications to anon;
grant UPDATE on public.lead_qualifications to anon;
grant DELETE on public.lead_qualifications to authenticated;
grant INSERT on public.lead_qualifications to authenticated;
grant REFERENCES on public.lead_qualifications to authenticated;
grant SELECT on public.lead_qualifications to authenticated;
grant TRIGGER on public.lead_qualifications to authenticated;
grant TRUNCATE on public.lead_qualifications to authenticated;
grant UPDATE on public.lead_qualifications to authenticated;
grant DELETE on public.lead_qualifications to service_role;
grant INSERT on public.lead_qualifications to service_role;
grant REFERENCES on public.lead_qualifications to service_role;
grant SELECT on public.lead_qualifications to service_role;
grant TRIGGER on public.lead_qualifications to service_role;
grant TRUNCATE on public.lead_qualifications to service_role;
grant UPDATE on public.lead_qualifications to service_role;
grant DELETE on public.lead_temperature_events to anon;
grant INSERT on public.lead_temperature_events to anon;
grant REFERENCES on public.lead_temperature_events to anon;
grant SELECT on public.lead_temperature_events to anon;
grant TRIGGER on public.lead_temperature_events to anon;
grant TRUNCATE on public.lead_temperature_events to anon;
grant UPDATE on public.lead_temperature_events to anon;
grant DELETE on public.lead_temperature_events to authenticated;
grant INSERT on public.lead_temperature_events to authenticated;
grant REFERENCES on public.lead_temperature_events to authenticated;
grant SELECT on public.lead_temperature_events to authenticated;
grant TRIGGER on public.lead_temperature_events to authenticated;
grant TRUNCATE on public.lead_temperature_events to authenticated;
grant UPDATE on public.lead_temperature_events to authenticated;
grant DELETE on public.lead_temperature_events to service_role;
grant INSERT on public.lead_temperature_events to service_role;
grant REFERENCES on public.lead_temperature_events to service_role;
grant SELECT on public.lead_temperature_events to service_role;
grant TRIGGER on public.lead_temperature_events to service_role;
grant TRUNCATE on public.lead_temperature_events to service_role;
grant UPDATE on public.lead_temperature_events to service_role;
grant DELETE on public.leads to anon;
grant INSERT on public.leads to anon;
grant REFERENCES on public.leads to anon;
grant SELECT on public.leads to anon;
grant TRIGGER on public.leads to anon;
grant TRUNCATE on public.leads to anon;
grant UPDATE on public.leads to anon;
grant DELETE on public.leads to authenticated;
grant INSERT on public.leads to authenticated;
grant REFERENCES on public.leads to authenticated;
grant SELECT on public.leads to authenticated;
grant TRIGGER on public.leads to authenticated;
grant TRUNCATE on public.leads to authenticated;
grant UPDATE on public.leads to authenticated;
grant DELETE on public.leads to service_role;
grant INSERT on public.leads to service_role;
grant REFERENCES on public.leads to service_role;
grant SELECT on public.leads to service_role;
grant TRIGGER on public.leads to service_role;
grant TRUNCATE on public.leads to service_role;
grant UPDATE on public.leads to service_role;
grant DELETE on public.message_templates to anon;
grant INSERT on public.message_templates to anon;
grant REFERENCES on public.message_templates to anon;
grant SELECT on public.message_templates to anon;
grant TRIGGER on public.message_templates to anon;
grant TRUNCATE on public.message_templates to anon;
grant UPDATE on public.message_templates to anon;
grant DELETE on public.message_templates to authenticated;
grant INSERT on public.message_templates to authenticated;
grant REFERENCES on public.message_templates to authenticated;
grant SELECT on public.message_templates to authenticated;
grant TRIGGER on public.message_templates to authenticated;
grant TRUNCATE on public.message_templates to authenticated;
grant UPDATE on public.message_templates to authenticated;
grant DELETE on public.message_templates to service_role;
grant INSERT on public.message_templates to service_role;
grant REFERENCES on public.message_templates to service_role;
grant SELECT on public.message_templates to service_role;
grant TRIGGER on public.message_templates to service_role;
grant TRUNCATE on public.message_templates to service_role;
grant UPDATE on public.message_templates to service_role;
grant DELETE on public.messenger_referrals to anon;
grant INSERT on public.messenger_referrals to anon;
grant REFERENCES on public.messenger_referrals to anon;
grant SELECT on public.messenger_referrals to anon;
grant TRIGGER on public.messenger_referrals to anon;
grant TRUNCATE on public.messenger_referrals to anon;
grant UPDATE on public.messenger_referrals to anon;
grant DELETE on public.messenger_referrals to authenticated;
grant INSERT on public.messenger_referrals to authenticated;
grant REFERENCES on public.messenger_referrals to authenticated;
grant SELECT on public.messenger_referrals to authenticated;
grant TRIGGER on public.messenger_referrals to authenticated;
grant TRUNCATE on public.messenger_referrals to authenticated;
grant UPDATE on public.messenger_referrals to authenticated;
grant DELETE on public.messenger_referrals to service_role;
grant INSERT on public.messenger_referrals to service_role;
grant REFERENCES on public.messenger_referrals to service_role;
grant SELECT on public.messenger_referrals to service_role;
grant TRIGGER on public.messenger_referrals to service_role;
grant TRUNCATE on public.messenger_referrals to service_role;
grant UPDATE on public.messenger_referrals to service_role;
grant DELETE on public.notification_preferences to anon;
grant INSERT on public.notification_preferences to anon;
grant REFERENCES on public.notification_preferences to anon;
grant SELECT on public.notification_preferences to anon;
grant TRIGGER on public.notification_preferences to anon;
grant TRUNCATE on public.notification_preferences to anon;
grant UPDATE on public.notification_preferences to anon;
grant DELETE on public.notification_preferences to authenticated;
grant INSERT on public.notification_preferences to authenticated;
grant REFERENCES on public.notification_preferences to authenticated;
grant SELECT on public.notification_preferences to authenticated;
grant TRIGGER on public.notification_preferences to authenticated;
grant TRUNCATE on public.notification_preferences to authenticated;
grant UPDATE on public.notification_preferences to authenticated;
grant DELETE on public.notification_preferences to service_role;
grant INSERT on public.notification_preferences to service_role;
grant REFERENCES on public.notification_preferences to service_role;
grant SELECT on public.notification_preferences to service_role;
grant TRIGGER on public.notification_preferences to service_role;
grant TRUNCATE on public.notification_preferences to service_role;
grant UPDATE on public.notification_preferences to service_role;
grant DELETE on public.notifications to anon;
grant INSERT on public.notifications to anon;
grant REFERENCES on public.notifications to anon;
grant SELECT on public.notifications to anon;
grant TRIGGER on public.notifications to anon;
grant TRUNCATE on public.notifications to anon;
grant UPDATE on public.notifications to anon;
grant DELETE on public.notifications to authenticated;
grant INSERT on public.notifications to authenticated;
grant REFERENCES on public.notifications to authenticated;
grant SELECT on public.notifications to authenticated;
grant TRIGGER on public.notifications to authenticated;
grant TRUNCATE on public.notifications to authenticated;
grant UPDATE on public.notifications to authenticated;
grant DELETE on public.notifications to service_role;
grant INSERT on public.notifications to service_role;
grant REFERENCES on public.notifications to service_role;
grant SELECT on public.notifications to service_role;
grant TRIGGER on public.notifications to service_role;
grant TRUNCATE on public.notifications to service_role;
grant UPDATE on public.notifications to service_role;
grant DELETE on public.page_connection_requests to anon;
grant INSERT on public.page_connection_requests to anon;
grant REFERENCES on public.page_connection_requests to anon;
grant SELECT on public.page_connection_requests to anon;
grant TRIGGER on public.page_connection_requests to anon;
grant TRUNCATE on public.page_connection_requests to anon;
grant UPDATE on public.page_connection_requests to anon;
grant DELETE on public.page_connection_requests to authenticated;
grant INSERT on public.page_connection_requests to authenticated;
grant REFERENCES on public.page_connection_requests to authenticated;
grant SELECT on public.page_connection_requests to authenticated;
grant TRIGGER on public.page_connection_requests to authenticated;
grant TRUNCATE on public.page_connection_requests to authenticated;
grant UPDATE on public.page_connection_requests to authenticated;
grant DELETE on public.page_connection_requests to service_role;
grant INSERT on public.page_connection_requests to service_role;
grant REFERENCES on public.page_connection_requests to service_role;
grant SELECT on public.page_connection_requests to service_role;
grant TRIGGER on public.page_connection_requests to service_role;
grant TRUNCATE on public.page_connection_requests to service_role;
grant UPDATE on public.page_connection_requests to service_role;
grant DELETE on public.plan_limits to anon;
grant INSERT on public.plan_limits to anon;
grant REFERENCES on public.plan_limits to anon;
grant SELECT on public.plan_limits to anon;
grant TRIGGER on public.plan_limits to anon;
grant TRUNCATE on public.plan_limits to anon;
grant UPDATE on public.plan_limits to anon;
grant DELETE on public.plan_limits to authenticated;
grant INSERT on public.plan_limits to authenticated;
grant REFERENCES on public.plan_limits to authenticated;
grant SELECT on public.plan_limits to authenticated;
grant TRIGGER on public.plan_limits to authenticated;
grant TRUNCATE on public.plan_limits to authenticated;
grant UPDATE on public.plan_limits to authenticated;
grant DELETE on public.plan_limits to service_role;
grant INSERT on public.plan_limits to service_role;
grant REFERENCES on public.plan_limits to service_role;
grant SELECT on public.plan_limits to service_role;
grant TRIGGER on public.plan_limits to service_role;
grant TRUNCATE on public.plan_limits to service_role;
grant UPDATE on public.plan_limits to service_role;
grant DELETE on public.profiles to anon;
grant INSERT on public.profiles to anon;
grant REFERENCES on public.profiles to anon;
grant SELECT on public.profiles to anon;
grant TRIGGER on public.profiles to anon;
grant TRUNCATE on public.profiles to anon;
grant UPDATE on public.profiles to anon;
grant DELETE on public.profiles to authenticated;
grant INSERT on public.profiles to authenticated;
grant REFERENCES on public.profiles to authenticated;
grant SELECT on public.profiles to authenticated;
grant TRIGGER on public.profiles to authenticated;
grant TRUNCATE on public.profiles to authenticated;
grant UPDATE on public.profiles to authenticated;
grant DELETE on public.profiles to service_role;
grant INSERT on public.profiles to service_role;
grant REFERENCES on public.profiles to service_role;
grant SELECT on public.profiles to service_role;
grant TRIGGER on public.profiles to service_role;
grant TRUNCATE on public.profiles to service_role;
grant UPDATE on public.profiles to service_role;
grant DELETE on public.prompt_templates to anon;
grant INSERT on public.prompt_templates to anon;
grant REFERENCES on public.prompt_templates to anon;
grant SELECT on public.prompt_templates to anon;
grant TRIGGER on public.prompt_templates to anon;
grant TRUNCATE on public.prompt_templates to anon;
grant UPDATE on public.prompt_templates to anon;
grant DELETE on public.prompt_templates to authenticated;
grant INSERT on public.prompt_templates to authenticated;
grant REFERENCES on public.prompt_templates to authenticated;
grant SELECT on public.prompt_templates to authenticated;
grant TRIGGER on public.prompt_templates to authenticated;
grant TRUNCATE on public.prompt_templates to authenticated;
grant UPDATE on public.prompt_templates to authenticated;
grant DELETE on public.prompt_templates to service_role;
grant INSERT on public.prompt_templates to service_role;
grant REFERENCES on public.prompt_templates to service_role;
grant SELECT on public.prompt_templates to service_role;
grant TRIGGER on public.prompt_templates to service_role;
grant TRUNCATE on public.prompt_templates to service_role;
grant UPDATE on public.prompt_templates to service_role;
grant DELETE on public.push_tokens to anon;
grant INSERT on public.push_tokens to anon;
grant REFERENCES on public.push_tokens to anon;
grant SELECT on public.push_tokens to anon;
grant TRIGGER on public.push_tokens to anon;
grant TRUNCATE on public.push_tokens to anon;
grant UPDATE on public.push_tokens to anon;
grant DELETE on public.push_tokens to authenticated;
grant INSERT on public.push_tokens to authenticated;
grant REFERENCES on public.push_tokens to authenticated;
grant SELECT on public.push_tokens to authenticated;
grant TRIGGER on public.push_tokens to authenticated;
grant TRUNCATE on public.push_tokens to authenticated;
grant UPDATE on public.push_tokens to authenticated;
grant DELETE on public.push_tokens to service_role;
grant INSERT on public.push_tokens to service_role;
grant REFERENCES on public.push_tokens to service_role;
grant SELECT on public.push_tokens to service_role;
grant TRIGGER on public.push_tokens to service_role;
grant TRUNCATE on public.push_tokens to service_role;
grant UPDATE on public.push_tokens to service_role;
grant DELETE on public.seq_enroll_backup_20260803 to service_role;
grant INSERT on public.seq_enroll_backup_20260803 to service_role;
grant REFERENCES on public.seq_enroll_backup_20260803 to service_role;
grant SELECT on public.seq_enroll_backup_20260803 to service_role;
grant TRIGGER on public.seq_enroll_backup_20260803 to service_role;
grant TRUNCATE on public.seq_enroll_backup_20260803 to service_role;
grant UPDATE on public.seq_enroll_backup_20260803 to service_role;
grant DELETE on public.sequence_enrollments to anon;
grant INSERT on public.sequence_enrollments to anon;
grant REFERENCES on public.sequence_enrollments to anon;
grant SELECT on public.sequence_enrollments to anon;
grant TRIGGER on public.sequence_enrollments to anon;
grant TRUNCATE on public.sequence_enrollments to anon;
grant UPDATE on public.sequence_enrollments to anon;
grant DELETE on public.sequence_enrollments to authenticated;
grant INSERT on public.sequence_enrollments to authenticated;
grant REFERENCES on public.sequence_enrollments to authenticated;
grant SELECT on public.sequence_enrollments to authenticated;
grant TRIGGER on public.sequence_enrollments to authenticated;
grant TRUNCATE on public.sequence_enrollments to authenticated;
grant UPDATE on public.sequence_enrollments to authenticated;
grant DELETE on public.sequence_enrollments to service_role;
grant INSERT on public.sequence_enrollments to service_role;
grant REFERENCES on public.sequence_enrollments to service_role;
grant SELECT on public.sequence_enrollments to service_role;
grant TRIGGER on public.sequence_enrollments to service_role;
grant TRUNCATE on public.sequence_enrollments to service_role;
grant UPDATE on public.sequence_enrollments to service_role;
grant DELETE on public.sequence_steps to anon;
grant INSERT on public.sequence_steps to anon;
grant REFERENCES on public.sequence_steps to anon;
grant SELECT on public.sequence_steps to anon;
grant TRIGGER on public.sequence_steps to anon;
grant TRUNCATE on public.sequence_steps to anon;
grant UPDATE on public.sequence_steps to anon;
grant DELETE on public.sequence_steps to authenticated;
grant INSERT on public.sequence_steps to authenticated;
grant REFERENCES on public.sequence_steps to authenticated;
grant SELECT on public.sequence_steps to authenticated;
grant TRIGGER on public.sequence_steps to authenticated;
grant TRUNCATE on public.sequence_steps to authenticated;
grant UPDATE on public.sequence_steps to authenticated;
grant DELETE on public.sequence_steps to service_role;
grant INSERT on public.sequence_steps to service_role;
grant REFERENCES on public.sequence_steps to service_role;
grant SELECT on public.sequence_steps to service_role;
grant TRIGGER on public.sequence_steps to service_role;
grant TRUNCATE on public.sequence_steps to service_role;
grant UPDATE on public.sequence_steps to service_role;
grant DELETE on public.sequences to anon;
grant INSERT on public.sequences to anon;
grant REFERENCES on public.sequences to anon;
grant SELECT on public.sequences to anon;
grant TRIGGER on public.sequences to anon;
grant TRUNCATE on public.sequences to anon;
grant UPDATE on public.sequences to anon;
grant DELETE on public.sequences to authenticated;
grant INSERT on public.sequences to authenticated;
grant REFERENCES on public.sequences to authenticated;
grant SELECT on public.sequences to authenticated;
grant TRIGGER on public.sequences to authenticated;
grant TRUNCATE on public.sequences to authenticated;
grant UPDATE on public.sequences to authenticated;
grant DELETE on public.sequences to service_role;
grant INSERT on public.sequences to service_role;
grant REFERENCES on public.sequences to service_role;
grant SELECT on public.sequences to service_role;
grant TRIGGER on public.sequences to service_role;
grant TRUNCATE on public.sequences to service_role;
grant UPDATE on public.sequences to service_role;
grant DELETE on public.social_autopost_plans to anon;
grant INSERT on public.social_autopost_plans to anon;
grant REFERENCES on public.social_autopost_plans to anon;
grant SELECT on public.social_autopost_plans to anon;
grant TRIGGER on public.social_autopost_plans to anon;
grant TRUNCATE on public.social_autopost_plans to anon;
grant UPDATE on public.social_autopost_plans to anon;
grant DELETE on public.social_autopost_plans to authenticated;
grant INSERT on public.social_autopost_plans to authenticated;
grant REFERENCES on public.social_autopost_plans to authenticated;
grant SELECT on public.social_autopost_plans to authenticated;
grant TRIGGER on public.social_autopost_plans to authenticated;
grant TRUNCATE on public.social_autopost_plans to authenticated;
grant UPDATE on public.social_autopost_plans to authenticated;
grant DELETE on public.social_autopost_plans to service_role;
grant INSERT on public.social_autopost_plans to service_role;
grant REFERENCES on public.social_autopost_plans to service_role;
grant SELECT on public.social_autopost_plans to service_role;
grant TRIGGER on public.social_autopost_plans to service_role;
grant TRUNCATE on public.social_autopost_plans to service_role;
grant UPDATE on public.social_autopost_plans to service_role;
grant DELETE on public.subscription_requests to anon;
grant INSERT on public.subscription_requests to anon;
grant REFERENCES on public.subscription_requests to anon;
grant SELECT on public.subscription_requests to anon;
grant TRIGGER on public.subscription_requests to anon;
grant TRUNCATE on public.subscription_requests to anon;
grant UPDATE on public.subscription_requests to anon;
grant DELETE on public.subscription_requests to authenticated;
grant INSERT on public.subscription_requests to authenticated;
grant REFERENCES on public.subscription_requests to authenticated;
grant SELECT on public.subscription_requests to authenticated;
grant TRIGGER on public.subscription_requests to authenticated;
grant TRUNCATE on public.subscription_requests to authenticated;
grant UPDATE on public.subscription_requests to authenticated;
grant DELETE on public.subscription_requests to service_role;
grant INSERT on public.subscription_requests to service_role;
grant REFERENCES on public.subscription_requests to service_role;
grant SELECT on public.subscription_requests to service_role;
grant TRIGGER on public.subscription_requests to service_role;
grant TRUNCATE on public.subscription_requests to service_role;
grant UPDATE on public.subscription_requests to service_role;
grant DELETE on public.tasks to anon;
grant INSERT on public.tasks to anon;
grant REFERENCES on public.tasks to anon;
grant SELECT on public.tasks to anon;
grant TRIGGER on public.tasks to anon;
grant TRUNCATE on public.tasks to anon;
grant UPDATE on public.tasks to anon;
grant DELETE on public.tasks to authenticated;
grant INSERT on public.tasks to authenticated;
grant REFERENCES on public.tasks to authenticated;
grant SELECT on public.tasks to authenticated;
grant TRIGGER on public.tasks to authenticated;
grant TRUNCATE on public.tasks to authenticated;
grant UPDATE on public.tasks to authenticated;
grant DELETE on public.tasks to service_role;
grant INSERT on public.tasks to service_role;
grant REFERENCES on public.tasks to service_role;
grant SELECT on public.tasks to service_role;
grant TRIGGER on public.tasks to service_role;
grant TRUNCATE on public.tasks to service_role;
grant UPDATE on public.tasks to service_role;
grant DELETE on public.user_onboarding_tour to anon;
grant INSERT on public.user_onboarding_tour to anon;
grant REFERENCES on public.user_onboarding_tour to anon;
grant SELECT on public.user_onboarding_tour to anon;
grant TRIGGER on public.user_onboarding_tour to anon;
grant TRUNCATE on public.user_onboarding_tour to anon;
grant UPDATE on public.user_onboarding_tour to anon;
grant DELETE on public.user_onboarding_tour to authenticated;
grant INSERT on public.user_onboarding_tour to authenticated;
grant REFERENCES on public.user_onboarding_tour to authenticated;
grant SELECT on public.user_onboarding_tour to authenticated;
grant TRIGGER on public.user_onboarding_tour to authenticated;
grant TRUNCATE on public.user_onboarding_tour to authenticated;
grant UPDATE on public.user_onboarding_tour to authenticated;
grant DELETE on public.user_onboarding_tour to service_role;
grant INSERT on public.user_onboarding_tour to service_role;
grant REFERENCES on public.user_onboarding_tour to service_role;
grant SELECT on public.user_onboarding_tour to service_role;
grant TRIGGER on public.user_onboarding_tour to service_role;
grant TRUNCATE on public.user_onboarding_tour to service_role;
grant UPDATE on public.user_onboarding_tour to service_role;
grant DELETE on public.video_requests to anon;
grant INSERT on public.video_requests to anon;
grant REFERENCES on public.video_requests to anon;
grant SELECT on public.video_requests to anon;
grant TRIGGER on public.video_requests to anon;
grant TRUNCATE on public.video_requests to anon;
grant UPDATE on public.video_requests to anon;
grant DELETE on public.video_requests to authenticated;
grant INSERT on public.video_requests to authenticated;
grant REFERENCES on public.video_requests to authenticated;
grant SELECT on public.video_requests to authenticated;
grant TRIGGER on public.video_requests to authenticated;
grant TRUNCATE on public.video_requests to authenticated;
grant UPDATE on public.video_requests to authenticated;
grant DELETE on public.video_requests to service_role;
grant INSERT on public.video_requests to service_role;
grant REFERENCES on public.video_requests to service_role;
grant SELECT on public.video_requests to service_role;
grant TRIGGER on public.video_requests to service_role;
grant TRUNCATE on public.video_requests to service_role;
grant UPDATE on public.video_requests to service_role;
grant DELETE on public.webhook_logs to anon;
grant INSERT on public.webhook_logs to anon;
grant REFERENCES on public.webhook_logs to anon;
grant SELECT on public.webhook_logs to anon;
grant TRIGGER on public.webhook_logs to anon;
grant TRUNCATE on public.webhook_logs to anon;
grant UPDATE on public.webhook_logs to anon;
grant DELETE on public.webhook_logs to authenticated;
grant INSERT on public.webhook_logs to authenticated;
grant REFERENCES on public.webhook_logs to authenticated;
grant SELECT on public.webhook_logs to authenticated;
grant TRIGGER on public.webhook_logs to authenticated;
grant TRUNCATE on public.webhook_logs to authenticated;
grant UPDATE on public.webhook_logs to authenticated;
grant DELETE on public.webhook_logs to service_role;
grant INSERT on public.webhook_logs to service_role;
grant REFERENCES on public.webhook_logs to service_role;
grant SELECT on public.webhook_logs to service_role;
grant TRIGGER on public.webhook_logs to service_role;
grant TRUNCATE on public.webhook_logs to service_role;
grant UPDATE on public.webhook_logs to service_role;

-- ===== CRON JOBS =====
-- cron: compute-agent-performance-nightly  schedule=0 18 * * *  active=t
  select cron.schedule('compute-agent-performance-nightly', '0 18 * * *', 'SELECT public.compute_agent_performance_scores()');
-- cron: appointment-reminder-sweep  schedule=*/5 * * * *  active=t
  select cron.schedule('appointment-reminder-sweep', '*/5 * * * *', 'select public.run_appointment_reminders()');
-- cron: push-dispatch-sweep  schedule=*/2 * * * *  active=t
  select cron.schedule('push-dispatch-sweep', '*/2 * * * *', '
  select net.http_post(
    url := ''https://zyfkjxepykwpfzmkxitb.supabase.co/functions/v1/push-dispatch'',
    headers := jsonb_build_object(
      ''Content-Type'',''application/json'',
      ''x-dispatch-secret'', (select decrypted_secret from vault.decrypted_secrets where name=''push_dispatch_secret'')),
    body := ''{}''::jsonb
  );
');
-- cron: tasks-deferred-sweep  schedule=5 16 * * *  active=t
  select cron.schedule('tasks-deferred-sweep', '5 16 * * *', 'select public.run_deferred_task_sweep()');
-- cron: daily-digest-6am-manila  schedule=15 22 * * *  active=t
  select cron.schedule('daily-digest-6am-manila', '15 22 * * *', '
  SELECT net.http_post(
    url := ''https://zyfkjxepykwpfzmkxitb.supabase.co/functions/v1/daily-digest'',
    headers := jsonb_build_object(
      ''Content-Type'',''application/json'',
      ''x-digest-secret'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=''push_dispatch_secret'')),
    body := ''{}''::jsonb);
  ');
-- cron: lead-grade-nightly-recompute  schedule=30 18 * * *  active=t
  select cron.schedule('lead-grade-nightly-recompute', '30 18 * * *', 'select public.recompute_lead_grade()');
