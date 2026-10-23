
DO $$
DECLARE
  rec record;
  admin_roles text;
  read_roles text;
  combined_name text;
BEGIN
  FOR rec IN
    SELECT p.tablename,
           p.policyname AS admin_policy,
           p.roles AS admin_roles_array,
           p.qual AS admin_using,
           p.with_check AS admin_check,
           q.policyname AS overlap_policy,
           q.cmd AS overlap_cmd,
           q.roles AS overlap_roles_array,
           q.qual AS overlap_using,
           q.with_check AS overlap_check
    FROM pg_policies p
    JOIN pg_policies q
      ON q.schemaname = p.schemaname
     AND q.tablename = p.tablename
     AND q.policyname <> p.policyname
    WHERE p.schemaname = 'public'
      AND p.cmd = 'ALL'
      AND q.cmd IN ('SELECT','INSERT')
      AND p.permissive = 'PERMISSIVE'
      AND q.permissive = 'PERMISSIVE'
      AND p.roles && q.roles
      AND 'authenticated' = ANY(p.roles)
      AND 'authenticated' = ANY(q.roles)
    ORDER BY p.tablename
  LOOP
    admin_roles := array_to_string(rec.admin_roles_array, ', ');
    read_roles := array_to_string(rec.overlap_roles_array, ', ');

    IF rec.overlap_cmd = 'SELECT' THEN
      EXECUTE format('DROP POLICY %I ON public.%I', rec.admin_policy, rec.tablename);
      EXECUTE format('DROP POLICY %I ON public.%I', rec.overlap_policy, rec.tablename);

      -- A single SELECT policy preserves public visibility and admin visibility.
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO %s USING ((%s) OR (%s))',
        rec.overlap_policy, rec.tablename, read_roles, rec.overlap_using, rec.admin_using
      );

      -- Restore the admin ALL policy's non-SELECT privileges as explicit policies.
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK (%s)',
        left(rec.admin_policy || '_insert', 63), rec.tablename, admin_roles, rec.admin_check
      );
    ELSE
      -- The existing public INSERT policy already grants the same effective insert
      -- access (its WITH CHECK is true). Remove the overlapping ALL policy and
      -- retain that insert policy, while restoring admin SELECT separately.
      EXECUTE format('DROP POLICY %I ON public.%I', rec.admin_policy, rec.tablename);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO %s USING (%s)',
        left(rec.admin_policy || '_select', 63), rec.tablename, admin_roles, rec.admin_using
      );
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
      left(rec.admin_policy || '_update', 63), rec.tablename, admin_roles, rec.admin_using, rec.admin_check
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO %s USING (%s)',
      left(rec.admin_policy || '_delete', 63), rec.tablename, admin_roles, rec.admin_using
    );
  END LOOP;
END $$;
;
