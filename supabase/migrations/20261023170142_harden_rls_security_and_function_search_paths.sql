
-- Harden newsletter subscriber updates and function search paths.

DROP POLICY IF EXISTS anon_unsubscribe_newsletter
  ON public.newsletter_subscribers;

REVOKE UPDATE ON TABLE public.newsletter_subscribers FROM anon;

REVOKE ALL ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.is_admin()
  SET search_path = pg_catalog;

ALTER FUNCTION public.claim_next_outbox(timestamptz, uuid, integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.claim_next_job(timestamptz, uuid, integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.reclaim_expired_jobs(timestamptz)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.touch_updated()
  SET search_path = pg_catalog;
