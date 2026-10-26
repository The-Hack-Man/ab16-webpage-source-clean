-- Keep Printful product and sync-variant identities in the database so catalog
-- imports and future provider updates can reconcile without SKU spreadsheets.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS printful_product_id bigint,
  ADD COLUMN IF NOT EXISTS printful_managed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS printful_synced_at timestamptz;

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS source_key text;

CREATE UNIQUE INDEX IF NOT EXISTS products_printful_product_id_uidx
  ON public.products (printful_product_id)
  WHERE printful_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_printful_sync_variant_id_uidx
  ON public.product_variants (printful_sync_variant_id)
  WHERE printful_sync_variant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_images_product_source_key_uidx
  ON public.product_images (product_id, source_key)
  WHERE source_key IS NOT NULL;
