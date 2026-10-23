-- Stripe webhook recovery: status-aware atomic event claims.
-- Additive migration: preserves the existing boolean RPC for backward compatibility.
-- Deploy this migration before deploying webhook code that calls claim_stripe_event_v2.

CREATE OR REPLACE FUNCTION public.claim_stripe_event_v2(p_event_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
  v_locked_until timestamptz;
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

  IF v_claimed IS NOT NULL THEN
    RETURN 'claimed';
  END IF;

  SELECT status, locked_until
    INTO v_status, v_locked_until
    FROM public.processed_stripe_events
   WHERE stripe_event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not determine Stripe event claim state';
  END IF;

  IF v_status = 'completed' THEN
    RETURN 'completed';
  END IF;

  IF v_status = 'processing' AND v_locked_until >= now() THEN
    RETURN 'locked';
  END IF;

  -- A failed/expired row should have been claimed above. Returning locked is
  -- safer than falsely acknowledging an event if the state changed concurrently.
  RETURN 'locked';
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_stripe_event_v2(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event_v2(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event_v2(text) TO postgres;
