-- Admin authorization must use trusted app_metadata, never user-editable user_metadata.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $function$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'), false)
$function$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Replace the previous top-level JWT role predicates without broadening the
-- existing policy command, role list, permissiveness, USING, or WITH CHECK.
DO $migration$
DECLARE
  p record;
  old_admin text := '(((( SELECT current_setting(''request.jwt.claims''::text, true) AS current_setting))::jsonb ->> ''role''::text) = ''admin''::text)';
  old_super text := '(((( SELECT current_setting(''request.jwt.claims''::text, true) AS current_setting))::jsonb ->> ''role''::text) = ''super_admin''::text)';
  new_admin text := 'public.is_admin()';
  new_qual text;
  new_check text;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd, roles, permissive, qual, with_check
    FROM pg_policies
    WHERE schemaname='public'
      AND (coalesce(qual,'') LIKE '%request.jwt.claims%'
        OR coalesce(with_check,'') LIKE '%request.jwt.claims%')
  LOOP
    new_qual := CASE WHEN p.qual IS NULL THEN NULL ELSE replace(replace(p.qual, old_admin, new_admin), old_super, new_admin) END;
    new_check := CASE WHEN p.with_check IS NULL THEN NULL ELSE replace(replace(p.with_check, old_admin, new_admin), old_super, new_admin) END;
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s',
      p.policyname,
      p.tablename,
      p.permissive,
      p.cmd,
      array_to_string(p.roles, ', '),
      CASE WHEN new_qual IS NOT NULL THEN ' USING ('||new_qual||')' ELSE '' END,
      CASE WHEN new_check IS NOT NULL THEN ' WITH CHECK ('||new_check||')' ELSE '' END
    );
  END LOOP;
END
$migration$;
