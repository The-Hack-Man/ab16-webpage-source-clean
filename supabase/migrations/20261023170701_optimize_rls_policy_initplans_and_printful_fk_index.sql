
-- Preserve each policy's roles, command, permissiveness and predicates while
-- wrapping request-stable auth/JWT lookups in scalar SELECTs for initplan caching.
DO $$
DECLARE
  p record;
  v_using text;
  v_check text;
  v_roles text;
  v_sql text;
BEGIN
  FOR p IN
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ~* 'auth\.(uid|jwt|role)\(\)|current_setting\('
        OR coalesce(with_check, '') ~* 'auth\.(uid|jwt|role)\(\)|current_setting\('
      )
  LOOP
    v_using := p.qual;
    v_check := p.with_check;

    IF v_using IS NOT NULL THEN
      v_using := replace(v_using, 'auth.uid()', '(select auth.uid())');
      v_using := replace(v_using, 'auth.jwt()', '(select auth.jwt())');
      v_using := replace(v_using, 'auth.role()', '(select auth.role())');
      v_using := replace(v_using, 'current_setting(''request.jwt.claims''::text, true)',
                         '(select current_setting(''request.jwt.claims''::text, true))');
    END IF;

    IF v_check IS NOT NULL THEN
      v_check := replace(v_check, 'auth.uid()', '(select auth.uid())');
      v_check := replace(v_check, 'auth.jwt()', '(select auth.jwt())');
      v_check := replace(v_check, 'auth.role()', '(select auth.role())');
      v_check := replace(v_check, 'current_setting(''request.jwt.claims''::text, true)',
                         '(select current_setting(''request.jwt.claims''::text, true))');
    END IF;

    SELECT string_agg(quote_ident(r), ', ' ORDER BY r)
      INTO v_roles
    FROM unnest(p.roles) AS r;

    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);

    v_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      p.policyname, p.schemaname, p.tablename,
      CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      p.cmd, coalesce(v_roles, 'public')
    );

    IF v_using IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_using);
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;

    EXECUTE v_sql;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS printful_order_items_variant_id_idx
  ON public.printful_order_items (variant_id);
;
