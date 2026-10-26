# Stripe Operator Runbook

## Prerequisites
- Stripe account access with Administrator or Developer role
- Supabase project admin access (project ref: `fleoxzauuvfbdysvadev`)
- Supabase CLI installed (`npx supabase@latest`)
- Printful operator access (for clothing fulfilment verification)

## Current State
- Last checked 2026-10-25: the connected Stripe account `ab16 clothing` reports **live mode**. This describes the account context, not the mode of the configured Edge Function key.
- The configured Edge Function secret names and key modes have not been verified in this review. Do not assume staging/test credentials are configured or use this runbook as evidence of a safe test environment.
- The expected production webhook URL is `https://fleoxzauuvfbdysvadev.supabase.co/functions/v1/stripe-webhook`; current event subscriptions and endpoint-specific signing secret still need Dashboard verification.
- No key rotation or revocation was performed in this review. Verify secret names/modes and active key digests in the provider dashboards without displaying secret values.

### Saved mastering catalogue (live, 2026-10-26)
- Product: `prod_VVeNf63ctQmcfG` — **AB16 Audio Mastering Credits**
- `single`: £5.00 GBP, 1 credit — `price_1UUd4k7OvUf6BvvRVphHouzh`
- `pack5`: £25.00 GBP, 5 credits — `price_1UUd4x7OvUf6BvvRLaTZvl1m`
- `pack10`: £50.00 GBP, 10 credits — `price_1UUd4z7OvUf6BvvRQyz16mJL`
- Lookup keys: `ab16_mastering_1_credit`, `ab16_mastering_5_credits`, `ab16_mastering_10_credits`.
- These are active live Stripe catalog prices. The deployed `stripe-checkout` function still uses different inline prices, and production does not currently list `verify-mastering-checkout`; therefore the live catalog is not connected to production checkout yet. Keep sales disabled until the reviewed functions, production price-ID secrets, and an end-to-end payment/credit verification are all in place.
- The local `stripe-checkout` and `verify-mastering-checkout` functions now require `STRIPE_MASTERING_PRICE_SINGLE`, `STRIPE_MASTERING_PRICE_PACK5`, and `STRIPE_MASTERING_PRICE_PACK10`, and verification checks the exact Checkout line item as well as amount, credits, currency, user, and payment record.
- After reviewing and deploying those functions, set the non-secret Stripe Price IDs as Supabase function environment values for production:
  ```bash
  npx supabase secrets set STRIPE_MASTERING_PRICE_SINGLE=price_1UUd4k7OvUf6BvvRVphHouzh STRIPE_MASTERING_PRICE_PACK5=price_1UUd4x7OvUf6BvvRLaTZvl1m STRIPE_MASTERING_PRICE_PACK10=price_1UUd4z7OvUf6BvvRQyz16mJL --project-ref fleoxzauuvfbdysvadev
  ```

---

## Step 1 — Verify new key permissions

### What the code actually uses (from source analysis)
| Function | Stripe API calls |
|---|---|
| `create-checkout` | `stripe.checkout.sessions.create`, `stripe.coupons.create`, `stripe.checkout.sessions.expire` |
| `stripe-checkout` | `stripe.checkout.sessions.create` |
| `stripe-webhook` | `stripe.webhooks.constructEventAsync` |
| `verify-checkout` | `stripe.checkout.sessions.retrieve` |

### Required permissions for the restricted live key
When moving to live mode, create a restricted key with **only** these permissions:
- **Checkout Sessions** — Write (create, retrieve, expire)
- **Coupons** — Write (create)
- **Webhooks** — Read (only needed if managing webhooks via API, otherwise Dashboard-only)

**Do NOT grant** full-access keys. Use the restricted key policy.

---

## Step 2 — Configure environment-specific Supabase secrets

Configure staging and production separately in the Supabase dashboard. Staging must use the Stripe test API key, the `STRIPE_WEBHOOK_SECRET_TEST` for its test endpoint, and `STRIPE_EXPECT_LIVE_MODE=false`. Production must use the live API key, `STRIPE_WEBHOOK_SECRET_LIVE`, and `STRIPE_EXPECT_LIVE_MODE=true` (the code defaults to live mode if this setting is absent). The webhook rejects events whose mode does not match both the signing secret and deployment setting. Test-mode paid orders update staging payment status only; they never submit Printful fulfillment, send owner email, or grant mastering credits. Keep the older `STRIPE_WEBHOOK_SECRET` only as a documented migration fallback; do not use it to substitute for both mode-specific secrets. Never print or paste secret values.

Verify secret names and replacement timestamps/digests in the dashboard without revealing values. Confirm the Stripe key mode and webhook endpoint mode independently before enabling checkout.

---

## Step 3 — Verify the new key works (without charging)

1. In the Stripe Dashboard, choose the intended environment and inspect **Developers → API keys**.
2. Verify staging uses a test-mode key and production uses a live-mode key; use a read-only request against a session from the same mode if you need to validate permissions.
3. Confirm the request does not create, expire, refund, or charge a session.

Alternatively, from terminal (without revealing the key):
```bash
# This will return an error about the test session not existing,
# but proves the key is valid and has Checkout Sessions:Read permission
stripe checkout sessions retrieve cs_test_dummy \
  --api-key env:STRIPE_SECRET_KEY
```

---

## Step 4 — Revoke the old key safely

1. In the Stripe Dashboard → **Developers → API keys**
2. Find the old restricted key (`***REMOVED***`)
3. Verify no Edge Function in the Supabase dashboard is still using it (check secret digests)
4. Click **⋮ → Revoke**

**Warning:** Revoking before the new key is set and verified will cause checkout to fail with 503.

---

## Step 5 — Identify webhook endpoint and mode

### Current webhook endpoint
- **URL**: `https://fleoxzauuvfbdysvadev.supabase.co/functions/v1/stripe-webhook`
- **Registered in**: Stripe Dashboard → Developers → Webhooks
- **Events subscribed**: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `checkout.session.async_payment_failed`

### Mode verification
- The connected account currently reports live mode. The Edge Function key and webhook signing-secret modes remain unverified.
- Before switching or rotating keys, confirm the current environment, webhook endpoint, key mode, and secret digest in Stripe and Supabase. Never infer key mode from the account selector alone.
- Keep live checkout disabled until the live credentials, fulfillment mappings, notification route, and controlled purchase procedure have been reviewed.

---

## Step 6 — Create an isolated test endpoint

Use a separate Supabase staging project for test checkout. The deployed webhook supports `STRIPE_WEBHOOK_SECRET_TEST` and `STRIPE_WEBHOOK_SECRET_LIVE` and checks the event's live/test mode. Do not point test payments at production fulfilment or replace the production webhook secret with a test secret.

1. In the Stripe Dashboard → **Developers → Webhooks → [+ Add endpoint]**
2. Use the staging project's `stripe-webhook` URL.
3. Select the same 4 event types
4. Click **Add endpoint**
5. Copy the **signing secret** (starts with `whsec_`)
6. Set it as a secret:
   ```bash
   npx supabase secrets set STRIPE_WEBHOOK_SECRET_TEST=<test_endpoint_signing_secret> --project-ref <staging_project_ref>
   ```

---

## Step 7 — Send a genuine signed test event

### Using the Stripe CLI (recommended)
```bash
# Install the Stripe CLI first: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to <staging_project_ref>.supabase.co/functions/v1/stripe-webhook

# In another terminal, trigger a test event
stripe trigger checkout.session.completed \
  --add checkout.session:metadata[order_id]=test-order-123 \
  --add checkout.session:metadata[order_number]=AB16-TEST-001
```

### Using the Stripe Dashboard
1. Go to **Developers → Webhooks → [your endpoint] → [⋮] → Send test event**
2. Select event type: `checkout.session.completed`
3. Select a test checkout session (create one first via the Stripe Dashboard)
4. Send the event

---

## Step 8 — Resend the same event and verify idempotency

1. From the Stripe Dashboard → **Developers → Webhooks → [staging endpoint] → Event history**
2. Find a `checkout.session.completed` event in the list
3. Click **⋮ → Redeliver**
4. Observe the webhook function response:
   - For clothing: the order should already have `payment_status = 'paid'`, so `orders.update().eq('payment_status', 'pending')` affects 0 rows (no error)
   - For credits: `grant_mastering_credits` returns early because `payment.status = 'paid'`
   - For Printful: `submitPrintfulOrder` returns early because `confirmed_at` is already set
5. **Expected result**: 200 OK with `{ "received": true }` — no duplicate processing

---

## Automated test coverage for idempotency

| Test file | Tests | What it covers |
|---|---|---|
| `supabase/functions/stripe-webhook/idempotency.test.ts` | 35 | Pure-function idempotency checks: order already paid, payment already granted, expired payment not pending, Printful already confirmed/processing |
| `supabase/functions/create-checkout/checkout_validation.test.ts` | 23 | Variant validation: stock, Printful mapping, price, published status |
| `supabase/functions/verify-checkout/verification.test.ts` | 12 | Checkout session verification: paid/unpaid, currency mismatch, email mismatch, idempotency key acceptance |

**Important:** These are pure-function unit tests with mocked data. They do NOT replace end-to-end testing with real Stripe signatures. The genuine signed test event in Step 7 must be performed manually.

---

## Monitoring and manual reconciliation

Configure dashboard alerts separately; this repository cannot confirm or create provider alerts. At minimum, alert on sustained Edge Function 5xx responses and failed Stripe deliveries. Treat invalid-signature 400 responses as a separate security signal because they may be probes rather than failed customer payments. Review Supabase function logs for `create-checkout`, `verify-checkout`, `stripe-webhook`, and `printful-webhook`; review Stripe's endpoint delivery history and Resend's delivery status.

Use read-only aggregate checks in Supabase SQL Editor to find work needing attention without exposing customer details:

```sql
select status, count(*)
from public.processed_stripe_events
group by status
order by status;

select payment_status, fulfilment_status, count(*)
from public.orders
group by payment_status, fulfilment_status
order by payment_status, fulfilment_status;

select status, count(*)
from public.printful_orders
group by status
order by status;

select status, count(*)
from public.payment_records
group by status
order by status;
```

For a failed Stripe delivery, inspect its event and associated Checkout Session in Stripe first. Redeliver the same event from Stripe after correcting the underlying configuration; the webhook claims event IDs and is designed to prevent duplicate processing. Do not manually mark an order paid or fulfilled. For a Printful failure, inspect the existing `printful_orders` row and the provider order by external order number before retrying; preserve the external ID and existing row so the submission path can recover without creating a duplicate. Confirm successful email delivery in Resend before changing notification state. Escalate uncertain payment/fulfilment states for operator review rather than replaying a live payment or submitting a second fulfilment order.

---

## Rollout sequence

1. ⏳ Verify staging `STRIPE_WEBHOOK_SECRET_TEST` is the signing secret for the staging test endpoint
2. ⏳ Verify staging `STRIPE_SECRET_KEY` and frontend publishable key are test-mode credentials
3. ⏳ Verify test checkout flow end-to-end (Step 7)
4. ⏳ Redeliver test event to verify idempotency (Step 8)
5. ⏳ Printful sync variant IDs populated (see catalogue report)
6. ⏳ Legal pages reviewed and updated
7. ⏳ `ai_mastering_jobs` migration applied to production (see migration report)
8. ⏳ Switch to live mode: set live keys + live webhook secret
9. ⏳ Monitor for 24 hours before full cutover
