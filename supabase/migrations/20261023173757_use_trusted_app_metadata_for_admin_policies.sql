-- Use trusted app_metadata.role instead of client-editable JWT claim for admin authorization.
-- Replaces all inline request.jwt.claims->>'role' checks with the is_admin() / is_super_admin() helpers
-- that read from the server-side-trusted app_metadata field.
-- Preserves existing table structure and only touches policy definitions.

-- ── Trusted admin helpers ────────────────────────────────────────────────────
-- app_metadata is only settable server-side (Supabase dashboard / admin API),
-- never by the client, making it the trusted source of admin roles.

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
    ''
  ) = 'admin'
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
    ''
  ) = 'super_admin'
$$;

-- ── restricted_admin_write_policies: products, variants, images, categories, ──
--   collections, releases, tracks, videos, news, events, campaigns, ────────────
--   site_settings, orders, order_items, discounts, newsletter, contact, audit ──

create or replace function public.admin_write_policy_check() returns boolean language sql stable as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
    ''
  ) = 'admin'
$$;

-- products
drop policy if exists "admin_write_products" on products;
create policy "admin_write_products" on products
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- product_variants
drop policy if exists "admin_write_product_variants" on product_variants;
create policy "admin_write_product_variants" on product_variants
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- product_images
drop policy if exists "admin_write_product_images" on product_images;
create policy "admin_write_product_images" on product_images
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- categories
drop policy if exists "admin_write_categories" on categories;
create policy "admin_write_categories" on categories
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- collections
drop policy if exists "admin_write_collections" on collections;
create policy "admin_write_collections" on collections
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- music_releases
drop policy if exists "admin_write_releases" on music_releases;
create policy "admin_write_releases" on music_releases
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- tracks
drop policy if exists "admin_write_tracks" on tracks;
create policy "admin_write_tracks" on tracks
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- music_videos
drop policy if exists "admin_write_music_videos" on music_videos;
create policy "admin_write_music_videos" on music_videos
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- news_articles
drop policy if exists "admin_write_news_articles" on news_articles;
create policy "admin_write_news_articles" on news_articles
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- events
drop policy if exists "admin_write_events" on events;
create policy "admin_write_events" on events
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- campaigns
drop policy if exists "admin_write_campaigns" on campaigns;
create policy "admin_write_campaigns" on campaigns
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- campaign_products
drop policy if exists "admin_write_campaign_products" on campaign_products;
create policy "admin_write_campaign_products" on campaign_products
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- campaign_releases
drop policy if exists "admin_write_campaign_releases" on campaign_releases;
create policy "admin_write_campaign_releases" on campaign_releases
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- site_settings
drop policy if exists "admin_write_site_settings" on site_settings;
create policy "admin_write_site_settings" on site_settings
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- orders
drop policy if exists "admin_readwrite_orders" on orders;
create policy "admin_readwrite_orders" on orders
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- order_items
drop policy if exists "admin_readwrite_order_items" on order_items;
create policy "admin_readwrite_order_items" on order_items
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- discounts
drop policy if exists "admin_write_discounts" on discounts;
create policy "admin_write_discounts" on discounts
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- newsletter_subscribers
drop policy if exists "admin_write_newsletter_subscribers" on newsletter_subscribers;
create policy "admin_write_newsletter_subscribers" on newsletter_subscribers
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- contact_enquiries
drop policy if exists "admin_readwrite_contact_enquiries" on contact_enquiries;
create policy "admin_readwrite_contact_enquiries" on contact_enquiries
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- audit_logs
drop policy if exists "admin_readwrite_audit_logs" on audit_logs;
create policy "admin_readwrite_audit_logs" on audit_logs
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ── engine_durability_tables: jobs, outbox, processed_stripe_events ───────────

drop policy if exists "admin_full_access_jobs" on jobs;
create policy "admin_full_access_jobs" on jobs
  for all to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "admin_full_access_outbox" on outbox;
create policy "admin_full_access_outbox" on outbox
  for all to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "admin_full_access_processed_stripe_events" on processed_stripe_events;
create policy "admin_full_access_processed_stripe_events" on processed_stripe_events
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ── ecommerce_catalogue_and_printful: printful_orders, printful_order_items ───

drop policy if exists "admin_read_printful_orders" on printful_orders;
create policy "admin_read_printful_orders" on printful_orders
  for select to authenticated using (is_admin() or is_super_admin());

drop policy if exists "admin_read_printful_order_items" on printful_order_items;
create policy "admin_read_printful_order_items" on printful_order_items
  for select to authenticated using (is_admin() or is_super_admin());

-- ── ai_mastering_schema: mastering jobs read/write + storage buckets ─────────

drop policy if exists "admin_read_mastering_jobs" on ai_mastering_jobs;
create policy "admin_read_mastering_jobs" on ai_mastering_jobs
  for select to authenticated using (is_admin() or is_super_admin());

drop policy if exists "admin_write_mastering_jobs" on ai_mastering_jobs;
create policy "admin_write_mastering_jobs" on ai_mastering_jobs
  for insert to authenticated with check (is_admin() or is_super_admin());

drop policy if exists "admin_read_releases_bucket" on storage.objects;
create policy "admin_read_releases_bucket" on storage.objects
  for select to authenticated
  using (bucket_id = 'releases' and (is_admin() or is_super_admin()));

drop policy if exists "admin_write_releases_bucket" on storage.objects;
create policy "admin_write_releases_bucket" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'releases' and (is_admin() or is_super_admin()));

-- ── stripe_webhook_event_dedup: processed_stripe_events ───────────────────────
-- (Already handled above under engine_durability_tables.)

select 'admin_policies_migrated_to_app_metadata' as status;
