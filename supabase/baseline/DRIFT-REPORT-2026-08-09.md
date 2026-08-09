# Migration drift report - 2026-08-09

Project `zyfkjxepykwpfzmkxitb` (shared CRM + Ads Manager).
Compared: `supabase_migrations.schema_migrations` vs `supabase/migrations/*.sql` across **all** branches.
Names are compared, not timestamps - `apply_migration` assigns its own timestamp, so filenames never match.

| Category | Count |
|---|---|
| Applied in DB, **no file on any branch** | 97 |
| Applied in DB, file on a branch but not on `main` | 9 |
| File on `main`, **never applied** | 11 |

The first group is captured in `20260809_schema_baseline.sql`. Their original SQL is unrecoverable; the baseline records the end state they produced.

## 1. Applied in DB, no file anywhere (97)

Applied directly via dashboard or `apply_migration`. Includes foundational work: the whole creatives module, every mobile-app table, the website admin console, lead assignment, KB source fields, and all recent lead-alert / campaign changes.

- `fix_sync_ckb_campaign_name_guard_new_name`
- `conversations_external_msg_id_unique`
- `creatives_module_tables`
- `creatives_module_rls_triggers`
- `creatives_module_helper_functions`
- `add_agent_photo_url_to_ad_listings`
- `add_follow_up_timestamps`
- `create_follow_up_sequence_schema`
- `create_sequence_enrollments`
- `add_sequence_scheduler_to_tasks_triggered_by`
- `add_quick_replies_to_sequence_steps`
- `extend_last_message_trigger_with_contacted_at`
- `w5_lead_intelligence_governance_columns`
- `normalize_and_guard_lead_temperature`
- `simplify_temperature_trigger_casing_only`
- `add_enrollment_rule_inbound_and_contact_filters`
- `add_sort_params_to_get_leads_with_details`
- `add_lead_quality_fields`
- `update_get_leads_with_details_add_quality`
- `add_timeframe_motivation_to_leads`
- `add_lead_quality_check_constraint`
- `add_quality_and_pipeline_stage_to_enrollment_rules`
- `revoke_anon_from_security_definer_functions`
- `fix_kb_documents_rls_client_scoping`
- `set_search_path_on_public_functions`
- `ads_operator_token_and_client_ad_account`
- `ad_analytics_meta_sync_columns`
- `ad_reports_table`
- `tighten_client_assets_storage_policies`
- `posts_v1_schema_extension`
- `repoint_ad_posts_creative_fk_to_creatives`
- `repoint_ad_campaigns_creative_fk_to_creatives`
- `client_admin_can_read_global_templates`
- `music_tracks_registry_and_template_music_flag`
- `add_license_note_to_music_tracks`
- `make_creative_jobs_job_id_nullable`
- `create_client_reference_documents`
- `fix_security_definer_caller_ownership`
- `add_rls_policies_no_policy_tables`
- `fix_client_assets_public_listing`
- `add_kb_source_fields`
- `compose_kb_content_function`
- `kb_extraction_trigger`
- `add_kb_source_text`
- `fix_get_leads_with_details_ambiguous_col`
- `drop_stale_get_leads_with_details_overloads`
- `fix_kb_client_id_mismatch_mary_ann_test1`
- `reset_lead_b482ce84_conversation_state_v2`
- `overwrite_created_at_lead_b482ce84_test_enrollment`
- `consolidate_message_templates_for_ai_generator`
- `fix_category_goal_constraint_collision`
- `add_last_ai_outbound_at_and_enrollment_filter`
- `allow_bamo_generation_method`
- `create_client_onboarding`
- `client_onboarding_allow_submit_transition`
- `leads_agent_scoped_visibility`
- `agent_listings_table`
- `listing_photos_bucket`
- `appointments_table`
- `agent_websites_table`
- `agent_website_requests_table`
- `agent_documents_table`
- `social_media_mobile_access`
- `social_autopost_plans_table`
- `video_requests_table`
- `subscription_requests_table`
- `ads_management_mobile_access`
- `campaign_requests_table`
- `settings_mobile_access`
- `subscription_requests_processed_audit`
- `ai_followup_engine_fixes`
- `security_hardening_f1_f2_f6_rpc_grants`
- `f3_agent_scope_lead_delete_and_qualifications`
- `f4_ad_posts_member_update`
- `f9_listing_photos_no_public_listing`
- `auto_provision_client_from_tally_onboarding`
- `creatives_refdocs_member_select`
- `leads_index_hygiene`
- `website_admin_console_phase1`
- `website_admin_console_phase2_brief`
- `website_admin_console_phase3_preflight`
- `website_admin_console_phase4_deploy`
- `tenant_scope_listing_photos_and_kb_storage`
- `revoke_public_execute_recompute_lead_grade`
- `idx_conversations_lead_id_direction`
- `bamo_network_v1`
- `bamo_network_v1_fix_admin_rpc_null_role_and_anon_grants`
- `lead_alert_emails_outbox`
- `network_search_professionals`
- `seed_network_professions`
- `add_marketing_media_category`
- `harden_handle_new_user_role_whitelist`
- `network_get_professional`
- `restrict_profiles_insert_to_baymo_admin`
- `network_search_professionals_query`
- `pending_lead_alerts_lead_name_fallback`
- `add_campaign_intro_line`

## 2. Applied in DB, file exists on a branch but not on main (9)

These are live in production while their code sits unmerged - merging the owning branch is what closes the gap.

- `notifications_phase0`
- `handle_new_user_client_admin_role`
- `autoprovision_free_workspace`
- `freemium_plan_limits_and_usage`
- `lead_listing_caps`
- `add_lead_grade`
- `lead_grade_full_missing_list`
- `ai_followup_absolute_ladder_and_no_park_trap`
- `ai_followup_price_guard_terms`

## 3. File on main, never applied (11)

The `migration_<hash>` entries are Softgen-generated baseline files that predate the recorded history - expected. The two named ones are worth a look: `tally_onboarding_autoprovision` is live under a different name (`auto_provision_client_from_tally_onboarding`), i.e. a rename/duplicate.

- `migration_80cb6f8c`
- `migration_7a9acfa2`
- `migration_690848b8`
- `migration_115a97df`
- `migration_4f4a6a1f`
- `migration_d1e68e7e`
- `migration_11a52953`
- `migration_402b335e`
- `migration_7e11d253`
- `add_fb_fields_to_clients`
- `tally_onboarding_autoprovision`

## How this happened, and how to stop it

`CLAUDE.md` already carries the rule: after any direct-in-DB function or schema change, (1) capture it as a migration file and (2) regenerate `database.types.ts`. In practice step 1 was skipped ~97 times and step 2 lapsed for three weeks.

Costs already paid:

- **2026-06-19** - `get_leads_with_details` edited in-DB; committed types showed a 9-arg signature while the live DB had three overloads, one with a `42702` ambiguous-column bug. The drift hid the bug and broke the Leads page.
- **2026-08-09** - `followup_requests.duration_days` / `.style` were typed NOT NULL in the repo but are nullable in the DB. TypeScript vouched for a guarantee the database does not make.
- **2026-08-04** - `push-dispatch` was deployed from source that existed only on one laptop and had never been pushed. Same failure shape, edge-function layer.

Before the marketplace is merged into this project, the drift should stop growing - otherwise the marketplace tables join a schema no one can rebuild.

## Security note found during capture — RESOLVED 2026-08-09

Generating this baseline surfaced a hardcoded credential in a live function body:

- `notify_n8n_kb_ingestion()` embedded a **219-character service_role JWT** as a
  literal `Bearer` token in its `net.http_post` call.

**Removed** from the database in migration
`remove_hardcoded_jwt_from_notify_n8n_kb_ingestion`. The baseline above now
reflects the credential-free version, and a sweep of **every function in every
non-system schema** found no other embedded JWT, `sk-`, or Resend key.

Why removing the header outright was safe rather than reckless:

- `kb_documents` has **never held a row**, so `trg_kb_documents_n8n` — the only
  trigger calling this function — has never fired. Nothing was in flight.
- Legacy anon/service_role JWTs on this project were disabled 2026-08-05, so the
  token was already inert. It was a plaintext credential in a schema dump, not a
  working key.
- `kb-ingestion` runs with `verify_jwt = true`, so this path would 401 either
  way. An unauthenticated call that fails loudly beats a plaintext key that
  quietly does nothing.

If the KB-ingestion path is ever revived, supply the credential from Vault at
call time — the pattern `push-dispatch` already uses — rather than pasting a
literal back into the function body.

**Anything regenerating this baseline must still re-run the secret scan before
committing.** The generator reproduces function bodies verbatim, so any future
hardcoded credential lands straight in the dump.
