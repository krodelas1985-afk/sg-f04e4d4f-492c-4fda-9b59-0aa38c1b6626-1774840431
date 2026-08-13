-- Notify every active baymo_admin when a website (landing-page) client
-- application lands in the review queue.
--
-- Why: the n8n `bamo-landing-lead` webhook fans out into two inserts — a lead
-- (source='Landing Page') and an application (client_onboarding source='web').
-- The application side had no notification of any kind, so applications sat
-- unactioned; on 2026-08-13 five real applications were found aged 12 days.
-- `client_onboarded` only fires on APPROVAL, which is too late to be a prompt.
--
-- NOTE: `data.route` is deliberately NOT set. The mobile app blindly
-- router.push()es data.route (src/lib/notifications.ts), and /admin/requests is
-- a CRM-only path — setting it would break navigation on the handset. The CRM
-- path is carried as `admin_route` instead.

CREATE OR REPLACE FUNCTION public.notify_client_application_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  IF NEW.source IS DISTINCT FROM 'web' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'submitted' THEN RETURN NEW; END IF;

  v_name := coalesce(
    nullif(btrim(NEW.full_name), ''),
    nullif(btrim(NEW.company_name), ''),
    nullif(btrim(NEW.email), ''),
    'Someone'
  );

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT p.id,
         'client_application_submitted',
         v_name || ' applied to become a BaMo client',
         concat_ws(' · ',
           nullif(btrim(NEW.company_name), ''),
           nullif(btrim(NEW.email), ''),
           nullif(btrim(NEW.phone), '')
         ),
         jsonb_build_object(
           'onboarding_id', NEW.id,
           'source',        NEW.source,
           'admin_route',   '/admin/requests'
         )
  FROM public.profiles p
  WHERE p.role = 'baymo_admin' AND coalesce(p.is_active, true);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure block the application insert.
  RETURN NEW;
END;
$function$;

-- INSERT-only on purpose: n8n dedups resubmissions via WHERE NOT EXISTS, so a
-- returning applicant does not create a second row (and must not re-notify).
DROP TRIGGER IF EXISTS trg_notify_client_application ON public.client_onboarding;
CREATE TRIGGER trg_notify_client_application
  AFTER INSERT ON public.client_onboarding
  FOR EACH ROW
  WHEN (NEW.source = 'web' AND NEW.status = 'submitted')
  EXECUTE FUNCTION public.notify_client_application_submitted();
