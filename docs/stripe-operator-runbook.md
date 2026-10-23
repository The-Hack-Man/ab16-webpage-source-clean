# Stripe Operator Runbook

## Prerequisites
- Stripe account access with Administrator or Developer role
- Supabase project admin access (project ref: `fleoxzauuvfbdysvadev`)
- Supabase CLI installed (`npx supabase@latest`)
- Printful operator access (for clothing fulfilment verification)

## Current State
- Stripe account is in **test mode** (keys are `sk_test_` / `pk_test_`)
- Live restricted key (`rk_live_...`) was rotated out — old key should be revoked
- Webhook endpoint registered for `fleoxzauuvfbdysvadev.supabase.co/functions/v1`
- `STRIPE_WEBHOOK_SECRET` is now set as a Supabase Edge Function secret
- `STRIPE_SECRET_KEY` is already set as a Supabase Edge Function secret

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

## Step 2 — Update Supabase production secret

```bash
# Replace <sk_live_xxx> with the new restricted live key
npx supabase secrets set STRIPE_SECRET_KEY=<sk_live_xxx>
```

**Verification after setting:**
```bash
npx supabase secrets list | grep -i stripe
```
Confirm the digest changes. Do NOT print or paste the key value.

---

## Step 3 — Verify the new key works (without charging)

1. From the Stripe Dashboard, go to **Developers → API keys**
2. Click the new restricted key → **Test on Stripe** or use the **API explorer**
3. Make a read-only call: `GET /v1/checkout/sessions/cs_test_xxx` (use a test session, not a real one)
4. Confirm the API returns 200 OK

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
2. Find the old restricted key (`STRIPE_LIVE_RESTRICTED_KEY_REMOVED`)
3. Verify no Edge Function in the Supabase dashboard is still using it (check secret digests)
4. Click **⋮ → Revoke**

**Warning:** Revoking before the new key is set and verified will cause checkout to fail with 503.

---

## Step 5 — Identify webhook endpoint and mode

### Current webhook endpoint
- **URL**: `https://fleoxzauuvfbdysvadev.supabase.co/functions/v1/stripe-webhook`
- **Registered in**: Stripe Dashboard → Developers → Webhooks
- **Events subscribed**: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `checkout.session.async_payment_failed`

### Current mode
- The account is currently in **test mode** (test keys set)
- To switch to **live mode**:
  1. Toggle the Stripe Dashboard to **Live mode** (switch in the top bar)
  2. Update the webhook signing secret to the **live** version
  3. Set `STRIPE_SECRET_KEY` to the **live** `sk_live_` key

---

## Step 6 — Create an isolated test endpoint

1. In the Stripe Dashboard → **Developers → Webhooks → [+ Add endpoint]**
2. URL: `https://fleoxzauuvfbdysvadev.supabase.co/functions/v1/stripe-webhook` (same endpoint — it handles both test and live based on the key)
3. Select the same 4 event types
4. Click **Add endpoint**
5. Copy the **signing secret** (starts with `whsec_`)
6. Set it as a secret:
   ```bash
   npx supabase secrets set STRIPE_WEBHOOK_SECRET=<whsec_live_xxx>
   ```

---

## Step 7 — Send a genuine signed test event

### Using the Stripe CLI (recommended)
```bash
# Install the Stripe CLI first: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to fleoxzauuvfbdysvadev.supabase.co/functions/v1/stripe-webhook

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

1. From the Stripe Dashboard → **Developers → Webhooks → [your endpoint] → Event history**
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

## Rollout sequence

1. ✅ `STRIPE_WEBHOOK_SECRET` set (completed)
2. ✅ `STRIPE_SECRET_KEY` present in secrets (test key currently)
3. ⏳ Verify test checkout flow end-to-end (Step 7)
4. ⏳ Redeliver test event to verify idempotency (Step 8)
5. ⏳ Printful sync variant IDs populated (see catalogue report)
6. ⏳ Legal pages reviewed and updated
7. ⏳ `ai_mastering_jobs` migration applied to production (see migration report)
8. ⏳ Switch to live mode: set live keys + live webhook secret
9. ⏳ Monitor for 24 hours before full cutover
