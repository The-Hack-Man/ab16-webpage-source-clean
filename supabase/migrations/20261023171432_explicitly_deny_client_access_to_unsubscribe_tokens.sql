
-- Tokens are only redeemed by the service-role-only SECURITY DEFINER RPC.
-- Explicit false policies preserve deny-by-default behavior if grants change later.
CREATE POLICY deny_client_access_newsletter_unsubscribe_tokens
  ON public.newsletter_unsubscribe_tokens
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
;
