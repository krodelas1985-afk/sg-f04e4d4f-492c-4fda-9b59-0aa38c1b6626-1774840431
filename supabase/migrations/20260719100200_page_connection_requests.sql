-- Self-serve automations Phase 0 (3/3): guided "Connect my Facebook Page" requests.
-- Mobile Leads empty state lets a client request their Page be wired up; BaMo admin
-- completes the webhook wiring manually (self-serve OAuth is blocked on Meta review).
-- Admins are notified via direct notifications insert (same pattern as
-- notify_tour_completed; deliberately NOT the unguarded create_notification fn).

CREATE TABLE IF NOT EXISTS public.page_connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page_name text NOT NULL,
  page_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','connected','rejected')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.page_connection_requests ENABLE ROW LEVEL SECURITY;

-- Client members see their workspace's requests; only admins change status.
CREATE POLICY pcr_select ON public.page_connection_requests
  FOR SELECT USING (
    get_my_role() = 'baymo_admin' OR client_id = get_my_client_id()
  );

CREATE POLICY pcr_insert ON public.page_connection_requests
  FOR INSERT WITH CHECK (
    client_id = get_my_client_id() AND requested_by = auth.uid()
  );

CREATE POLICY pcr_admin_update ON public.page_connection_requests
  FOR UPDATE USING (get_my_role() = 'baymo_admin')
  WITH CHECK (get_my_role() = 'baymo_admin');

CREATE OR REPLACE FUNCTION public.notify_page_connection_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_name text;
BEGIN
  SELECT coalesce(p.full_name, p.email, 'A client') INTO v_name
  FROM public.profiles p WHERE p.id = NEW.requested_by;

  INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
  SELECT p.id, NEW.client_id, 'page_connection_requested',
         v_name || ' wants to connect a Facebook Page',
         NEW.page_name || coalesce(' — ' || NEW.page_url, ''),
         jsonb_build_object('request_id', NEW.id, 'client_id', NEW.client_id,
                            'page_name', NEW.page_name, 'page_url', NEW.page_url)
  FROM public.profiles p
  WHERE p.role = 'baymo_admin' AND coalesce(p.is_active, true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_page_connection_request ON public.page_connection_requests;
CREATE TRIGGER trg_notify_page_connection_request
  AFTER INSERT ON public.page_connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_page_connection_request();

-- Tell the requester when their page is connected (or declined).
CREATE OR REPLACE FUNCTION public.notify_page_connection_resolved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('connected','rejected') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, client_id, type, title, body, data)
  VALUES (
    NEW.requested_by, NEW.client_id, 'page_connection_' || NEW.status,
    CASE WHEN NEW.status = 'connected'
      THEN NEW.page_name || ' is connected — BayMo can now receive its messages'
      ELSE 'Page connection for ' || NEW.page_name || ' needs attention' END,
    coalesce(NEW.admin_notes, ''),
    jsonb_build_object('request_id', NEW.id, 'status', NEW.status)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_page_connection_resolved ON public.page_connection_requests;
CREATE TRIGGER trg_notify_page_connection_resolved
  AFTER UPDATE ON public.page_connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_page_connection_resolved();
