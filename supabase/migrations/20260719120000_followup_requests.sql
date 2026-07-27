-- Self-serve automations Phase 4: "Auto Follow-Up" requests from the mobile app.
-- The client picks a style (gentle/standard/persistent) + duration; a BaMo admin
-- fulfills it by cloning the matching playbook sequence for the client and then
-- marks the request active. Same request-table pattern as page_connection_requests.
CREATE TABLE IF NOT EXISTS public.followup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  style text NOT NULL CHECK (style IN ('gentle','standard','persistent')),
  duration_days int NOT NULL CHECK (duration_days IN (7,14,30)),
  notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','rejected','disabled')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY fur_select ON public.followup_requests
  FOR SELECT USING (
    get_my_role() = 'baymo_admin' OR client_id = get_my_client_id()
  );

CREATE POLICY fur_insert ON public.followup_requests
  FOR INSERT WITH CHECK (
    client_id = get_my_client_id() AND requested_by = auth.uid()
  );

CREATE POLICY fur_admin_update ON public.followup_requests
  FOR UPDATE USING (get_my_role() = 'baymo_admin')
  WITH CHECK (get_my_role() = 'baymo_admin');

CREATE OR REPLACE FUNCTION public.notify_followup_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_name text;
BEGIN
  SELECT coalesce(p.full_name, p.email, 'A client') INTO v_name
  FROM public.profiles p WHERE p.id = NEW.requested_by;

  INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
  SELECT p.id, NEW.client_id, 'followup_requested',
         v_name || ' wants Auto Follow-Up',
         initcap(NEW.style) || ' · ' || NEW.duration_days || ' days'
           || coalesce(' — ' || NEW.notes, ''),
         jsonb_build_object('request_id', NEW.id, 'client_id', NEW.client_id,
                            'style', NEW.style, 'duration_days', NEW.duration_days)
  FROM public.profiles p
  WHERE p.role = 'baymo_admin' AND coalesce(p.is_active, true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followup_request ON public.followup_requests;
CREATE TRIGGER trg_notify_followup_request
  AFTER INSERT ON public.followup_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_followup_request();

CREATE OR REPLACE FUNCTION public.notify_followup_resolved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('active','rejected') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
  VALUES (
    NEW.requested_by, NEW.client_id, 'followup_' || NEW.status,
    CASE WHEN NEW.status = 'active'
      THEN 'Auto Follow-Up is on — BayMo now follows up with quiet leads'
      ELSE 'Your Auto Follow-Up request needs attention' END,
    coalesce(NEW.admin_notes, ''),
    jsonb_build_object('request_id', NEW.id, 'status', NEW.status)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followup_resolved ON public.followup_requests;
CREATE TRIGGER trg_notify_followup_resolved
  AFTER UPDATE ON public.followup_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_followup_resolved();
