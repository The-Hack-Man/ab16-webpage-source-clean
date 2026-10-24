-- Fail closed at both the checkout API and the public catalogue until every
-- purchasable variant has a verified Printful sync variant mapping.
-- This is reversible after the Printful IDs are confirmed.
UPDATE public.products AS p
SET available_for_sale = false,
    availability_label = 'Fulfilment setup pending',
    updated_at = now()
WHERE p.status = 'published'
  AND EXISTS (
    SELECT 1
    FROM public.product_variants AS v
    WHERE v.product_id = p.id
      AND (v.printful_sync_variant_id IS NULL OR v.printful_sync_variant_id <= 0)
  );
