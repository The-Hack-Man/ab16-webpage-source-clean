
-- Least-privilege grants for public API roles. RLS policies remain unchanged.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon;

-- Public API should never directly expose operational, payment, customer-order,
-- worker-queue or internal event records to unauthenticated clients.
REVOKE ALL PRIVILEGES ON TABLE
  public.ai_mastering_jobs,
  public.audit_logs,
  public.jobs,
  public.mastering_credits,
  public.order_items,
  public.orders,
  public.outbox,
  public.payment_records,
  public.printful_order_items,
  public.printful_orders,
  public.processed_stripe_events,
  public.newsletter_unsubscribe_tokens
FROM anon;

-- Keep only the anonymous actions the storefront actually needs.
GRANT INSERT ON TABLE public.contact_enquiries TO anon;
GRANT INSERT ON TABLE public.newsletter_subscribers TO anon;

-- Worker claim/recovery RPCs are internal. Edge/server workers use service_role.
REVOKE EXECUTE ON FUNCTION public.claim_next_job(timestamptz, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_next_outbox(timestamptz, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reclaim_expired_jobs(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_job(timestamptz, uuid, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_outbox(timestamptz, uuid, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reclaim_expired_jobs(timestamptz)
  TO service_role;
;
