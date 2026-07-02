-- Sequence enrollment rules: FB Ad ID filter (up to 3 IDs in the UI).
-- Evaluated by W4 Sequence Scheduler's "Enrollment Scan" query as a HARD gate:
-- when set, only leads whose leads.fb_ad_id matches one of the IDs enroll;
-- leads with no ad attribution (fb_ad_id NULL) are excluded. NULL = no filter.
ALTER TABLE public.enrollment_rules
  ADD COLUMN IF NOT EXISTS fb_ad_id_filter text[];
