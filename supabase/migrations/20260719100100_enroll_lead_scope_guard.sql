-- Self-serve automations Phase 0 (2/3): enroll_lead() scope guard + asset attribution.
-- Fixes the accidental-catch-all hole behind the Vermira→B2B incident: previously a
-- campaign whose rules named an fb_ad_id still matched leads that arrived with NO
-- attribution at all (equality was only checked when both sides were present).
-- Now: a scoped (project/listing) campaign that is not the client's organic owner
-- only wins on a POSITIVE attribution match (fb_ad_id / webform_id / sms_number /
-- asset_id). General and organic-owner campaigns keep the old catch-all behavior.
-- Also adds asset_id (FB Page) as a matchable attribution key.

CREATE OR REPLACE FUNCTION public.enroll_lead(
  p_lead_id uuid,
  p_is_new boolean DEFAULT false,
  p_source text DEFAULT NULL,
  p_attribution jsonb DEFAULT '{}'::jsonb,
  p_campaign_id uuid DEFAULT NULL,
  p_force boolean DEFAULT false
) RETURNS jsonb
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
    -- MANUAL PATH: explicit campaign, bypass rules and opt-out guard.
    SELECT * INTO v_chosen FROM campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('enrolled', false, 'reason', 'campaign_not_found');
    END IF;
    v_by := 'manual';
    v_found := true;
  ELSE
    -- AUTO PATH
    -- Respect agent takeover: never auto-override a manual AI opt-out.
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

      -- sources (case-insensitive); empty list = any
      v_sources := v_rules->'sources';
      IF v_sources IS NOT NULL AND jsonb_typeof(v_sources) = 'array'
         AND jsonb_array_length(v_sources) > 0 THEN
        IF p_source IS NULL OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(v_sources) s WHERE lower(s) = lower(p_source)
        ) THEN CONTINUE; END IF;
      END IF;

      -- new vs existing + returning-lead window
      IF NOT p_is_new THEN
        IF COALESCE((v_rules->>'new_leads_only')::boolean, true) THEN
          CONTINUE;  -- campaign wants new leads only
        END IF;
        v_threshold := COALESCE((v_rules->>'returning_lead_threshold_days')::int, 0);
        IF v_threshold > 0 AND v_lead.last_inbound_at IS NOT NULL
           AND v_lead.last_inbound_at > now() - make_interval(days => v_threshold) THEN
          CONTINUE;  -- too recently active to count as re-engaging
        END IF;
      END IF;

      -- skip if already in an active/paused campaign
      IF COALESCE((v_rules->>'skip_if_active_campaign')::boolean, false) THEN
        IF EXISTS (SELECT 1 FROM lead_campaign_states
                   WHERE lead_id = p_lead_id AND state IN ('active','paused')) THEN
          CONTINUE;
        END IF;
      END IF;

      -- single exact temperature; empty = any
      v_temp := nullif(v_rules->>'lead_temperature', '');
      IF v_temp IS NOT NULL THEN
        IF v_lead.lead_temperature IS NULL OR lower(v_lead.lead_temperature) <> lower(v_temp) THEN
          CONTINUE;
        END IF;
      END IF;

      -- attribution equality (mismatch on any present pair disqualifies;
      -- a positive match on any pair is remembered for the scope guard)
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

      -- SCOPE GUARD: a scoped automation that doesn't own organic traffic only
      -- claims leads it can positively attribute to itself.
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

  -- next_step_at from active Step 1 (if the campaign has sequence steps)
  SELECT delay_hours INTO v_delay
  FROM campaign_steps
  WHERE campaign_id = v_chosen.id AND step_order = 1 AND is_active = true
  ORDER BY id LIMIT 1;
  v_next := now() + make_interval(hours => COALESCE(v_delay, 0));

  -- one active campaign per lead: stop any other active/paused states
  UPDATE lead_campaign_states
  SET state = 'stopped',
      paused_reason = COALESCE(paused_reason, 'Superseded by new enrollment'),
      updated_at = now()
  WHERE lead_id = p_lead_id AND campaign_id <> v_chosen.id AND state IN ('active','paused');

  -- idempotent enroll (reactivates a prior stopped row for same campaign)
  INSERT INTO lead_campaign_states
    (lead_id, campaign_id, client_id, state, current_step, enrolled_at, next_step_at, metadata)
  VALUES
    (p_lead_id, v_chosen.id, v_lead.client_id, 'active', 1, now(), v_next,
     jsonb_build_object('enrolled_by', v_by))
  ON CONFLICT (lead_id, campaign_id) DO UPDATE
    SET state = 'active', current_step = 1, enrolled_at = now(), next_step_at = v_next,
        metadata = lead_campaign_states.metadata || jsonb_build_object('enrolled_by', v_by),
        updated_at = now();

  -- point the lead at the campaign + enable AI (manual marks the source)
  UPDATE leads
  SET campaign_id = v_chosen.id,
      automation_enabled = true,
      automation_source = CASE WHEN p_force THEN 'manual' ELSE automation_source END
  WHERE id = p_lead_id;

  RETURN jsonb_build_object('enrolled', true, 'campaign_id', v_chosen.id,
                            'campaign_name', v_chosen.name, 'enrolled_by', v_by);
END;
$function$;
