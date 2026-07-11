-- Expose the client's PUBLIC Facebook Page ID to their own signed-in users so the
-- RE Assistant mobile app can deep-link a Messenger lead into the client's Page
-- inbox (business.facebook.com/latest/inbox). The clients table is RLS
-- baymo_admin-only (clients_all_admin_only) and holds sensitive columns
-- (fb_page_token, webhook_secret), so -- following the existing get_my_* pattern --
-- return ONLY the public Page ID through a narrow SECURITY DEFINER RPC.
-- NEVER expose fb_page_token here.

CREATE OR REPLACE FUNCTION public.get_my_fb_page_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.fb_page_id
  FROM public.clients c
  WHERE c.id = public.get_my_client_id();
$$;

-- Callable by signed-in users only.
REVOKE EXECUTE ON FUNCTION public.get_my_fb_page_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_fb_page_id() TO authenticated;
