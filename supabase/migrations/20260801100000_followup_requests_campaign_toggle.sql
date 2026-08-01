-- Turn followup_requests from a one-shot "please set up follow-up for us" form
-- into a per-campaign on/off request, so clients can ask from the mobile app
-- while BaMo still decides the settings before anything goes live.
--
-- The table predates the AI follow-up engine: it was client-scoped with a
-- style/duration pair that maps to nothing the engine uses (the engine is a
-- per-campaign ai_adaptive sequence with a touch ladder, goal and send window).
-- Those columns stay for existing rows but are no longer required.

ALTER TABLE public.followup_requests
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'enable',
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.followup_requests ALTER COLUMN style DROP NOT NULL;
ALTER TABLE public.followup_requests ALTER COLUMN duration_days DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'followup_requests_action_check') THEN
    ALTER TABLE public.followup_requests
      ADD CONSTRAINT followup_requests_action_check CHECK (action IN ('enable','disable'));
  END IF;
END $$;

-- One outstanding request per campaign: a client tapping a switch repeatedly
-- should not queue five identical reviews.
CREATE UNIQUE INDEX IF NOT EXISTS followup_requests_one_pending_per_campaign
  ON public.followup_requests (campaign_id)
  WHERE status = 'pending' AND campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS followup_requests_status_created_idx
  ON public.followup_requests (status, created_at DESC);

COMMENT ON COLUMN public.followup_requests.campaign_id IS
  'Campaign the client wants AI follow-up switched on/off for. NULL on legacy client-scoped rows.';
COMMENT ON COLUMN public.followup_requests.action IS
  'enable = needs baymo_admin review before going live; disable = applied immediately, logged here for the audit trail.';
