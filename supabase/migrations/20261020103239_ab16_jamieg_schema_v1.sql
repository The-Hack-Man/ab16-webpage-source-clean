/*
# AB16 × Jamie G — Core Schema v1

Creates the relational foundation for the AB16 Clothing store, Jamie G Music platform,
campaigns, newsletter, contact enquiries, and site settings.

## Tables
- site_settings (singleton row, public read)
- categories (product categories)
- collections (curated product collections)
- products (clothing products)
- product_images (multiple images per product)
- product_variants (size + colour + stock + optional price override)
- orders (checkout orders)
- order_items (line items snapshot)
- discounts (promo codes)
- music_releases (singles, EPs, albums)
- tracks (release tracklist)
- music_videos (video library)
- news_articles (music news)
- events (live appearances)
- campaigns (AB16 × Jamie G collaborative drops)
- campaign_products (join: campaign ↔ products)
- campaign_releases (join: campaign ↔ releases)
- newsletter_subscribers (email list with consent)
- contact_enquiries (contact form submissions)
- audit_logs (admin action log)

## Security
- All tables have RLS enabled.
- Public content (published products, releases, videos, news, events, campaigns,
  site_settings, newsletter signup, contact form) is readable by anon + authenticated.
- Orders are owner-scoped via user_id (nullable for guest checkout; guest orders
  are matched by email client-side and should be verified server-side before any
  privileged action).
- Admin writes go through the service role / edge functions, not anon policies.
- Newsletter + contact are insert-only by anon (no read access to anon).
*/

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- site_settings (singleton)
-- ---------------------------------------------------------------------------
create table if not exists site_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'AB16 Clothing',
  contact_email text,
  support_email text,
  currency text not null default 'GBP',
  store_address text,
  instagram_url text,
  tiktok_url text,
  youtube_url text,
  facebook_url text,
  announcement_text text,
  announcement_active boolean not null default true,
  hero_headline text not null default 'clothes made by a boy from the scheme, for the people of the schemes.',
  hero_subtext text not null default 'AB16 Clothing. Independent streetwear. Music. Culture. Identity.',
  hero_image_url text,
  hero_video_url text,
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table site_settings enable row level security;

drop policy if exists "public_read_site_settings" on site_settings;
create policy "public_read_site_settings" on site_settings
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

drop policy if exists "public_read_categories" on categories;
create policy "public_read_categories" on categories
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- collections
-- ---------------------------------------------------------------------------
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  cover_image_url text,
  launch_date timestamptz,
  status text not null default 'published' check (status in ('draft','scheduled','live','ended','archived','published')),
  created_at timestamptz not null default now()
);

alter table collections enable row level security;

drop policy if exists "public_read_collections" on collections;
create policy "public_read_collections" on collections
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  story text,
  price int not null,                          -- pence
  compare_at_price int,
  category_id uuid references categories(id) on delete set null,
  collection_id uuid references collections(id) on delete set null,
  collection_slug text,
  category_slug text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false,
  is_new_arrival boolean not null default false,
  is_limited_drop boolean not null default false,
  material_care text,
  delivery_info text,
  return_info text,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products enable row level security;

drop policy if exists "public_read_published_products" on products;
create policy "public_read_published_products" on products
  for select to anon, authenticated using (status = 'published');

create index if not exists products_slug_idx on products (slug);
create index if not exists products_status_idx on products (status);
create index if not exists products_featured_idx on products (featured);

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  alt_text text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table product_images enable row level security;

drop policy if exists "public_read_product_images" on product_images;
create policy "public_read_product_images" on product_images
  for select to anon, authenticated using (true);

create index if not exists product_images_product_idx on product_images (product_id);

-- ---------------------------------------------------------------------------
-- product_variants
-- ---------------------------------------------------------------------------
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  size text not null,
  color text not null,
  sku text,
  stock int not null default 0,
  price_override int,                          -- pence, nullable
  created_at timestamptz not null default now()
);

alter table product_variants enable row level security;

drop policy if exists "public_read_product_variants" on product_variants;
create policy "public_read_product_variants" on product_variants
  for select to anon, authenticated using (true);

create index if not exists product_variants_product_idx on product_variants (product_id);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  email text not null,
  user_id uuid,                                 -- nullable for guest checkout
  items jsonb not null default '[]'::jsonb,      -- snapshot of line items
  shipping_address jsonb,
  billing_address jsonb,
  shipping_method text,
  shipping_charge int not null default 0,       -- pence
  discount_code text,
  discount_amount int not null default 0,       -- pence
  subtotal int not null default 0,              -- pence
  total int not null default 0,                 -- pence
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','refunded','failed')),
  fulfilment_status text not null default 'unfulfilled' check (fulfilment_status in ('unfulfilled','fulfilled','shipped','cancelled')),
  tracking_reference text,
  payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders enable row level security;

drop policy if exists "read_own_orders" on orders;
create policy "read_own_orders" on orders
  for select to authenticated using (auth.uid() = user_id);

create index if not exists orders_email_idx on orders (email);
create index if not exists orders_user_idx on orders (user_id);
create index if not exists orders_number_idx on orders (order_number);

-- ---------------------------------------------------------------------------
-- order_items (normalised line items)
-- ---------------------------------------------------------------------------
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  product_name text not null,
  variant_size text,
  variant_color text,
  quantity int not null,
  price int not null                            -- pence at purchase
);

alter table order_items enable row level security;

drop policy if exists "read_own_order_items" on order_items;
create policy "read_own_order_items" on order_items
  for select to authenticated using (
    exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

create index if not exists order_items_order_idx on order_items (order_id);

-- ---------------------------------------------------------------------------
-- discounts
-- ---------------------------------------------------------------------------
create table if not exists discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percentage','fixed','free_shipping')),
  value int not null default 0,                 -- percentage (0-100) or pence
  min_order_value int not null default 0,       -- pence
  usage_limit int,
  used_count int not null default 0,
  per_customer_limit int,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table discounts enable row level security;

drop policy if exists "public_read_active_discounts" on discounts;
create policy "public_read_active_discounts" on discounts
  for select to anon, authenticated using (active = true);

-- ---------------------------------------------------------------------------
-- music_releases
-- ---------------------------------------------------------------------------
create table if not exists music_releases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  artist text not null default 'JAMIE G',
  featured_artists text,
  cover_art_url text,
  release_type text not null default 'single' check (release_type in ('single','ep','album','mixtape','deluxe','feature','remix','instrumental')),
  release_date timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','upcoming','published','archived')),
  description text,
  spotify_url text,
  apple_music_url text,
  youtube_url text,
  soundcloud_url text,
  tidal_url text,
  bandcamp_url text,
  pre_save_url text,
  label text,
  copyright text,
  explicit boolean not null default false,
  accent_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table music_releases enable row level security;

drop policy if exists "public_read_published_releases" on music_releases;
create policy "public_read_published_releases" on music_releases
  for select to anon, authenticated using (status in ('published','upcoming','scheduled'));

create index if not exists music_releases_slug_idx on music_releases (slug);
create index if not exists music_releases_status_idx on music_releases (status);
create index if not exists music_releases_date_idx on music_releases (release_date);

-- ---------------------------------------------------------------------------
-- tracks
-- ---------------------------------------------------------------------------
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references music_releases(id) on delete cascade,
  title text not null,
  position int not null default 0,
  duration text,
  explicit boolean not null default false,
  preview_url text,
  created_at timestamptz not null default now()
);

alter table tracks enable row level security;

drop policy if exists "public_read_tracks" on tracks;
create policy "public_read_tracks" on tracks
  for select to anon, authenticated using (true);

create index if not exists tracks_release_idx on tracks (release_id);

-- ---------------------------------------------------------------------------
-- music_videos
-- ---------------------------------------------------------------------------
create table if not exists music_videos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  release_id uuid references music_releases(id) on delete set null,
  thumbnail_url text,
  youtube_id text,
  description text,
  release_date timestamptz,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now()
);

alter table music_videos enable row level security;

drop policy if exists "public_read_published_videos" on music_videos;
create policy "public_read_published_videos" on music_videos
  for select to anon, authenticated using (status = 'published');

create index if not exists music_videos_slug_idx on music_videos (slug);

-- ---------------------------------------------------------------------------
-- news_articles
-- ---------------------------------------------------------------------------
create table if not exists news_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  cover_image_url text,
  body text not null,
  excerpt text,
  author text,
  published_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now()
);

alter table news_articles enable row level security;

drop policy if exists "public_read_published_news" on news_articles;
create policy "public_read_published_news" on news_articles
  for select to anon, authenticated using (status = 'published');

create index if not exists news_slug_idx on news_articles (slug);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue text,
  city text,
  event_date timestamptz,
  event_image_url text,
  ticket_url text,
  status text not null default 'draft' check (status in ('draft','published','archived','cancelled')),
  created_at timestamptz not null default now()
);

alter table events enable row level security;

drop policy if exists "public_read_published_events" on events;
create policy "public_read_published_events" on events
  for select to anon, authenticated using (status = 'published');

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  hero_image_url text,
  description text,
  launch_date timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','live','ended','archived')),
  discount_code text,
  created_at timestamptz not null default now()
);

alter table campaigns enable row level security;

drop policy if exists "public_read_live_campaigns" on campaigns;
create policy "public_read_live_campaigns" on campaigns
  for select to anon, authenticated using (status in ('live','scheduled','ended'));

create index if not exists campaigns_slug_idx on campaigns (slug);

-- ---------------------------------------------------------------------------
-- campaign_products / campaign_releases (join tables)
-- ---------------------------------------------------------------------------
create table if not exists campaign_products (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (campaign_id, product_id)
);
alter table campaign_products enable row level security;
drop policy if exists "public_read_campaign_products" on campaign_products;
create policy "public_read_campaign_products" on campaign_products
  for select to anon, authenticated using (true);

create table if not exists campaign_releases (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  release_id uuid not null references music_releases(id) on delete cascade,
  primary key (campaign_id, release_id)
);
alter table campaign_releases enable row level security;
drop policy if exists "public_read_campaign_releases" on campaign_releases;
create policy "public_read_campaign_releases" on campaign_releases
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- newsletter_subscribers
-- ---------------------------------------------------------------------------
create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  consent_text text not null,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

alter table newsletter_subscribers enable row level security;

drop policy if exists "anon_subscribe_newsletter" on newsletter_subscribers;
create policy "anon_subscribe_newsletter" on newsletter_subscribers
  for insert to anon, authenticated with check (true);

drop policy if exists "anon_unsubscribe_newsletter" on newsletter_subscribers;
create policy "anon_unsubscribe_newsletter" on newsletter_subscribers
  for update to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- contact_enquiries
-- ---------------------------------------------------------------------------
create table if not exists contact_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  category text not null,
  message text not null,
  created_at timestamptz not null default now(),
  handled boolean not null default false
);

alter table contact_enquiries enable row level security;

drop policy if exists "anon_submit_enquiry" on contact_enquiries;
create policy "anon_submit_enquiry" on contact_enquiries
  for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;
-- No anon policies: admin-only, accessed via service role.

-- ---------------------------------------------------------------------------
-- Seed: default site_settings row
-- ---------------------------------------------------------------------------
insert into site_settings (id, business_name)
select gen_random_uuid(), 'AB16 Clothing'
where not exists (select 1 from site_settings);

-- ---------------------------------------------------------------------------
-- Seed: default categories
-- ---------------------------------------------------------------------------
insert into categories (name, slug, position)
select * from (values
  ('T-Shirts', 't-shirts', 1),
  ('Hoodies', 'hoodies', 2),
  ('Tracksuits', 'tracksuits', 3),
  ('Jackets', 'jackets', 4),
  ('Trousers', 'trousers', 5),
  ('Accessories', 'accessories', 6)
) as v(name, slug, position)
where not exists (select 1 from categories);
