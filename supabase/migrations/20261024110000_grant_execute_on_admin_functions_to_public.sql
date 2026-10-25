-- Public catalogue requests may cause PostgreSQL to inspect policies that
-- reference this helper, so anon must be able to execute it. The helper only
-- reads request JWT claims and does not grant access itself; table RLS remains
-- the authorization boundary. Keep execution scoped to API roles.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
