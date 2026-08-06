-- Make the empty-KB alert actually reach a human.
--
-- 20260806100000 gave sweep_ai_campaigns_missing_kb() an in-app notification,
-- which is the weakest delivery channel we have: push-dispatch's POLICY map has
-- no 'campaign_kb_empty' entry (so nothing is pushed) and the CRM has no
-- notification-centre UI at all. An alert nobody sees is not an alert — the
-- 2026-08-06 outage ran four days precisely because nothing surfaced it.
--
-- send.bahaymo.com is verified in Resend (2026-08-04), so email lands. Called
-- straight from Postgres via net.http_post + Vault, mirroring the daily-digest
-- cron rather than adding an edge function for six lines of JSON.

-- ---------------------------------------------------------------------------
-- Prerequisite (manual, in the Supabase dashboard — Kathy swaps prod secrets):
--   Vault secret `resend_api_key`   — the Resend API key. REQUIRED for email.
--   Vault secret `ops_alert_email`  — recipient. Optional; defaults below.
-- The function degrades on purpose: no key → notification still written, email
-- skipped with a WARNING. Applying this before the secret exists is safe.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sweep_ai_campaigns_missing_kb()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campaign  record;
  v_count     int := 0;
  v_offenders text := '';
  v_api_key   text;
  v_to        text;
BEGIN
  FOR v_campaign IN
    SELECT c.id, c.name, c.client_id, cl.name AS client_name
    FROM public.campaigns c
    LEFT JOIN public.clients cl ON cl.id = c.client_id
    WHERE c.status = 'active'
      AND coalesce(c.conversational_ai_enabled, false)
      AND NOT public.campaign_kb_ready(c.id, c.client_id)
  LOOP
    -- One alert per campaign per 24h, so a campaign left broken over a weekend
    -- doesn't bury the notification centre or spam the inbox.
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'campaign_kb_empty'
        AND n.data ->> 'campaign_id' = v_campaign.id::text
        AND n.created_at > now() - interval '24 hours'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
    SELECT p.id, v_campaign.client_id, 'campaign_kb_empty',
           'AI is replying with an empty knowledge base',
           coalesce(v_campaign.client_name || ' — ', '') || v_campaign.name
             || ' is active with conversational AI on, but resolves to no approved '
             || 'knowledge. Replies are running on prompt instructions alone.',
           jsonb_build_object('campaign_id', v_campaign.id,
                              'client_id',   v_campaign.client_id)
    FROM public.profiles p
    WHERE p.role = 'baymo_admin' AND coalesce(p.is_active, true);

    v_offenders := v_offenders
      || '<li><strong>' || coalesce(v_campaign.client_name || ' — ', '')
      || v_campaign.name || '</strong><br>'
      || '<code style="font-size:12px;color:#5B5B5B">' || v_campaign.id || '</code></li>';

    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RETURN 0;
  END IF;

  SELECT decrypted_secret INTO v_api_key
  FROM vault.decrypted_secrets WHERE name = 'resend_api_key';

  IF v_api_key IS NULL THEN
    RAISE WARNING
      'sweep_ai_campaigns_missing_kb: % campaign(s) serving an empty KB, but no '
      'resend_api_key in Vault — in-app notification only.', v_count;
    RETURN v_count;
  END IF;

  SELECT coalesce(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ops_alert_email'),
    'bamophilippines@gmail.com'
  ) INTO v_to;

  PERFORM net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_api_key),
    body := jsonb_build_object(
      'from',    'BaMo Alerts <alerts@send.bahaymo.com>',
      'to',      jsonb_build_array(v_to),
      'subject', v_count || ' campaign' || CASE WHEN v_count = 1 THEN '' ELSE 's' END
                 || ' replying with an empty knowledge base',
      'html',
        '<div style="font-family:Poppins,Inter,Arial,sans-serif;color:#3A3A3A">'
        || '<h2 style="color:#E74C3C;font-size:18px;margin:0 0 12px">'
        || 'Conversational AI is answering leads with no approved knowledge</h2>'
        || '<p style="font-size:14px;line-height:20px;color:#5B5B5B">'
        || 'The campaign' || CASE WHEN v_count = 1 THEN '' ELSE 's' END
        || ' below ' || CASE WHEN v_count = 1 THEN 'is' ELSE 'are' END
        || ' <strong>active</strong> with conversational AI enabled, but resolve'
        || CASE WHEN v_count = 1 THEN 's' ELSE '' END
        || ' to an empty <code>kb_text</code>. BayMo is replying from the prompt '
        || 'instructions alone and inventing anything they do not cover — this is '
        || 'the 2026-08-06 failure repeating.</p>'
        || '<ul style="font-size:14px;line-height:22px;color:#3A3A3A">' || v_offenders || '</ul>'
        || '<p style="font-size:14px;line-height:20px;color:#5B5B5B">'
        || 'Fix: approve a knowledge source in the campaign''s Knowledge Base tab, '
        || 'or switch conversational AI off until one is ready.</p>'
        || '<p style="font-size:12px;color:#9CA3AF">'
        || 'Hourly sweep, one alert per campaign per 24h.</p></div>')
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_ai_campaigns_missing_kb() FROM anon, authenticated;
