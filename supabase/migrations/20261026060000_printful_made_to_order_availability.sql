alter table public.product_variants
  add column if not exists printful_availability_status text;

alter table public.product_variants
  drop constraint if exists product_variants_printful_availability_status_check;

alter table public.product_variants
  add constraint product_variants_printful_availability_status_check
  check (printful_availability_status is null or printful_availability_status in (
    'active', 'discontinued', 'out_of_stock', 'temporary_out_of_stock'
  ));

-- Existing Printful mappings are made-to-order. The next catalog sync refreshes
-- these provisional active values from Printful's canonical availability state.
update public.product_variants
set printful_availability_status = 'active'
where printful_sync_variant_id is not null
  and printful_availability_status is null;
