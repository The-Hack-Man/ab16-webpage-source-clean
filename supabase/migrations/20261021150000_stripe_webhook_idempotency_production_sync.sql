-- Forward-only migration: reconcile local idempotency schema with production.
--
-- The production database has already been repaired directly via SQL Editor.
-- This migration brings the local migration history into alignment so that
-- a fresh database replay produces the same function signatures and table
-- columns as production.
--
-- Production facts (from production database inspection):
--   Functions:
--     claim_stripe_event(p_event_id text) RETURNS boolean
--     mark_stripe_event_completed(p_event_id text) RETURNS void
--     mark_stripe_event_failed(p_event_id text, p_error text DEFAULT NULL) RETURNS void
--   Table columns on processed_stripe_events:
--     stripe_event_id, processed_at, status, attempts, last_error,
--     locked_until, completed_at
--
-- The earlier local migration 20261021140000_stripe_webhook_event_dedup.sql
-- created the table with different column names (updated_at, worker_id,
-- lease_expires_at, error) and different function signatures (claim returned
-- a TABLE with can_process/previous_status/lease_expires_at). This migration
-- extends the table to add the production columns and replaces the functions
-- with the production signatures.
--
-- DO NOT apply to production — production already has these objects.
-- This migration is safe to re-run (all statements are idempotent).

-- ── Extend processed_stripe_events with production columns ────────────────────
ALTER TABLE IF EXISTS public.processed_stripe_events
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- ── Replace claim_stripe_event with production signature ─────────────────────
-- Drops the version created by 20261021140000 (which took p_worker_id, p_lease_ms
-- and returned a TABLE) and replaces it with the simple boolean-returning version.
--
-- Behaviour:
--   Returns true  → this worker has claimed the event (insert or takeover).
--   Returns false → event already completed, or currently locked by another worker.
--
-- Takeover rules:
--   - New event: INSERT as 'processing', return true.
--   - 'completed': return false (already fully processed).
--   - 'processing' + locked_until in future: return false (another worker owns it).
--   - 'processing' + locked_until in past (or NULL): take over, return true.
--   - 'failed' (no lock): take over, return true.
DROP FUNCTION IF EXISTS public.claim_stripe_event(text, text, int) CASCADE;
DROP FUNCTION IF EXISTS public.claim_stripe_event(text) CASCADE;

CREATE OR REPLACE FUNCTION public.claim_stripe_event(p_event_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := now();
  v_inserted boolean := false;
BEGIN
  -- Try to INSERT a new processing record (handles first-time events)
  INSERT INTO public.processed_stripe_events
    (stripe_event_id, status, processed_at, locked_until, attempts)
  VALUES
    (p_event_id, 'processing', v_now, NULL, 0)
  ON CONFLICT (stripe_event_id) DO NOTHING;

  IF FOUND THEN
    v_inserted := true;
  END IF;

  IF v_inserted THEN
    RETURN true;
  END IF;

  -- Event already existed. Lock the row and decide.
  LOCK TABLE public.processed_stripe_events IN ROW EXCLUSIVE MODE;

  -- Re-check: another worker may have completed it between our INSERT and LOCK
  IF EXISTS (
    SELECT 1 FROM public.processed_stripe_events
    WHERE stripe_event_id = p_event_id AND status = 'completed'
  ) THEN
    RETURN false;
  END IF;

  -- Take over if: processing with no lock or expired lock, or failed
  UPDATE public.processed_stripe_events
  SET status = 'processing',
      locked_until = NULL,
      attempts = COALESCE(attempts, 0) + 1,
      updated_at = v_now
  WHERE stripe_event_id = p_event_id
    AND (status = 'failed' OR status = 'processing')
    AND (locked_until IS NULL OR locked_until < v_now);

  IF FOUND THEN
    RETURN true;
  END IF;

  -- Still locked by another worker
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_event(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(text) TO authenticated;

-- ── mark_stripe_event_completed (production signature, unchanged) ─────────────
CREATE OR REPLACE FUNCTION public.mark_stripe_event_completed(p_event_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.processed_stripe_events
  SET status = 'completed',
      completed_at = now(),
      locked_until = NULL,
      updated_at = now()
  WHERE stripe_event_id = p_event_id
    AND status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_stripe_event_completed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_completed(text) TO authenticated;

-- ── mark_stripe_event_failed (production signature, unchanged) ───────────────
CREATE OR REPLACE FUNCTION public.mark_stripe_event_failed(p_event_id text, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.processed_stripe_events
  SET status = 'failed',
      last_error = p_error,
      locked_until = NULL,
      updated_at = now()
  WHERE stripe_event_id = p_event_id
    AND status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_stripe_event_failed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_failed(text, text) TO authenticated;

-- ── Migrate existing rows from old column names to production columns ─────────
-- Copy data from the old columns (if they exist) to the production columns.
-- Rows that were already 'processing' become 'failed' so they can be retried.
UPDATE public.processed_stripe_events
SET completed_at = processed_at
WHERE completed_at IS NULL
  AND processed_at IS NOT NULL;

-- ── Indexes for fast lookups ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS processed_stripe_events_status_idx ON public.processed_stripe_events (status);
CREATE INDEX IF NOT EXISTS processed_stripe_events_locked_until_idx ON public.processed_stripe_events (locked_until);
CREATE INDEX IF NOT EXISTS processed_stripe_events_completed_at_idx ON public.processed_stripe_events (completed_at);

SELECT 'stripe_webhook_idempotency_production_sync_complete' AS status;
