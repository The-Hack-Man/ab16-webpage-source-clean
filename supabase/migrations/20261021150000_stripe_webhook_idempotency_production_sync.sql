-- Forward-only migration: reconcile local idempotency schema with production.
--
-- The production database has already been repaired directly via SQL Editor.
-- This migration brings the local migration history into alignment so that
-- a fresh database replay produces the same function signatures, table
-- columns, and behaviour as production.
--
-- Production facts (from pg_get_functiondef + pg_indexes inspection):
--   Functions (all SECURITY DEFINER, search_path = 'public', 'pg_temp'):
--     claim_stripe_event(p_event_id text) RETURNS boolean               [LANGUAGE plpgsql]
--       - Single atomic INSERT ... ON CONFLICT (stripe_event_id) DO UPDATE ... RETURNING
--       - Inserts 'processing' with attempts=1, locked_until = now() + 5min
--       - On conflict: retries if status <> 'completed' AND (status='failed' OR locked_until IS NULL OR locked_until < now())
--       - Returns true if row was inserted or updated; false otherwise
--     mark_stripe_event_completed(p_event_id text) RETURNS void          [LANGUAGE sql]
--       - UPDATE status='completed', completed_at=now(), processed_at=now(), locked_until=NULL, last_error=NULL
--       - No WHERE status guard (updates unconditionally by stripe_event_id)
--     mark_stripe_event_failed(p_event_id text, p_error text DEFAULT NULL) RETURNS void  [LANGUAGE sql]
--       - UPDATE status='failed', processed_at=now(), locked_until=NULL
--       - last_error = left(coalesce(p_error, 'Unknown webhook failure'), 2000)
--       - WHERE status <> 'completed'
--   Table columns on processed_stripe_events:
--     stripe_event_id, processed_at, status, attempts, last_error,
--     locked_until, completed_at
--   Constraints:
--     - Primary key on stripe_event_id
--     - NOT NULL on stripe_event_id, processed_at, status, attempts
--     - CHECK: status IN ('processing', 'completed', 'failed')
--   Indexes:
--     - Only primary key index (no secondary indexes)
--   Grants:
--     - EXECUTE to postgres, service_role

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
-- Behaviour (matching production exactly):
--   Returns true  → this worker has claimed the event (insert or takeover).
--   Returns false → event already completed, or currently locked by another worker.
--
-- Concurrency model: single atomic INSERT ... ON CONFLICT DO UPDATE ... RETURNING.
-- No explicit row-level or table-level locking is needed — the ON CONFLICT WHERE
-- clause filters to only eligible rows atomically within a single statement.
--
-- Takeover rules:
--   - New event: INSERT as 'processing' with attempts=1, locked_until=now()+5min.
--   - 'completed': DO NOTHING (WHERE clause on conflict excludes it) → RETURN false.
--   - 'processing' + locked_until in future: excluded by WHERE clause → RETURN false.
--   - 'processing' + locked_until in past (or NULL): take over → RETURN true.
--   - 'failed' (locked_until NULL or expired): take over → RETURN true.
DROP FUNCTION IF EXISTS public.claim_stripe_event(text, text, int) CASCADE;
DROP FUNCTION IF EXISTS public.claim_stripe_event(text) CASCADE;

CREATE OR REPLACE FUNCTION public.claim_stripe_event(p_event_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_claimed text;
BEGIN
  IF p_event_id IS NULL OR length(trim(p_event_id)) = 0 THEN
    RAISE EXCEPTION 'Stripe event ID is required';
  END IF;

  INSERT INTO public.processed_stripe_events
    (stripe_event_id, processed_at, status, attempts, locked_until, last_error, completed_at)
  VALUES
    (p_event_id, now(), 'processing', 1, now() + interval '5 minutes', NULL, NULL)
  ON CONFLICT (stripe_event_id) DO UPDATE
    SET processed_at = now(),
        status = 'processing',
        attempts = public.processed_stripe_events.attempts + 1,
        locked_until = now() + interval '5 minutes',
        last_error = NULL
    WHERE public.processed_stripe_events.status <> 'completed'
      AND (
        public.processed_stripe_events.status = 'failed'
        OR public.processed_stripe_events.locked_until IS NULL
        OR public.processed_stripe_events.locked_until < now()
      )
  RETURNING stripe_event_id INTO v_claimed;

  RETURN v_claimed IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_event(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(text) TO service_role;

-- ── mark_stripe_event_completed (production definition, exact match) ─────────
CREATE OR REPLACE FUNCTION public.mark_stripe_event_completed(p_event_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  UPDATE public.processed_stripe_events
  SET status = 'completed',
      completed_at = now(),
      processed_at = now(),
      locked_until = NULL,
      last_error = NULL
  WHERE stripe_event_id = p_event_id;
$$;

REVOKE ALL ON FUNCTION public.mark_stripe_event_completed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_completed(text) TO service_role;

-- ── mark_stripe_event_failed (production definition, exact match) ────────────
CREATE OR REPLACE FUNCTION public.mark_stripe_event_failed(p_event_id text, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  UPDATE public.processed_stripe_events
  SET status = 'failed',
      processed_at = now(),
      locked_until = NULL,
      last_error = left(coalesce(p_error, 'Unknown webhook failure'), 2000)
  WHERE stripe_event_id = p_event_id
    AND status <> 'completed';
$$;

REVOKE ALL ON FUNCTION public.mark_stripe_event_failed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_failed(text, text) TO service_role;

-- ── Migrate existing rows: any 'processing' row stuck from old deployment
--    becomes 'failed' so it can be retried by the next redelivery. ───────────────
UPDATE public.processed_stripe_events
SET status = 'failed',
    last_error = 'Recovered from interrupted processing (pre-idempotency repair)'
WHERE status = 'processing'
  AND locked_until IS NOT NULL
  AND locked_until < now();

-- ── Clean up columns and indexes introduced by 20261021140000 (local-only) ─────
--    Production was repaired via 20261021164454_stripe_webhook_event_dedup_safe_repair,
--    which never created these columns. On a fresh local replay, 20261021140000
--    adds them, so this migration drops them to converge on the production schema.
ALTER TABLE public.processed_stripe_events
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS worker_id,
  DROP COLUMN IF EXISTS lease_expires_at,
  DROP COLUMN IF EXISTS error;

DROP INDEX IF EXISTS public.processed_stripe_events_status_idx;
DROP INDEX IF EXISTS public.processed_stripe_events_lease_idx;

-- Align the status column default with production ('completed', not 'processing')
ALTER TABLE public.processed_stripe_events
  ALTER COLUMN status SET DEFAULT 'completed';

SELECT 'stripe_webhook_idempotency_production_sync_complete' AS status;
