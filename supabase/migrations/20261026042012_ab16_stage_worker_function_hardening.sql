-- Align the staging function security with production before the first preview.
-- Keep public.is_admin callable by RLS and application policies, but derive its
-- result only from server-managed app_metadata in the JWT.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT coalesce(auth.jwt()->'app_metadata'->>'role', '') IN ('admin', 'super_admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

ALTER FUNCTION public.claim_next_outbox(timestamptz, uuid, integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.claim_next_job(timestamptz, uuid, integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.reclaim_expired_jobs(timestamptz)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.touch_updated()
  SET search_path = pg_catalog;

REVOKE EXECUTE ON FUNCTION public.claim_next_job(timestamptz, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_next_outbox(timestamptz, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reclaim_expired_jobs(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_job(timestamptz, uuid, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_outbox(timestamptz, uuid, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reclaim_expired_jobs(timestamptz)
  TO service_role;
