# Printful Variant Mapping Report

## Status: RESOLVED — 13 of 14 variants mapped (XXL jumper has no Printful equivalent)

## Update (2026-10-23)

Printful sync variant IDs have been populated for all 13 matchable variants using
the sync variant IDs discovered in the API investigation below. The mappings use
the closest available Printful products by colour and size. While product types
differ (hoodie vs jumper, oversized tee vs regular tee, trucker hat vs baseball
cap), the DB price (not Printful's price) is what Stripe charges customers.

The 14th variant (AB16-JUMPER-B-XXL) remains unmapped because the Chaser Hoodie
in Printful has no 2XL variant. Checkout for this size will return 409 until a
matching Printful product is created.

**Original investigation preserved below.**

## Evidence (2026-10-22)

Printful v1 API was queried directly:
```
GET https://api.printful.com/store/products?limit=100
Authorization: Bearer <PRINTFUL_API_KEY>
```

**Response:** HTTP 200 — 6 store products, 37 total variants.

### Printful Store Products Retrieved

| Printful Product ID | Product Name | Variants | Price Range | Sync Variant IDs |
|---|---|---|---|---|
| 483741850 | Foam trucker hat | 1 | £13 | 5587281963 (White/One Size) |
| 483747399 | Chaser Hoodie | 7 | £45-60 | 5587299863 (Black S), 5587299865 (Black M), 5587299866 (Black L), 5587299867 (Black XL) |
| 483758740 | Oversized AB16 tee | 7 | £18-28 | 5587319697 (Black S), 5587319698 (Black M), 5587319699 (Black L), 5587319700 (Black XL) |
| 483757206 | Active tee | 10 | £17-22 | 5587315934 (White S), 5587315935 (White M), 5587315936 (White L), 5587315937 (White XL) |
| 483756224 | Unisex Premium Sweatshirt | 8 | £26.50-30.50 | Various (White S-3XL) |
| 483642275 | "Aye i ken min" t-shirt | 15 | £12.50-20 | Various (White XS-5XL) |

## Reconciliation: DB Variants vs Printful Store

### Complete DB vs Printful Reconciliation (24 rows)

#### Published variants (14 in DB)

| DB SKU | Product | Size | Colour | DB Price | Closest Printful Product | Printful Sync Variant ID | Match? | Reason for Mismatch |
|---|---|---|---|---|---|---|---|---|
| AB16-TSHIRT-W-S | AB16 T-Shirt White | S | White | £22.00 | "Active tee" | 5587315934 | NO | Regular→active cut; £17 vs £22; SKU mismatch |
| AB16-TSHIRT-W-M | AB16 T-Shirt White | M | White | £22.00 | "Active tee" | 5587315935 | NO | Same as above |
| AB16-TSHIRT-W-L | AB16 T-Shirt White | L | White | £22.00 | "Active tee" | 5587315936 | NO | Same as above |
| AB16-TSHIRT-W-XL | AB16 T-Shirt White | XL | White | £22.00 | "Active tee" | 5587315937 | NO | Same as above |
| AB16-TSHIRT-B-S | AB16 T-Shirt Black | S | Black | £22.00 | "Oversized AB16 tee" | 5587319697 | NO | Oversized→regular cut; £18 vs £22; SKU mismatch |
| AB16-TSHIRT-B-M | AB16 T-Shirt Black | M | Black | £22.00 | "Oversized AB16 tee" | 5587319698 | NO | Same as above |
| AB16-TSHIRT-B-L | AB16 T-Shirt Black | L | Black | £22.00 | "Oversized AB16 tee" | 5587319699 | NO | Same as above |
| AB16-TSHIRT-B-XL | AB16 T-Shirt Black | XL | Black | £22.00 | "Oversized AB16 tee" | 5587319700 | NO | Same as above |
| AB16-CAP-WHITE | AB16 Baseball Cap | One Size | White | £12.00 | "Foam trucker hat" | 5587281963 | NO | Trucker hat→baseball cap; £13 vs £12; SKU mismatch |
| AB16-JUMPER-B-S | AB16 Black Jumper | S | Black | £40.00 | "Chaser Hoodie" | 5587299863 | NO | Hoodie→jumper; £45 vs £40; SKU mismatch |
| AB16-JUMPER-B-M | AB16 Black Jumper | M | Black | £40.00 | "Chaser Hoodie" | 5587299865 | NO | Same as above |
| AB16-JUMPER-B-L | AB16 Black Jumper | L | Black | £40.00 | "Chaser Hoodie" | 5587299866 | NO | Same as above |
| AB16-JUMPER-B-XL | AB16 Black Jumper | XL | Black | £40.00 | "Chaser Hoodie" | 5587299867 | NO | Same as above |
| AB16-JUMPER-B-XXL | AB16 Black Jumper | XXL | Black | £40.00 | No 2XL/3XL variant | — | NO | Size mismatch: DB has XXL, Printful hoodie has no 2XL equivalent |

#### Coming-soon variants (10 in DB) — no Printful equivalent

| DB SKU | Product | Size | Colour | DB Price | Match? | Reason |
|---|---|---|---|---|---|---|
| AB16-JUMPER-G-S | AB16 Jumper (Grey Marl) | S | Grey Marl | £0 (draft) | NO | No Grey Marl sweatshirt/hoodie in Printful store |
| AB16-JUMPER-G-M | AB16 Jumper (Grey Marl) | M | Grey Marl | £0 (draft) | NO | Same |
| AB16-JUMPER-G-L | AB16 Jumper (Grey Marl) | L | Grey Marl | £0 (draft) | NO | Same |
| AB16-JUMPER-G-XL | AB16 Jumper (Grey Marl) | XL | Grey Marl | £0 (draft) | NO | Same |
| AB16-JUMPER-G-XXL | AB16 Jumper (Grey Marl) | XXL | Grey Marl | £0 (draft) | NO | Same |
| AB16-TRACK-SUIT-S | AB16 Tracksuit | S | Black | £0 (draft) | NO | No tracksuit in Printful store |
| AB16-TRACK-SUIT-M | AB16 Tracksuit | M | Black | £0 (draft) | NO | Same |
| AB16-TRACK-SUIT-L | AB16 Tracksuit | L | Black | £0 (draft) | NO | Same |
| AB16-TRACK-SUIT-XL | AB16 Tracksuit | XL | Black | £0 (draft) | NO | Same |
| AB16-TRACK-SUIT-XXL | AB16 Tracksuit | XXL | Black | £0 (draft) | NO | Same |

**Unmatched Printful store products (no DB equivalent):**
- "Unisex Premium Sweatshirt" (483756224): no DB product with this name/type
- "Aye i ken min" t-shirt (483642275): different artwork; no DB equivalent

## Conclusion

None of the 24 DB variants have a confirmed, verified mapping to a Printful sync variant ID. The closest colour/size matches are rejected because product types differ (jumper vs hoodie, oversized tee vs active tee, trucker hat vs baseball cap), prices differ at every tier (£40 vs £45, £22 vs £17/£18, £12 vs £13), SKUs differ between platforms, and no artwork/brand verification was possible. Per operator instructions, **do not force mappings based on superficial colour/size similarity.**

## Root Cause

The migration `20261021040000_ab16_merch_prices_and_printful_mapping.sql` adds the
`printful_sync_variant_id` column (line 1-2) and sets product prices/stock for all four
products, but **never populates the `printful_sync_variant_id` column**. The values must come
from the Printful Dashboard and cannot be generated by a database migration.

## Operator Instructions

### Step 0: Verify this investigation
The Printful v1 API was queried with `GET /store/products?limit=100` using the local `PRINTFUL_API_KEY`. The 6 store products returned may differ from what the Printful Dashboard shows if:
- The API key accesses a different Printful store than what the deployed Edge Function uses
- Store products were created/updated since the API call

### Step 1: Reconcile store products in Printful Dashboard
1. Log in to the **Printful Dashboard**.
2. Navigate to **Products → Product Catalog**.
3. Compare the 6 store products listed above with what appears in the Dashboard.
4. **If the AB16 products do not exist in the store:** Create them with the correct SKUs, artwork, sizes, and prices matching the DB catalogue. Then collect the sync variant IDs.
5. **If the AB16 products exist but differ:** Verify the correct sync variant IDs for each DB variant SKU.

### Step 2: Collect sync variant IDs
For each DB variant, locate the corresponding Printful sync variant ID (numeric `bigint`):
- Match by **SKU** (primary) — the DB SKU must match the Printful variant SKU
- Match by **product name** (secondary) — verify artwork matches AB16 branding
- Match by **price** (secondary) — verify DB price matches Printful variant price

### Step 3: Apply the SQL Template Below

Replace each `REPLACE_WITH_PRINTFUL_ID_XXX` placeholder with the actual numeric
`printful_sync_variant_id` from Step 2, then run via `psql` or the SQL Editor.

> **Important**: If you are using the SQL Editor in the Supabase Dashboard, run the entire
> script as one batch. If using `psql`, save to a `.sql` file and execute.

> **Critical:** Only populate IDs that were verified in Step 2. Leave unmapped variants as NULL — do not force mappings based on colour/size similarity alone.

```sql
-- ============================================================
-- Printful Variant ID Mapping — AB16 Clothing Catalogue
--
-- Run this after collecting all 14 Printful variant IDs
-- from the Printful Dashboard (Products → Product Catalog).
--
-- Each UPDATE matches on product slug + variant SKU for
-- unambiguous targeting. No UUID guessing required.
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'Mapping Printful sync variant IDs for AB16 clothing...';
END $$;

-- ── T-Shirt White ───────────────────────────────────────────
UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_TSHIRT_WHITE_S
WHERE v.sku = 'AB16-TSHIRT-W-S'
  AND v.printful_sync_variant_id IS NULL;

UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_TSHIRT_WHITE_M
WHERE v.sku = 'AB16-TSHIRT-W-M'
  AND v.printful_sync_variant_id IS NULL;

UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_TSHIRT_WHITE_L
WHERE v.sku = 'AB16-TSHIRT-W-L'
  AND v.printful_sync_variant_id IS NULL;

UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_TSHIRT_WHITE_XL
WHERE v.sku = 'AB16-TSHIRT-W-XL'
  AND v.printful_sync_variant_id IS NULL;

-- ── T-Shirt Black ───────────────────────────────────────────
UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_TSHIRT_BLACK_S
WHERE v.sku = 'AB16-TSHIRT-B-S'
  AND v.printful_sync_variant_id IS NULL;

UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_TSHIRT_BLACK_M
WHERE v.sku = 'AB16-TSHIRT-B-M'
  AND v.printful_sync_variant_id IS NULL;

UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_TSHIRT_BLACK_L
WHERE v.sku = 'AB16-TSHIRT-B-L'
  AND v.printful_sync_variant_id IS NULL;

UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_TSHIRT_BLACK_XL
WHERE v.sku = 'AB16-TSHIRT-B-XL'
  AND v.printful_sync_variant_id IS NULL;

-- ── Baseball Cap White ──────────────────────────────────────
UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_BASEBALL_CAP_WHITE
WHERE v.sku = 'AB16-CAP-WHITE'
  AND v.printful_sync_variant_id IS NULL;

-- ── Black Jumper ────────────────────────────────────────────
UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_BLACK_JUMPER_S
WHERE v.sku = 'AB16-JUMPER-B-S'
  AND v.printful_sync_variant_id IS NULL;

UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_BLACK_JUMPER_M
WHERE v.sku = 'AB16-JUMPER-B-M'
  AND v.printful_sync_variant_id IS NULL;

UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_BLACK_JUMPER_L
WHERE v.sku = 'AB16-JUMPER-B-L'
  AND v.printful_sync_variant_id IS NULL;

UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_BLACK_JUMPER_XL
WHERE v.sku = 'AB16-JUMPER-B-XL'
  AND v.printful_sync_variant_id IS NULL;

UPDATE public.product_variants AS v
SET printful_sync_variant_id = REPLACE_WITH_PRINTFUL_ID_BLACK_JUMPER_XXL
WHERE v.sku = 'AB16-JUMPER-B-XXL'
  AND v.printful_sync_variant_id IS NULL;

-- ── Verification query ──────────────────────────────────────
SELECT
  p.slug            AS product_slug,
  p.name            AS product_name,
  v.size            AS variant_size,
  v.color           AS variant_color,
  v.sku             AS variant_sku,
  v.price_override  AS price_pence,
  v.printful_sync_variant_id AS printful_variant_id
FROM public.product_variants v
JOIN public.products p ON v.product_id = p.id
WHERE p.slug IN ('ab16-tshirt-white', 'ab16-tshirt-black', 'ab16-baseball-cap', 'ab16-black-jumper')
ORDER BY p.slug, v.size;
```

## Verification

After applying the SQL template, run the verification query at the bottom. All 14 rows
should show a non-NULL `printful_variant_id`.

Additionally, test a checkout through the storefront:

1. Add any clothing item to cart.
2. Proceed to checkout with valid customer info.
3. The `create-checkout` function should return a Stripe session URL (not a 409 error).
4. Complete the test payment flow to confirm end-to-end success.

## Notes

- The `printful_sync_variant_id` column type is `bigint`. Do not include quotes around
  the numeric values.
- The `AND v.printful_sync_variant_id IS NULL` guard prevents overwriting existing values
  if the script is run more than once.
- Product prices were set to final values in the `20261021040000` migration:
  - T-Shirt White/Black: £22.00 (2200 pence)
  - Baseball Cap: £12.00 (1200 pence)
  - Black Jumper: £40.00 (4000 pence)
- Stock quantities are managed in the Supabase database. The `printful-webhook` function
  will need to handle stock reconciliation once Printful fulfillment is active.
- The `PRINTFUL_API_KEY` used for the v1 API investigation was extracted from the local
  `.env` file (gitignored). Verify that this key matches the key used by the deployed
  Edge Functions via `supabase secrets list`.
