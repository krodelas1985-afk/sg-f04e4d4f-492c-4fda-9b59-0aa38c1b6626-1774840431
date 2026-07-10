-- Enforce the free-tier leads (30 total) and listings (3) caps at the DB layer.
--
-- App-side checks alone are bypassable (PostgREST is directly reachable with the
-- anon key), so the real gate is a BEFORE INSERT trigger on each table. Both are
-- no-ops for plans whose limit is NULL (pilot/paid) — so the live pilots, now on
-- the unlimited 'pilot' plan, are unaffected. They only bite once a real 'free'
-- workspace reaches its cap.
--
-- SECURITY DEFINER so the trigger can read plan_limits/clients (RLS-protected)
-- while running inside an inserting user's (or enroll_lead's) transaction.
--
-- NOTE (leads): this also fires on Messenger leads inserted via enroll_lead(). A
-- free workspace at 30 leads will have its 31st inbound lead rejected — correct
-- per spec, but the n8n W2 flow should be taught to handle the rejection
-- gracefully before free signups go live (tracked as a follow-up).

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
  IF v_limit IS NULL THEN RETURN NEW; END IF;  -- unlimited

  SELECT count(*) INTO v_count FROM public.leads WHERE client_id = NEW.client_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'lead_limit_reached: free plan allows % leads', v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_lead_cap ON public.leads;
CREATE TRIGGER enforce_lead_cap
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lead_cap();

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
  IF v_limit IS NULL THEN RETURN NEW; END IF;  -- unlimited

  SELECT count(*) INTO v_count FROM public.agent_listings WHERE client_id = NEW.client_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'listing_limit_reached: free plan allows % listings', v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_listing_cap ON public.agent_listings;
CREATE TRIGGER enforce_listing_cap
  BEFORE INSERT ON public.agent_listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_cap();
