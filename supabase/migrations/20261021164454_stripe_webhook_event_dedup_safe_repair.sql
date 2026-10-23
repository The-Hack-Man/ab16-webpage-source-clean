
ALTER TABLE public.processed_stripe_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.processed_stripe_events'::regclass
      AND conname = 'processed_stripe_events_status_check'
  ) THEN
    ALTER TABLE public.processed_stripe_events
      ADD CONSTRAINT processed_stripe_events_status_check
      CHECK (status IN ('processing', 'completed', 'failed'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.claim_stripe_event(p_event_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.mark_stripe_event_completed(p_event_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.processed_stripe_events
  SET status = 'completed',
      completed_at = now(),
      processed_at = now(),
      locked_until = NULL,
      last_error = NULL
  WHERE stripe_event_id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION public.mark_stripe_event_failed(p_event_id text, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.processed_stripe_events
  SET status = 'failed',
      processed_at = now(),
      locked_until = NULL,
      last_error = left(coalesce(p_error, 'Unknown webhook failure'), 2000)
  WHERE stripe_event_id = p_event_id
    AND status <> 'completed';
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_event(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_stripe_event_completed(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_stripe_event_failed(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_completed(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_failed(text, text) TO service_role;
;
