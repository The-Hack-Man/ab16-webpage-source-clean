/*
# E-commerce loop: Full product catalog + Printful fulfillment tracking

Adds:
- 3 missing products (AB16 T-Shirt White, AB16 T-Shirt Black, AB16 Baseball Cap)
- Product variants with sizes, colors, SKUs, stock, and prices
- Sets available_for_sale and real prices for purchasable items
- printful_orders join table for fulfillment tracking
- printful_order_items snapshot table
*/

-- Ensure Printful tracking tables exist
-- ---------------------------------------------------------------------------
-- Add Printful variant ID column for fulfillment mapping
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'printful_variant_id'
  ) THEN
    ALTER TABLE public.product_variants ADD COLUMN printful_variant_id bigint;
  END IF;
END $$;

create table if not exists printful_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  printful_order_id bigint,
  status text not null default 'pending' check (status in ('pending','processing','shipped','delivered','returned','cancelled','failed')),
  tracking_number text,
  tracking_url text,
  carrier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table printful_orders enable row level security;
create policy "admin_read_printful_orders" on printful_orders
  for select to authenticated using (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin'
    OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'super_admin'
  );
create unique index if not exists printful_orders_order_idx on printful_orders (order_id);
create index if not exists printful_orders_printful_idx on printful_orders (printful_order_id);

-- Ensure printful_order_items table
create table if not exists printful_order_items (
  id uuid primary key default gen_random_uuid(),
  printful_order_id uuid not null references printful_orders(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  product_name text not null,
  variant_size text,
  variant_color text,
  quantity int not null,
  price int not null,
  printful_variant_id bigint,
  created_at timestamptz not null default now()
);
alter table printful_order_items enable row level security;
create policy "admin_read_printful_order_items" on printful_order_items
  for select to authenticated using (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin'
    OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'super_admin'
  );
create index if not exists printful_order_items_order_idx on printful_order_items (printful_order_id);

-- ---------------------------------------------------------------------------
-- Add 3 missing products (2 t-shirts + 1 cap) — ready to sell
-- ---------------------------------------------------------------------------
INSERT INTO public.products (
  id, slug, name, description, story, price, compare_at_price,
  category_slug, status, featured, is_new_arrival, is_limited_drop,
  available_for_sale, availability_label, material_care, delivery_info,
  seo_title, seo_description
) VALUES
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567810',
    'ab16-tshirt-white',
    'AB16 T-Shirt (White)',
    'Classic AB16 cotton t-shirt in crisp white.',
    'The staple AB16 tee — 100% cotton, regular fit.',
    2500, NULL,
    't-shirts',
    'published',
    true,
    true,
    false,
    true,
    'In Stock',
    'Machine wash cold.',
    'UK 1-3 days, EU 3-7 days.',
    'AB16 T-Shirt White — AB16 Clothing',
    'Classic white AB16 cotton t-shirt. Machine washable.'
  ),
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567811',
    'ab16-tshirt-black',
    'AB16 T-Shirt (Black)',
    'Classic AB16 cotton t-shirt in jet black.',
    'The staple AB16 tee — 100% cotton, regular fit.',
    2500, NULL,
    't-shirts',
    'published',
    true,
    true,
    false,
    true,
    'In Stock',
    'Machine wash cold.',
    'UK 1-3 days, EU 3-7 days.',
    'AB16 T-Shirt Black — AB16 Clothing',
    'Classic black AB16 cotton t-shirt. Machine washable.'
  ),
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567812',
    'ab16-baseball-cap',
    'AB16 Baseball Cap',
    'Structured baseball cap with AB16 embroidered logo.',
    'One-size adjustable cap with contrast under-peak.',
    2000, NULL,
    'accessories',
    'published',
    true,
    false,
    false,
    true,
    'In Stock',
    'Spot clean only.',
    'UK 1-3 days, EU 3-7 days.',
    'AB16 Baseball Cap — AB16 Clothing',
    'Structured baseball cap with AB16 embroidered logo.'
  )
ON CONFLICT (slug) DO UPDATE SET
  available_for_sale = EXCLUDED.available_for_sale,
  price = EXCLUDED.price;

-- ---------------------------------------------------------------------------
-- Add variants for the 3 ready-to-sell products
-- ---------------------------------------------------------------------------
INSERT INTO public.product_variants (product_id, size, color, sku, stock, price_override)
SELECT p.id, v.size, v.color, v.sku, v.stock, v.price_override
FROM public.products p,
  (VALUES
    -- T-Shirt White: S, M, L, XL
    ('S', 'White', 'AB16-TSHIRT-W-S',  20, 2500),
    ('M', 'White', 'AB16-TSHIRT-W-M',  20, 2500),
    ('L', 'White', 'AB16-TSHIRT-W-L',  20, 2500),
    ('XL','White', 'AB16-TSHIRT-W-XL', 20, 2500),
    -- T-Shirt Black: S, M, L, XL
    ('S', 'Black', 'AB16-TSHIRT-B-S',  20, 2500),
    ('M', 'Black', 'AB16-TSHIRT-B-M',  20, 2500),
    ('L', 'Black', 'AB16-TSHIRT-B-L',  20, 2500),
    ('XL','Black', 'AB16-TSHIRT-B-XL', 20, 2500),
    -- Baseball Cap: One Size
    ('One Size', 'Navy', 'AB16-CAP-NAVY', 50, 2000)
  ) AS v(size, color, sku, stock, price_override)
WHERE p.slug IN ('ab16-tshirt-white', 'ab16-tshirt-black', 'ab16-baseball-cap')
  AND p.slug = CASE
    WHEN v.color = 'White' THEN 'ab16-tshirt-white'
    WHEN v.color = 'Black' THEN 'ab16-tshirt-black'
    WHEN v.color = 'Navy' AND v.size = 'One Size' THEN 'ab16-baseball-cap'
  END
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Add variants for the coming-soon jumper and tracksuit
-- ---------------------------------------------------------------------------
INSERT INTO public.product_variants (product_id, size, color, sku, stock, price_override)
SELECT p.id, v.size, v.color, v.sku, v.stock, v.price_override
FROM public.products p,
  (VALUES
    -- Jumper: Grey marl, S-XXL
    ('S',      'Grey Marl', 'AB16-JUMPER-G-S',     0, 4500),
    ('M',      'Grey Marl', 'AB16-JUMPER-G-M',     0, 4500),
    ('L',      'Grey Marl', 'AB16-JUMPER-G-L',     0, 4500),
    ('XL',     'Grey Marl', 'AB16-JUMPER-G-XL',    0, 4500),
    ('XXL',    'Grey Marl', 'AB16-JUMPER-G-XXL',   0, 4500),
    -- Tracksuit: Black, S-XXL
    ('S',      'Black',     'AB16-TRACK-SUIT-S',   0, 6500),
    ('M',      'Black',     'AB16-TRACK-SUIT-M',   0, 6500),
    ('L',      'Black',     'AB16-TRACK-SUIT-L',   0, 6500),
    ('XL',     'Black',     'AB16-TRACK-SUIT-XL',  0, 6500),
    ('XXL',    'Black',     'AB16-TRACK-SUIT-XXL', 0, 6500)
  ) AS v(size, color, sku, stock, price_override)
WHERE p.slug IN ('ab16-jumper', 'ab16-tracksuit')
  AND p.slug = CASE
    WHEN v.color = 'Grey Marl' THEN 'ab16-jumper'
    WHEN v.color = 'Black' THEN 'ab16-tracksuit'
  END
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Set prices and availability for existing coming-soon products
-- ---------------------------------------------------------------------------
UPDATE public.products
SET price = 4500
WHERE slug = 'ab16-jumper' AND price = 0;

UPDATE public.products
SET price = 6500
WHERE slug = 'ab16-tracksuit' AND price = 0;

-- ---------------------------------------------------------------------------
-- Add images for new products (webp from existing PNGs)
-- ---------------------------------------------------------------------------
INSERT INTO public.product_images (product_id, url, alt_text, position)
SELECT p.id, img.url, img.alt_text, img.position
FROM public.products p,
  (VALUES
    ('ab16-tshirt-white',  '/images/merch/opt/ab16-tshirt-white.webp',  'AB16 white t-shirt', 0),
    ('ab16-tshirt-black',  '/images/merch/opt/ab16-tshirt-black.webp',  'AB16 black t-shirt', 0),
    ('ab16-baseball-cap',  '/images/merch/opt/ab16-cap-navy.webp',      'AB16 navy baseball cap', 0)
  ) AS img(slug, url, alt_text, position)
WHERE p.slug = img.slug
ON CONFLICT DO NOTHING;

select 'catalogue + printful tables migrated' as status;
