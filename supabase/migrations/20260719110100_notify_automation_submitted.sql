-- Notify all active baymo_admins when a client submits an automation for review.
CREATE OR REPLACE FUNCTION public.notify_automation_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.status <> 'pending_review'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'pending_review') THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(p.full_name, p.email, 'A client') INTO v_name
  FROM public.profiles p WHERE p.id = NEW.created_by;

  INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
  SELECT p.id, NEW.client_id, 'automation_submitted',
         coalesce(v_name, 'A client') || ' submitted an automation for review',
         NEW.name,
         jsonb_build_object('campaign_id', NEW.id, 'client_id', NEW.client_id,
                            'automation_scope', NEW.automation_scope)
  FROM public.profiles p
  WHERE p.role = 'baymo_admin' AND coalesce(p.is_active, true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_automation_submitted ON public.campaigns;
CREATE TRIGGER trg_notify_automation_submitted
  AFTER INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.notify_automation_submitted();
