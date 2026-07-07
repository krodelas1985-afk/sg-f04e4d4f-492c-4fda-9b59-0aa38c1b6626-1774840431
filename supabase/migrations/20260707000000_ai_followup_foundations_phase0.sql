-- AI Follow-Up Engine — Phase 0 foundations (additive, inert until W6 exists)
-- Plan: bamo-ops/BaMo_AI_FollowUp_Engine_Plan.md §4

-- 1) sequences: adaptive mode + campaign binding + AI config bundle
ALTER TABLE public.sequences
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ai_settings jsonb;

ALTER TABLE public.sequences DROP CONSTRAINT IF EXISTS sequences_mode_check;
ALTER TABLE public.sequences ADD CONSTRAINT sequences_mode_check
  CHECK (mode IN ('fixed','ai_adaptive'));

-- At most one ai_adaptive sequence per campaign (the client-facing "AI Follow-Up" config row)
CREATE UNIQUE INDEX IF NOT EXISTS sequences_one_adaptive_per_campaign
  ON public.sequences (campaign_id)
  WHERE mode = 'ai_adaptive';

-- 2) sequence_enrollments: adaptive-touch tracking (fixed mode keeps using next_step_at)
ALTER TABLE public.sequence_enrollments
  ADD COLUMN IF NOT EXISTS touch_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz;

-- 3) follow_up_decisions — the AI decision audit log (transparency + analytics backbone)
CREATE TABLE IF NOT EXISTS public.follow_up_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('send','wait','escalate','stop','answer_pending')),
  reason text,
  message_sent text,
  goal_status text,
  window_open boolean,
  context_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS follow_up_decisions_enrollment_idx
  ON public.follow_up_decisions (enrollment_id);
CREATE INDEX IF NOT EXISTS follow_up_decisions_lead_idx
  ON public.follow_up_decisions (lead_id);
CREATE INDEX IF NOT EXISTS follow_up_decisions_client_created_idx
  ON public.follow_up_decisions (client_id, created_at DESC);

-- RLS mirrors sequences/sequence_enrollments scoping. Service role (n8n/W6) bypasses RLS.
ALTER TABLE public.follow_up_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follow_up_decisions_baymo_admin ON public.follow_up_decisions;
CREATE POLICY follow_up_decisions_baymo_admin ON public.follow_up_decisions
  FOR ALL
  USING (get_my_role() = 'baymo_admin')
  WITH CHECK (get_my_role() = 'baymo_admin');

DROP POLICY IF EXISTS follow_up_decisions_client_admin_manager ON public.follow_up_decisions;
CREATE POLICY follow_up_decisions_client_admin_manager ON public.follow_up_decisions
  FOR ALL
  USING ((get_my_role() = ANY (ARRAY['client_admin','manager'])) AND client_id = get_my_client_id())
  WITH CHECK ((get_my_role() = ANY (ARRAY['client_admin','manager'])) AND client_id = get_my_client_id());

DROP POLICY IF EXISTS follow_up_decisions_agent_read ON public.follow_up_decisions;
CREATE POLICY follow_up_decisions_agent_read ON public.follow_up_decisions
  FOR SELECT
  USING ((get_my_role() = 'agent') AND client_id = get_my_client_id());
