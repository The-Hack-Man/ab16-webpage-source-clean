-- AI Mastering jobs table policies and indexes
-- This table definition was added to the migration source after this migration
-- had already been applied to production. Existing projects do not rerun it;
-- the later forward repair migration reconciles their schema.
CREATE TABLE IF NOT EXISTS public.ai_mastering_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid REFERENCES public.music_releases(id) ON DELETE SET NULL,
  track_title text NOT NULL,
  preset text NOT NULL DEFAULT 'balanced',
  status text NOT NULL DEFAULT 'pending',
  input_url text,
  output_url text,
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

ALTER TABLE public.ai_mastering_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_mastering_jobs" ON public.ai_mastering_jobs;
CREATE POLICY "admin_read_mastering_jobs" ON public.ai_mastering_jobs
  FOR SELECT TO authenticated USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin'
    OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'super_admin'
  );

DROP POLICY IF EXISTS "admin_write_mastering_jobs" ON public.ai_mastering_jobs;
CREATE POLICY "admin_write_mastering_jobs" ON public.ai_mastering_jobs
  FOR INSERT TO authenticated WITH CHECK (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin'
    OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'super_admin'
  );

CREATE INDEX IF NOT EXISTS ai_mastering_jobs_release_idx ON public.ai_mastering_jobs (release_id);
CREATE INDEX IF NOT EXISTS ai_mastering_jobs_status_idx ON public.ai_mastering_jobs (status);

-- Create releases storage bucket
INSERT INTO storage.buckets (id, name, public, created_at)
VALUES ('releases', 'releases', false, now())
ON CONFLICT (id) DO NOTHING;

-- Storage policy: admin can read/write releases bucket
DROP POLICY IF EXISTS "admin_read_releases_bucket" ON storage.objects;
CREATE POLICY "admin_read_releases_bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin' OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'super_admin');

DROP POLICY IF EXISTS "admin_write_releases_bucket" ON storage.objects;
CREATE POLICY "admin_write_releases_bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'releases' AND (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin' OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'super_admin'));

SELECT 'ai_mastering_schema_complete' AS status;
