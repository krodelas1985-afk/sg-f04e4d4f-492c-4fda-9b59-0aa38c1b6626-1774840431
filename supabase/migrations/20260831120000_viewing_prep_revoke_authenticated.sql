-- Phase 2a — close a hole left by 20260831110000.
--
-- That migration revoked the new functions from `anon, public` and stopped there, copying
-- the wording of the 2026-08-10 migration without checking what it actually achieved. It
-- is not enough: `authenticated` keeps EXECUTE, and these are SECURITY DEFINER functions,
-- so RLS does not contain them.
--
-- Concretely, before this migration any logged-in agent could call
--   mint_viewing_prep_tokens('<some other workspace's request id>')
-- and then redeem the returned token as 'going_ahead', writing a confirmed_upcoming
-- indication against an appointment belonging to a different client -- which under the new
-- gate is exactly the thing that releases an outcome email to that client's agent.
--
-- The pre-existing outcome equivalents are already service_role-only, which is how the
-- Supabase advisor caught the difference: mint_viewing_outcome_tokens and
-- redeem_viewing_outcome_token are clean, while their prep twins were flagged
-- `authenticated_security_definer_function_executable`. n8n and the landing-page API call
-- these with the service_role key, so nothing legitimate needs `authenticated`.

revoke all on function public.mint_viewing_prep_tokens(uuid)              from authenticated;
revoke all on function public.redeem_viewing_prep_token(text, text, text) from authenticated;

-- Mutates request state on a schedule; only the workflow should ever call it.
revoke all on function public.expire_unconfirmed_viewing_requests()       from authenticated;

-- NOTE: public.mark_viewing_outcome_sent(uuid, text, text) is still executable by
-- `authenticated` and has been since 2026-08-10. That is pre-existing and untouched here
-- rather than changed silently -- worth tightening separately, since it too is SECURITY
-- DEFINER and lets a caller mark someone else's request as sent. Its prep counterpart,
-- mark_viewing_prep_reminder_sent, is revoked below so the new code does not extend the
-- same weakness.
revoke all on function public.mark_viewing_prep_reminder_sent(uuid, text, text) from authenticated;
