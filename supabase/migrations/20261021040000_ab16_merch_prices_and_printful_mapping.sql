ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS printful_sync_variant_id bigint;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS owner_order_notified_at timestamptz;

ALTER TABLE public.printful_orders
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

UPDATE public.products
SET price = 2200,
    available_for_sale = true,
    availability_label = 'In Stock'
WHERE slug IN ('ab16-tshirt-white', 'ab16-tshirt-black');

UPDATE public.product_variants AS variant
SET price_override = 2200
FROM public.products AS product
WHERE variant.product_id = product.id
  AND product.slug IN ('ab16-tshirt-white', 'ab16-tshirt-black');

UPDATE public.products
SET price = 1200,
    available_for_sale = true,
    availability_label = 'In Stock'
WHERE slug = 'ab16-baseball-cap';

UPDATE public.product_variants AS variant
SET price_override = 1200
FROM public.products AS product
WHERE variant.product_id = product.id
  AND product.slug = 'ab16-baseball-cap';

UPDATE public.products
SET price = 0,
    available_for_sale = false,
    availability_label = 'TBA'
WHERE slug IN ('ab16-jumper', 'ab16-tracksuit');

UPDATE public.product_variants AS variant
SET stock = 0
FROM public.products AS product
WHERE variant.product_id = product.id
  AND product.slug IN ('ab16-jumper', 'ab16-tracksuit');

INSERT INTO public.products (
  slug, name, description, story, price, category_slug, status, featured,
  is_new_arrival, is_limited_drop, available_for_sale, availability_label,
  material_care, delivery_info, seo_title, seo_description
) VALUES (
  'ab16-black-jumper',
  'AB16 Jumper (Black)',
  'The AB16 jumper in black.',
  'A black AB16 staple from the first clothing drop.',
  4000,
  'hoodies',
  'published',
  true,
  true,
  false,
  true,
  'In Stock',
  'Follow the care instructions on the garment label.',
  'UK delivery available at checkout.',
  'AB16 Black Jumper — AB16 Clothing',
  'The AB16 black jumper.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  status = EXCLUDED.status,
  available_for_sale = EXCLUDED.available_for_sale,
  availability_label = EXCLUDED.availability_label;

INSERT INTO public.product_variants (product_id, size, color, sku, stock, price_override)
SELECT product.id, sizes.size, 'Black', 'AB16-JUMPER-B-' || sizes.size, 20, 4000
FROM public.products AS product
CROSS JOIN (VALUES ('S'), ('M'), ('L'), ('XL'), ('XXL')) AS sizes(size)
WHERE product.slug = 'ab16-black-jumper'
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_variants AS existing
    WHERE existing.product_id = product.id
      AND existing.size = sizes.size
      AND existing.color = 'Black'
  );

INSERT INTO public.product_images (product_id, url, alt_text, position)
SELECT product.id, '/images/merch/opt/ab16-jumper-black.webp', 'Black AB16 jumper', 0
FROM public.products AS product
WHERE product.slug = 'ab16-black-jumper'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_images AS image
    WHERE image.product_id = product.id
      AND image.url = '/images/merch/opt/ab16-jumper-black.webp'
  );

UPDATE public.products
SET name = 'AB16 Baseball Cap (White)',
    description = 'Structured white baseball cap with a navy AB16 logo.',
    seo_title = 'AB16 White Baseball Cap — AB16 Clothing',
    seo_description = 'Structured white AB16 baseball cap with a navy logo.'
WHERE slug = 'ab16-baseball-cap';

UPDATE public.product_variants AS variant
SET color = 'White',
    sku = 'AB16-CAP-WHITE'
FROM public.products AS product
WHERE variant.product_id = product.id
  AND product.slug = 'ab16-baseball-cap'
  AND (variant.color <> 'White' OR variant.sku = 'AB16-CAP-NAVY');

UPDATE public.product_images AS image
SET url = '/images/merch/opt/ab16-cap-white.webp',
    alt_text = 'White AB16 baseball cap'
FROM public.products AS product
WHERE image.product_id = product.id
  AND product.slug = 'ab16-baseball-cap';
