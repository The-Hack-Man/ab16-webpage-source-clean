-- Webhook event state is trusted backend bookkeeping. Clients must not call
-- SECURITY DEFINER status mutation functions directly.
REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_completed(text) FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_completed(text) FROM anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_completed(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_completed(text) TO service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_failed(text, text) FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_failed(text, text) FROM anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_failed(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_failed(text, text) TO service_role;
