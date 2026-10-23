-- Enhance processed_stripe_events for database-backed Stripe webhook idempotency.
--
-- The original table only stored (stripe_event_id, processed_at). It could not
-- support concurrent worker coordination, crash recovery, or retry semantics.
-- This migration adds the columns needed for a two-phase event lifecycle:
--   processing -> completed   (success)
--   processing -> failed      (transient failure, retryable)
--   processing -> processing   (lease expiry takeover by another worker)
--
-- All changes are idempotent (safe to re-run).

-- ── Extend the table ────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.processed_stripe_events
  ADD COLUMN IF NOT EXISTS status text
    NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz
    NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS error text;

-- ── Migrate existing rows to 'completed' (they were processed synchronously) ─
UPDATE public.processed_stripe_events
SET status = 'completed'
WHERE processed_at IS NOT NULL;

-- ── Ensure the table is writable via service role (it already has admin-only RLS) ─
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_processed_stripe_events" ON public.processed_stripe_events;
CREATE POLICY "admin_full_access_processed_stripe_events" ON public.processed_stripe_events
  FOR ALL TO authenticated
  USING (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── Indexes for fast lookups ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS processed_stripe_events_status_idx ON public.processed_stripe_events (status);
CREATE INDEX IF NOT EXISTS processed_stripe_events_lease_idx ON public.processed_stripe_events (lease_expires_at);

-- ── Atomic event claim function ─────────────────────────────────────────────
-- Attempts to claim a Stripe event for processing. If the event is new, inserts
-- a row as 'processing'. If the event already exists:
--   - 'completed' → returns can_process=false (skip)
--   - 'processing' with a valid lease → returns can_process=false (another worker has it)
--   - 'processing' with expired lease → takes over, returns can_process=true
--   - 'failed' → takes over, returns can_process=true (retry)
--
-- The function uses row-level locking (FOR UPDATE) to ensure atomic takeover,
-- preventing two workers from both claiming the same expired lease.
CREATE OR REPLACE FUNCTION public.claim_stripe_event(
  p_event_id text,
  p_worker_id text,
  p_lease_ms int
)
RETURNS TABLE (
  can_process boolean,
  previous_status text,
  lease_expires_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := now();
  v_lease timestamptz := v_now + (p_lease_ms || 'ms')::interval;
  v_existing_status text;
  v_existing_lease timestamptz;
  v_count int;
BEGIN
  -- Step 1: Try to INSERT (handles new, never-before-seen events)
  INSERT INTO public.processed_stripe_events
    (stripe_event_id, status, processed_at, worker_id, lease_expires_at, updated_at)
  VALUES
    (p_event_id, 'processing', v_now, p_worker_id, v_lease, v_now)
  ON CONFLICT (stripe_event_id) DO NOTHING;

  -- Check if our INSERT succeeded
  SELECT count(*) INTO v_count
  FROM public.processed_stripe_events
  WHERE stripe_event_id = p_event_id
    AND worker_id = p_worker_id
    AND status = 'processing'
    AND lease_expires_at = v_lease;

  IF v_count > 0 THEN
    -- We successfully inserted a new row
    RETURN QUERY SELECT true, NULL::text, v_lease;
    RETURN;
  END IF;

  -- Step 2: Event already existed. Lock the row and decide.
  SELECT status, lease_expires_at
  INTO v_existing_status, v_existing_lease
  FROM public.processed_stripe_events
  WHERE stripe_event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Race condition: row was deleted between INSERT and SELECT.
    -- Try one more INSERT.
    INSERT INTO public.processed_stripe_events
      (stripe_event_id, status, processed_at, worker_id, lease_expires_at, updated_at)
    VALUES
      (p_event_id, 'processing', v_now, p_worker_id, v_lease, v_now)
    ON CONFLICT (stripe_event_id) DO NOTHING;
    RETURN QUERY SELECT true, NULL::text, v_lease;
    RETURN;
  END IF;

  -- Already completed — skip
  IF v_existing_status = 'completed' THEN
    RETURN QUERY SELECT false, 'completed', v_existing_lease;
    RETURN;
  END IF;

  -- Being processed with a valid lease — another worker owns it, skip
  IF v_existing_status = 'processing'
     AND v_existing_lease IS NOT NULL
     AND v_existing_lease > v_now THEN
    RETURN QUERY SELECT false, 'processing', v_existing_lease;
    RETURN;
  END IF;

  -- Take over: either processing with expired lease, or failed
  UPDATE public.processed_stripe_events
  SET status = 'processing',
      worker_id = p_worker_id,
      lease_expires_at = v_lease,
      updated_at = v_now,
      error = NULL
  WHERE stripe_event_id = p_event_id;

  RETURN QUERY SELECT true, v_existing_status, v_lease;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_event(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(text, text, int) TO authenticated;

-- ── Mark an event as completed after successful processing ──────────────────
CREATE OR REPLACE FUNCTION public.mark_stripe_event_completed(
  p_event_id text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.processed_stripe_events
  SET status = 'completed',
      updated_at = now(),
      lease_expires_at = NULL,
      worker_id = NULL
  WHERE stripe_event_id = p_event_id
    AND status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_stripe_event_completed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_completed(text) TO authenticated;

-- ── Mark an event as failed (retryable) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_stripe_event_failed(
  p_event_id text,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.processed_stripe_events
  SET status = 'failed',
      updated_at = now(),
      lease_expires_at = NULL,
      worker_id = NULL,
      error = p_error
  WHERE stripe_event_id = p_event_id
    AND status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_stripe_event_failed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_failed(text, text) TO authenticated;

SELECT 'stripe_event_dedup_ready' AS status;
