DROP POLICY IF EXISTS "insert_own_payments" ON public.payment_records;
DROP POLICY IF EXISTS "update_own_payments" ON public.payment_records;

CREATE OR REPLACE FUNCTION public.consume_mastering_credit()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  remaining_credits integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.mastering_credits
  SET credits = credits - 1,
      updated_at = now()
  WHERE user_id = auth.uid()
    AND credits > 0
  RETURNING credits INTO remaining_credits;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No mastering credits available';
  END IF;

  RETURN remaining_credits;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_mastering_credit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_mastering_credit() TO authenticated;

CREATE OR REPLACE FUNCTION public.grant_mastering_credits(
  p_stripe_session_id text,
  p_user_id uuid,
  p_credits integer,
  p_payment_intent_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  payment public.payment_records%ROWTYPE;
BEGIN
  SELECT *
  INTO payment
  FROM public.payment_records
  WHERE stripe_session_id = p_stripe_session_id
  FOR UPDATE;

  IF NOT FOUND
    OR payment.user_id <> p_user_id
    OR payment.credits_purchased <> p_credits
    OR p_credits <= 0
  THEN
    RAISE EXCEPTION 'Payment record does not match the completed checkout';
  END IF;

  IF payment.status = 'paid' THEN
    RETURN;
  END IF;

  IF payment.status <> 'pending' THEN
    RAISE EXCEPTION 'Payment is not pending';
  END IF;

  INSERT INTO public.mastering_credits (user_id, credits, total_purchased)
  VALUES (p_user_id, p_credits, p_credits)
  ON CONFLICT (user_id) DO UPDATE
  SET credits = public.mastering_credits.credits + EXCLUDED.credits,
      total_purchased = public.mastering_credits.total_purchased + EXCLUDED.total_purchased,
      updated_at = now();

  UPDATE public.payment_records
  SET status = 'paid',
      completed_at = now(),
      stripe_payment_intent_id = p_payment_intent_id
  WHERE id = payment.id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_mastering_credits(text, uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_mastering_credits(text, uuid, integer, text) TO service_role;
