
CREATE TABLE IF NOT EXISTS public.newsletter_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.newsletter_unsubscribe_tokens FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_newsletter_unsubscribe(p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subscriber_id uuid;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RETURN false;
  END IF;

  UPDATE public.newsletter_unsubscribe_tokens
     SET used_at = now()
   WHERE token_hash = p_token_hash
     AND used_at IS NULL
     AND expires_at > now()
  RETURNING subscriber_id INTO v_subscriber_id;

  IF v_subscriber_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.newsletter_subscribers
     SET unsubscribed_at = now()
   WHERE id = v_subscriber_id
     AND unsubscribed_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_newsletter_unsubscribe(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_newsletter_unsubscribe(text) TO service_role;

CREATE INDEX IF NOT EXISTS newsletter_unsubscribe_tokens_subscriber_idx
  ON public.newsletter_unsubscribe_tokens (subscriber_id);
CREATE INDEX IF NOT EXISTS newsletter_unsubscribe_tokens_expiry_idx
  ON public.newsletter_unsubscribe_tokens (expires_at)
  WHERE used_at IS NULL;
;
