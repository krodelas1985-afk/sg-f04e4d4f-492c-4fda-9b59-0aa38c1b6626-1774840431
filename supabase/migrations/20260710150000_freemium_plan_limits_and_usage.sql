-- Freemium free-tier caps foundation.
--
-- Free plan (Kathy, 2026-07-10): AI 10/month (resets), 30 leads total (lifetime),
-- 3 listings. NULL limit = unlimited. Enforcement is wired separately (edge
-- functions for AI; app gates for leads/listings; n8n for the auto-responder).
--
-- PILOT SAFETY: every existing client was defaulted to plan='free' by the earlier
-- clients.plan migration. Turning on caps would break the live pilots, so this
-- migration moves the 5 known pilot workspaces to an unlimited 'pilot' plan.
-- New self-serve signups stay 'free'.

-- 1. Per-plan limits. NULL = unlimited.
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan            text PRIMARY KEY,
  ai_monthly      int,
  leads_total     int,
  listings_total  int
);

INSERT INTO public.plan_limits (plan, ai_monthly, leads_total, listings_total)
VALUES
  ('free',  10,   30,   3),
  ('pilot', NULL, NULL, NULL)
ON CONFLICT (plan) DO UPDATE SET
  ai_monthly     = EXCLUDED.ai_monthly,
  leads_total    = EXCLUDED.leads_total,
  listings_total = EXCLUDED.listings_total;

-- 2. Protect the live pilot cohort (explicit ids — idempotent, never catches real
--    future free users).
UPDATE public.clients SET plan = 'pilot'
WHERE id IN (
  '185d82c4-6763-4515-b387-638d2a5a6275', -- BaMo
  '17d4401a-d0f6-4d65-bddf-3c16517f64d5', -- BaMo Sinag
  'ce349c20-82fa-4f38-bb62-27a03cbfbb34', -- Mary Ann Mendoza Caringal
  'fe506528-9114-4397-82b6-35102e49aacd', -- Joyce Cuenca
  '08725315-aa8e-45dc-a651-e2c6eea79f38'  -- Arleen Pecho
);

-- 3. Monthly AI usage counter (one row per client per month).
CREATE TABLE IF NOT EXISTS public.ai_usage (
  client_id     uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  period_month  date NOT NULL,
  count         int  NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, period_month)
);

-- Both tables are reached only through the SECURITY DEFINER functions below;
-- deny all direct client access.
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage    ENABLE ROW LEVEL SECURITY;

-- 4. Atomically spend one AI credit. Returns { allowed, used, limit, remaining }.
--    Edge functions (service role) call this with the resolved client_id.
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
  -- An authenticated user may only spend their own client's credits. Service-role
  -- callers (edge functions) have auth.uid() = NULL and skip this guard.
  IF auth.uid() IS NOT NULL AND public.get_my_client_id() IS DISTINCT FROM p_client_id THEN
    RAISE EXCEPTION 'not allowed to consume credits for another client';
  END IF;

  SELECT plan INTO v_plan FROM public.clients WHERE id = p_client_id;
  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_client');
  END IF;

  SELECT ai_monthly INTO v_limit FROM public.plan_limits WHERE plan = v_plan;

  -- Unknown plan or NULL limit => unlimited (fail-open).
  IF v_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'unlimited', true);
  END IF;

  -- Insert the first credit, or increment only while still under the limit.
  INSERT INTO public.ai_usage (client_id, period_month, count, updated_at)
  VALUES (p_client_id, v_period, 1, now())
  ON CONFLICT (client_id, period_month)
  DO UPDATE SET count = ai_usage.count + 1, updated_at = now()
    WHERE ai_usage.count < v_limit
  RETURNING count INTO v_count;

  -- No row returned => the WHERE guard blocked it => at/over the limit.
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
$function$;

-- 5. Usage snapshot for the current user's workspace (app UI + client-side gating).
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
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid) TO authenticated, service_role;
