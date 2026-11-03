-- Review and run on an isolated Supabase staging project FIRST.
-- Do not apply to live Supabase without a tested migration/rollback plan.
--
-- Initial schema 00_initial_schema.sql grants anon SELECT on every visit,
-- including public QR tokens. A bearer QR token must not be enumerable.
-- The public status and directions pages already use SECURITY DEFINER RPCs,
-- while staff pages use authenticated server-side API routes.
BEGIN;

DROP POLICY IF EXISTS "allow_public_visit_status" ON public.visits;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.visits FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.visitors FROM anon, authenticated;

-- These staff-only RPCs are called by server routes with the service role key.
-- They should not be directly callable by public Supabase clients.
REVOKE EXECUTE ON FUNCTION public.get_pending_visitors() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_visit_detail(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_visitors() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_visit_detail(uuid) TO service_role;

-- Public bearer-token RPCs remain available for token holders:
-- get_visit_status(varchar), get_visit_directions(varchar).
-- The active destinations SELECT policy is also retained.
COMMIT;

-- Validation before production rollout:
-- 1. Anonymous direct SELECT from visits must fail (403 permission denied).
-- 2. get_visit_status(valid token) returns only its status; wrong token returns 0 rows.
-- 3. get_visit_directions(valid token) still works.
-- 4. Staff API /api/security/pending and /api/security/visit/:id work when signed in.
-- 5. The client-demo register -> QR -> approve -> checkout flow works on staging.
--
-- Rollback ONLY after change approval:
-- GRANT SELECT, INSERT ON public.visits TO anon, authenticated;
-- GRANT SELECT, INSERT ON public.visitors TO anon, authenticated;
-- CREATE POLICY "allow_public_visit_status" ON public.visits FOR SELECT USING (true);
-- GRANT EXECUTE ON FUNCTION public.get_pending_visitors() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.get_visit_detail(uuid) TO PUBLIC;
-- Note: rollback reintroduces the documented public-read exposure.
