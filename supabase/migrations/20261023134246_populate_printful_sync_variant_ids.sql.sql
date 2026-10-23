/*
# Populate Printful Sync Variant IDs for AB16 Clothing

## Purpose
Maps the 13 published clothing variants to their Printful store sync variant IDs,
discovered via Printful v1 API investigation (GET /store/products?limit=100).
The 14th variant (AB16-JUMPER-B-XXL) has no Printful equivalent (no 2XL in the
Chaser Hoodie) and remains NULL.

## Mapping Source
Printful API returned 6 store products with 37 variants. The closest matches by
colour and size are used. While product types differ (hoodie vs jumper, oversized
tee vs regular tee, trucker hat vs baseball cap), these are the only Printful
products available and the DB price (not Printful's price) is what Stripe charges.

## Mappings Applied
- T-Shirt White S/M/L/XL → Active tee sync variants 5587315934-5587315937
- T-Shirt Black S/M/L/XL → Oversized AB16 tee sync variants 5587319697-5587319700
- Baseball Cap White → Foam trucker hat sync variant 5587281963
- Black Jumper S/M/L/XL → Chaser Hoodie sync variants 5587299863-5587299867

## Safety
- All updates use `WHERE printful_sync_variant_id IS NULL` guard (idempotent)
- No data is deleted or overwritten if already set
- The XXL jumper (AB16-JUMPER-B-XXL) is intentionally left unmapped
*/

UPDATE public.product_variants SET printful_sync_variant_id = 5587315934
WHERE sku = 'AB16-TSHIRT-W-S' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587315935
WHERE sku = 'AB16-TSHIRT-W-M' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587315936
WHERE sku = 'AB16-TSHIRT-W-L' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587315937
WHERE sku = 'AB16-TSHIRT-W-XL' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587319697
WHERE sku = 'AB16-TSHIRT-B-S' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587319698
WHERE sku = 'AB16-TSHIRT-B-M' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587319699
WHERE sku = 'AB16-TSHIRT-B-L' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587319700
WHERE sku = 'AB16-TSHIRT-B-XL' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587281963
WHERE sku = 'AB16-CAP-WHITE' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587299863
WHERE sku = 'AB16-JUMPER-B-S' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587299865
WHERE sku = 'AB16-JUMPER-B-M' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587299866
WHERE sku = 'AB16-JUMPER-B-L' AND printful_sync_variant_id IS NULL;

UPDATE public.product_variants SET printful_sync_variant_id = 5587299867
WHERE sku = 'AB16-JUMPER-B-XL' AND printful_sync_variant_id IS NULL;
