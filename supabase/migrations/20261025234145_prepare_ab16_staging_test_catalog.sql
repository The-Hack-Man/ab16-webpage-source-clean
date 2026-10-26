-- Staging-only checkout preparation. Do not apply to production.
-- Enable the two tee products only after exact SKU matches to the production
-- Printful sync mapping and catalog variant export have been verified.
alter table public.product_variants
  add column if not exists printful_sync_variant_id bigint,
  add column if not exists printful_catalog_variant_id bigint;

with verified_mapping(sku, sync_variant_id, catalog_variant_id) as (
  values
    ('AB16-TSHIRT-W-S', 5587315934::bigint, 52014::bigint),
    ('AB16-TSHIRT-W-M', 5587315935::bigint, 52013::bigint),
    ('AB16-TSHIRT-W-L', 5587315936::bigint, 52012::bigint),
    ('AB16-TSHIRT-W-XL', 5587315937::bigint, 52015::bigint),
    ('AB16-TSHIRT-B-S', 5587319697::bigint, 50106::bigint),
    ('AB16-TSHIRT-B-M', 5587319698::bigint, 50086::bigint),
    ('AB16-TSHIRT-B-L', 5587319699::bigint, 50117::bigint),
    ('AB16-TSHIRT-B-XL', 5587319700::bigint, 50107::bigint)
)
update public.product_variants as variant
set printful_sync_variant_id = mapping.sync_variant_id,
    printful_catalog_variant_id = mapping.catalog_variant_id
from verified_mapping as mapping
where variant.sku = mapping.sku;

update public.products as product
set price = 2200,
    available_for_sale = (
      select count(*) = 4
      from public.product_variants as variant
      where variant.product_id = product.id
        and variant.printful_sync_variant_id is not null
        and variant.printful_catalog_variant_id is not null
    ),
    updated_at = now()
where product.slug in ('ab16-tshirt-white', 'ab16-tshirt-black');

-- These staging products do not have verified UK mappings in this setup.
update public.products
set available_for_sale = false,
    updated_at = now()
where slug in ('ab16-baseball-cap', 'ab16-jumper', 'ab16-tracksuit');
