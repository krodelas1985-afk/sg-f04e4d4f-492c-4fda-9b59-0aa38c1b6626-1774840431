-- Switching follow-up OFF applies immediately; switching it ON is a request.
--
-- A client who wants automated messages to stop under their own name usually
-- has a live reason, so making them wait for a BaMo admin to wake up is the
-- wrong side to fail on. Switching ON still goes through review, because that
-- is where the ladder, goal and send window get set.
--
-- SECURITY DEFINER so the app never needs write access to `sequences`; the
-- function verifies the caller owns the campaign and can only ever set
-- is_active = false. Every disable is logged to followup_requests.
--
-- Halting, not destroying: in-flight enrollments simply stop being fetched
-- (fetch_due requires s.is_active), matching the campaign automation switch.
-- EXECUTE is granted to authenticated only - never anon.

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
$function$;

REVOKE ALL ON FUNCTION public.request_followup_disable(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_followup_disable(uuid) TO authenticated;
