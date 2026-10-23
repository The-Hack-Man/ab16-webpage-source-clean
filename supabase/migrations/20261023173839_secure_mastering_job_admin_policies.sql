-- Use the trusted admin helper for mastering-job admin policies.
-- The policy names and command-specific predicates are preserved; access is
-- denied unless the JWT contains an administrator role in app_metadata.
DO $migration$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd, roles, permissive, qual, with_check
    FROM pg_policies
    WHERE schemaname='public' AND tablename='ai_mastering_jobs'
      AND policyname IN ('admin_read_mastering_jobs','admin_update_mastering_jobs','admin_write_mastering_jobs')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s',
      p.policyname,p.tablename,p.permissive,p.cmd,array_to_string(p.roles, ', '),
      CASE WHEN p.qual IS NOT NULL THEN ' USING (public.is_admin())' ELSE '' END,
      CASE WHEN p.with_check IS NOT NULL THEN ' WITH CHECK (public.is_admin())' ELSE '' END
    );
  END LOOP;
END
$migration$;
