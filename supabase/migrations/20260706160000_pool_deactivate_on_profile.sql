-- Phase 3: deactivating a user removes them from any assignment rotation.
-- The auto-assign picker already skips inactive profiles via its join, but the
-- pool row should reflect reality so the Settings UI shows them as out of
-- rotation, and so re-activating a user requires an explicit opt back in.

CREATE OR REPLACE FUNCTION public.deactivate_pool_on_profile_deactivate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    UPDATE public.lead_assignment_pool
      SET is_active = false
      WHERE user_id = NEW.id AND is_active;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deactivate_pool_on_profile_deactivate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_deactivate_pool_on_profile ON public.profiles;
CREATE TRIGGER trg_deactivate_pool_on_profile
AFTER UPDATE OF is_active ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.deactivate_pool_on_profile_deactivate();
