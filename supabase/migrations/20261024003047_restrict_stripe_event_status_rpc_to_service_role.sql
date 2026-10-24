-- Restrict SECURITY DEFINER Stripe event state mutation RPCs to the trusted backend.
-- The Stripe webhook calls these using the Supabase service-role client.
-- Authenticated and anonymous clients must not mark arbitrary webhook events complete/failed.

REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_completed(text) FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_completed(text) FROM anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_completed(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_completed(text) TO service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_failed(text, text) FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_failed(text, text) FROM anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.mark_stripe_event_failed(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_failed(text, text) TO service_role;
