-- Tell the client when AI follow-up actually goes live on their campaign.
--
-- Fired off sequences.is_active flipping false -> true rather than off the
-- request being marked approved, because those are two different moments: a
-- baymo_admin approves the request, then sets the ladder/goal/window and
-- switches it on. The client cares about the second. Firing on the request
-- would announce "it's active" while nothing was actually sending.
--
-- Switching it on also resolves any pending request for that campaign, so the
-- review queue closes itself rather than relying on an admin remembering.
--
-- Rejections notify separately, from the request row, carrying the admin note.
--
-- In-app only. Handset push delivery is a known separate problem (0 buzzes in
-- 209 sends) and 'followup_activated' is deliberately NOT added to the push
-- POLICY map here - that belongs to the push track, not this feature.
--
-- Verified in a rolled-back transaction: pending request -> is_active true ->
-- request auto-resolved to 'active' and one notification created, addressed to
-- the workspace client_admin.

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
$function$;

DROP TRIGGER IF EXISTS trg_sequences_followup_activated ON public.sequences;
CREATE TRIGGER trg_sequences_followup_activated
  AFTER UPDATE OF is_active ON public.sequences
  FOR EACH ROW EXECUTE FUNCTION public.notify_followup_activated();

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
    'Auto follow-up request needs a change' || COALESCE(' — ' || v_campaign_name, ''),
    COALESCE(NULLIF(btrim(NEW.admin_notes), ''), 'The BaMo team will be in touch about this request.'),
    jsonb_build_object('campaign_id', NEW.campaign_id, 'request_id', NEW.id)
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_followup_request_rejected ON public.followup_requests;
CREATE TRIGGER trg_followup_request_rejected
  AFTER UPDATE OF status ON public.followup_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_followup_request_rejected();
