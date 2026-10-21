# AB16 Launch Checklist

**Date**: 2026-10-21  
**Status**: Staging Ready — 3 BLOCKERs + 5 WARNINGs require operator action  
**Prerequisites**: Supabase CLI installed, Docker/Podman unavailable  

---

## BLOCKER 1: Populate Printful Variant IDs

**Owner**: Printful Dashboard operator  
**Time estimate**: 15-30 minutes  

The `create-checkout` function checks `printful_sync_variant_id` and returns HTTP 409 if NULL. All 14 published variants are missing this value.

### Steps
1. Open [Printful Dashboard](https://app.printful.com/) → Products → choose a product
2. For each variant, note the **sync variant ID** (numeric `bigint`, NOT the catalog variant ID)
3. Map each variant by SKU (see table below)
4. Run the SQL from `docs/printful-variant-mapping-report.md` with the correct IDs

### Variant Mapping Table

| SKU | Product | Size | Current printful_sync_variant_id |
|-----|---------|------|----------------------------------|
| AB16-TSHIRT-W-S | AB16 T-Shirt (White) | Small | NULL |
| AB16-TSHIRT-W-M | AB16 T-Shirt (White) | Medium | NULL |
| AB16-TSHIRT-W-L | AB16 T-Shirt (White) | Large | NULL |
| AB16-TSHIRT-W-XL | AB16 T-Shirt (White) | XL | NULL |
| AB16-TSHIRT-B-S | AB16 T-Shirt (Black) | Small | NULL |
| AB16-TSHIRT-B-M | AB16 T-Shirt (Black) | Medium | NULL |
| AB16-TSHIRT-B-L | AB16 T-Shirt (Black) | Large | NULL |
| AB16-TSHIRT-B-XL | AB16 T-Shirt (Black) | XL | NULL |
| AB16-CAP-WHITE | AB16 Baseball Cap (White) | One Size | NULL |
| AB16-JUMPER-B-S | AB16 Jumper (Black) | Small | NULL |
| AB16-JUMPER-B-M | AB16 Jumper (Black) | Medium | NULL |
| AB16-JUMPER-B-L | AB16 Jumper (Black) | Large | NULL |
| AB16-JUMPER-B-XL | AB16 Jumper (Black) | XL | NULL |
| AB16-JUMPER-B-XXL | AB16 Jumper (Black) | XXL | NULL |

### Verification
```sql
SELECT sku, printful_sync_variant_id
FROM product_variants v
JOIN products p ON v.product_id = p.id
WHERE v.printful_sync_variant_id IS NULL;
-- Should return 0 rows
```

---

## BLOCKER 2: Rotate Stripe Keys to Live Mode

**Owner**: Stripe Dashboard operator  
**Time estimate**: 5-10 minutes  

The platform is currently in TEST mode. All payments will fail or create test-mode charges.

### Steps
1. Open [Stripe Dashboard](https://dashboard.stripe.com/) → Developers → API keys
2. Create a new **secret key** in Live mode: copy `sk_live_...`
3. Open [Stripe Dashboard](https://dashboard.stripe.com/) → Developers → Webhooks
4. Find the webhook endpoint for this Supabase project
5. Copy the **live signing secret**: `whsec_...`
6. Set both as Supabase secrets:
   ```bash
   npx supabase secrets set STRIPE_SECRET_KEY=<sk_live_...>
   npx supabase secrets set STRIPE_WEBHOOK_SECRET=<whsec_...>
   ```

### Verification
```bash
npx supabase secrets list
# Confirm values start with sk_live_ and whsec_ (not sk_test_ / whsec_test_)
```

### ⚠️ Important
- The `.env` file's `VITE_STRIPE_PUBLISHABLE_KEY` must also be changed to the **live** publishable key (`pk_live_...`)
- Redeploy the frontend after changing the publishable key

---

## BLOCKER 3: Verify Webhook Idempotency

**Owner**: Stripe Dashboard operator  
**Time estimate**: 5 minutes  

The `stripe-webhook` now has event-level dedup via `processed_stripe_events`. Must verify with a real signed event.

### Steps
1. Open [Stripe Dashboard](https://dashboard.stripe.com/) → Developers → Webhooks
2. Find the webhook endpoint → click "..." → "Send test event"
3. Select `checkout.session.completed`
4. Send the event
5. **Send it a second time** (duplicate delivery)

### Verification
Check the database:
```sql
SELECT
  event_id,
  status,
  attempt_count,
  completed_at,
  failed_at,
  last_error
FROM processed_stripe_events
WHERE event_id LIKE '%your_test_event_id%'
ORDER BY received_at DESC;
```

Expected: The event should be recorded once as `completed`. The second delivery should return early (no processing, no duplicate orders).

### Also verify
- No duplicate rows in `orders` or `order_items` for the test session
- No duplicate Printful orders created

---

## WARNING 1: Legal Page Content

**Owner**: Business owner  
**Time estimate**: 30-60 minutes  

All 5 legal pages exist but contain placeholder content with disclaimers. The business owner must review and replace with actual content.

### Pages to review
| Route | File | Content Status |
|-------|------|----------------|
| `/privacy` | `src/pages/Legal/PrivacyPage.tsx` | Placeholder disclaimer |
| `/terms` | `src/pages/Legal/TermsPage.tsx` | Placeholder disclaimer |
| `/cookies` | `src/pages/Legal/CookiesPage.tsx` | Placeholder disclaimer |
| `/shipping-returns` | `src/pages/Legal/ShippingReturnsPage.tsx` | Placeholder disclaimer |
| `/contact` | `src/pages/ContactPage.tsx` | Placeholder contact info |

### `site_settings` to confirm
```sql
SELECT
  business_name,
  store_address,
  website_url,
  contact_email
FROM site_settings
LIMIT 1;
```

Required information to fill in:
- [ ] Legally registered company name
- [ ] Company registration number (if applicable)
- [ ] Full registered business address
- [ ] Returns policy (duration, condition requirements, who pays return shipping)
- [ ] Cookie list (Google Analytics, Stripe, etc.)
- [ ] Data retention periods (orders: X years, newsletter: until unsubscribe)
- [ ] Contact email and phone number

---

## WARNING 2: Printful Account Setup

**Owner**: Printful Dashboard operator  
**Time estimate**: 30-60 minutes  

### Steps
1. Verify `PRINTFUL_API_KEY` secret is set in Supabase:
   ```bash
   npx supabase secrets list | grep PRINTFUL
   ```
2. Open [Printful Dashboard](https://app.printful.com/) → Settings → Stores
3. Verify the store is connected and not in "paused" status
4. Verify the following products are in Printful as "Synced products" (not just catalog):
   - AB16 T-Shirt (White) — sync to Printful if not already
   - AB16 T-Shirt (Black) — sync to Printful
   - AB16 Baseball Cap (White) — sync to Printful
   - AB16 Jumper (Black) — sync to Printful
5. For each synced variant, note the `sync_variant_id` (see BlockER 1)

### ⚠️ Important
The `stripe-webhook` sends orders to Printful via API. If products are not synced in Printful, order submission will fail.

---

## WARNING 3: Shipping Zones Configuration

**Owner**: Printful Dashboard operator  
**Time estimate**: 10-15 minutes  

### Steps
1. Open [Printful Dashboard](https://app.printful.com/) → Settings → Shipping
2. Verify shipping rates are configured for:
   - [ ] United Kingdom (domestic)
   - [ ] Ireland (EU)
3. Confirm the `create-checkout` function's origin validation allows these:
   ```js
   // checkout_validation.ts — verify GB and IE are allowed
   const ALLOWED_COUNTRIES = ['GB', 'IE'];
   ```

---

## WARNING 4: Email Configuration (Resend)

**Owner**: Technical operator  
**Time estimate**: 10 minutes  

### Steps
1. Verify `RESEND_API_KEY` is set in Supabase secrets
2. Verify `ADMIN_ORDER_EMAIL` is set (where order notifications are sent)
3. Verify `FROM_EMAIL` is set (must be a verified domain in Resend)
4. Open [Resend Dashboard](https://resend.com/) → Emails → verify the sending domain

---

## WARNING 5: Deploy Updated stripe-webhook Function

**Owner**: Supabase operator  
**Time estimate**: 5 minutes  

The `stripe-webhook/index.ts` has been updated to use event-level idempotency. Must be deployed.

### Steps
```bash
cd /project
npx supabase db push --linked
npx supabase functions deploy stripe-webhook
```

> **Note**: `supabase db push --linked` will deploy the new migration `20261021140000_stripe_webhook_event_dedup.sql` to the production database. This adds columns to `processed_stripe_events` — safe for re-run via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

### Verification
- After deployment, check function logs for 200 responses on webhook events
- Verify no duplicate `orders` created after duplicate event delivery

---

## WARNING 6: Deploy Undeployed Functions (Optional)

**Owner**: Supabase operator  
**Time estimate**: 5 minutes  

### `publish-release`
- Configured with `verify_jwt = true`
- Intended for admin users to trigger website updates
- Deploy if content publishing workflow is needed:
  ```bash
  npx supabase functions deploy publish-release
  ```

### `scheduler-tick`
- Configured with `verify_jwt = false`
- Intended to be called by a cron job (e.g., every minute)
- Uses engine's `runOutboxTick()` and `runSchedulerTick()` to process jobs
- Deploy if automated job processing is needed:
  ```bash
  npx supabase functions deploy scheduler-tick
  ```
- After deployment, set up a cron trigger (e.g., using cron-job.org or a serverless cron)

---

## Pre-Launch Testing Checklist

Before going live, verify the full purchase flow works end-to-end with a **test** Stripe key:

| Step | Test | Expected |
|------|------|----------|
| 1 | Visit homepage | Loads with products, music releases, videos |
| 2 | Add clothing item to cart | Cart persists in localStorage |
| 3 | Go to checkout | Form validates client + server |
| 4 | Complete checkout with test card | Stripe test mode: `4242 4242 4242 4242` |
| 5 | Return to success page | Shows "paid" status |
| 6 | Check webhook logs | Event processed, order created, Printful notified |
| 7 | Check database | Order in `orders`, `order_items` correct |
| 8 | Check dashboard | Order in Printful dashboard as "Unfulfilled" |
| 9 | Test mastering credit purchase | Stripe checkout → webhook → credits granted |
| 10 | Test mastering demo | 30s preview works, credit consumption blocks on unpaid |
| 11 | Redeliver webhook event | No duplicate order created (idempotency) |
| 12 | Test contact form | Submits to `contact_enquiries` |
| 13 | Test newsletter signup | Submits to `newsletter_subscribers` |

---

## Post-Launch Monitoring

| Metric | Where to check | Alert threshold |
|--------|---------------|-----------------|
| Webhook errors | Supabase Functions → Logs | > 5 errors/hour |
| Failed orders | `orders` table where `payment_status='failed'` | > 2% of total |
| Printful submission failures | `printful_orders` where `status='failed'` | > 1% |
| Mastering jobs | `ai_mastering_jobs` table | Monitor after deploy |
| Stripe events | `processed_stripe_events` where `status='failed'` | Any failures |

---

## Summary

| Item | Status | Owner | Action |
|------|--------|-------|--------|
| Printful variant IDs | BLOCKER | Printful operator | Populate 14 sync_variant_ids |
| Stripe live keys | BLOCKER | Stripe operator | Rotate to sk_live_ + whsec_live_ |
| Idempotency verification | BLOCKER | Stripe operator | Redeliver signed test event |
| Legal page content | WARNING | Business owner | Review/replace placeholder content |
| site_settings data | WARNING | Business owner | Confirm company details |
| Printful store setup | WARNING | Printful operator | Verify products are synced |
| Shipping zones | WARNING | Printful operator | Verify UK + Ireland rates |
| Email config | WARNING | Tech operator | Verify Resend API + domain |
| Deploy webhook update | WARNING | Supabase operator | Deploy stripe-webhook function |
| Deploy optional functions | WARNING | Supabase operator | Deploy publish-release, scheduler-tick |

**Minimum to go live**: Resolve all 3 BLOCKERs + Warnings 4-6 (email, webhook deploy, legal review).
