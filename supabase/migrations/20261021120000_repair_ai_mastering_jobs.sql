-- Reconcile ai_mastering_jobs with the application contract without dropping records.
-- An existing table with an incompatible core schema is rejected for inspection rather
-- than guessed at; this migration must not be run against production until that schema
-- has been inspected.
DO $$
DECLARE
  missing_columns text;
  mismatched_columns text;
BEGIN
  IF to_regclass('public.ai_mastering_jobs') IS NULL THEN
    CREATE TABLE public.ai_mastering_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id uuid REFERENCES public.music_releases(id) ON DELETE SET NULL,
      track_title text NOT NULL,
      preset text NOT NULL DEFAULT 'balanced',
      status text NOT NULL DEFAULT 'pending',
      input_url text,
      output_url text,
      stripe_session_id text,
      payment_intent_id text,
      paid boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      CONSTRAINT ai_mastering_jobs_status_check
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paid')),
      CONSTRAINT ai_mastering_jobs_preset_check
        CHECK (preset IN (
          'transparent', 'balanced', 'loud', 'warm', 'punchy',
          'streaming', 'vinyl', 'cd', 'highres', 'master'
        ))
    );
  ELSE
    SELECT string_agg(required.column_name, ', ' ORDER BY required.column_name)
      INTO missing_columns
    FROM (VALUES
      ('id'), ('release_id'), ('track_title'), ('preset'), ('status'),
      ('input_url'), ('output_url'), ('created_at'), ('completed_at')
    ) AS required(column_name)
    LEFT JOIN information_schema.columns existing
      ON existing.table_schema = 'public'
      AND existing.table_name = 'ai_mastering_jobs'
      AND existing.column_name = required.column_name
    WHERE existing.column_name IS NULL;

    IF missing_columns IS NOT NULL THEN
      RAISE EXCEPTION
        'ai_mastering_jobs is missing core columns (%); inspect the existing production schema before repairing it',
        missing_columns;
    END IF;

    SELECT string_agg(expected.column_name, ', ' ORDER BY expected.column_name)
      INTO mismatched_columns
    FROM (VALUES
      ('id', 'uuid'), ('release_id', 'uuid'), ('track_title', 'text'),
      ('preset', 'text'), ('status', 'text'), ('input_url', 'text'),
      ('output_url', 'text'), ('created_at', 'timestamptz'),
      ('completed_at', 'timestamptz')
    ) AS expected(column_name, expected_type)
    JOIN information_schema.columns existing
      ON existing.table_schema = 'public'
      AND existing.table_name = 'ai_mastering_jobs'
      AND existing.column_name = expected.column_name
    WHERE existing.udt_name <> expected.expected_type;

    IF mismatched_columns IS NOT NULL THEN
      RAISE EXCEPTION
        'ai_mastering_jobs has incompatible core column types (%); inspect the existing production schema before repairing it',
        mismatched_columns;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ai_mastering_jobs'
        AND column_name IN ('id', 'track_title', 'preset', 'status')
        AND is_nullable <> 'NO'
    ) THEN
      RAISE EXCEPTION
        'ai_mastering_jobs has nullable required columns; inspect the existing production schema before repairing it';
    END IF;
  END IF;
END;
$$;

ALTER TABLE public.ai_mastering_jobs
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;

ALTER TABLE public.ai_mastering_jobs
  ALTER COLUMN preset SET DEFAULT 'balanced',
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT now();

DO $$
DECLARE
  mismatched_columns text;
BEGIN
  SELECT string_agg(expected.column_name, ', ' ORDER BY expected.column_name)
    INTO mismatched_columns
  FROM (VALUES
    ('stripe_session_id', 'text'), ('payment_intent_id', 'text'), ('paid', 'bool')
  ) AS expected(column_name, expected_type)
  JOIN information_schema.columns existing
    ON existing.table_schema = 'public'
    AND existing.table_name = 'ai_mastering_jobs'
    AND existing.column_name = expected.column_name
  WHERE existing.udt_name <> expected.expected_type;

  IF mismatched_columns IS NOT NULL THEN
    RAISE EXCEPTION
      'ai_mastering_jobs has incompatible Stripe column types (%); inspect the existing production schema before repairing it',
      mismatched_columns;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_mastering_jobs'
      AND column_name = 'paid'
      AND is_nullable <> 'NO'
  ) THEN
    RAISE EXCEPTION
      'ai_mastering_jobs.paid is nullable; inspect its existing values before repairing it';
  END IF;
END;
$$;

ALTER TABLE public.ai_mastering_jobs
  ALTER COLUMN paid SET DEFAULT false;

ALTER TABLE public.ai_mastering_jobs
  DROP CONSTRAINT IF EXISTS ai_mastering_jobs_preset_check;

ALTER TABLE public.ai_mastering_jobs
  ADD CONSTRAINT ai_mastering_jobs_preset_check
    CHECK (preset IN (
      'transparent', 'balanced', 'loud', 'warm', 'punchy',
      'streaming', 'vinyl', 'cd', 'highres', 'master'
    ));

ALTER TABLE public.ai_mastering_jobs
  DROP CONSTRAINT IF EXISTS ai_mastering_jobs_status_check;

ALTER TABLE public.ai_mastering_jobs
  ADD CONSTRAINT ai_mastering_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paid'));

DO $$
DECLARE
  release_column smallint;
BEGIN
  SELECT attnum INTO release_column
  FROM pg_attribute
  WHERE attrelid = 'public.ai_mastering_jobs'::regclass
    AND attname = 'release_id'
    AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_mastering_jobs'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[release_column]
      AND confrelid = 'public.music_releases'::regclass
  ) THEN
    ALTER TABLE public.ai_mastering_jobs
      ADD CONSTRAINT ai_mastering_jobs_release_id_fkey
      FOREIGN KEY (release_id) REFERENCES public.music_releases(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.ai_mastering_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_mastering_jobs" ON public.ai_mastering_jobs;
CREATE POLICY "admin_read_mastering_jobs" ON public.ai_mastering_jobs
  FOR SELECT TO authenticated
  USING (
    COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '')
      IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "admin_write_mastering_jobs" ON public.ai_mastering_jobs;
CREATE POLICY "admin_write_mastering_jobs" ON public.ai_mastering_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '')
      IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "admin_update_mastering_jobs" ON public.ai_mastering_jobs;
CREATE POLICY "admin_update_mastering_jobs" ON public.ai_mastering_jobs
  FOR UPDATE TO authenticated
  USING (
    COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '')
      IN ('admin', 'super_admin')
  )
  WITH CHECK (
    COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '')
      IN ('admin', 'super_admin')
  );

CREATE INDEX IF NOT EXISTS ai_mastering_jobs_release_idx
  ON public.ai_mastering_jobs (release_id);
CREATE INDEX IF NOT EXISTS ai_mastering_jobs_status_idx
  ON public.ai_mastering_jobs (status);
CREATE INDEX IF NOT EXISTS ai_mastering_jobs_stripe_session_idx
  ON public.ai_mastering_jobs (stripe_session_id);
CREATE INDEX IF NOT EXISTS ai_mastering_jobs_payment_intent_idx
  ON public.ai_mastering_jobs (payment_intent_id);
CREATE INDEX IF NOT EXISTS ai_mastering_jobs_paid_idx
  ON public.ai_mastering_jobs (paid);
