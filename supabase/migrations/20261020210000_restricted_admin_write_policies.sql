/*
# Restricted admin write policies

Replaces the insecure "FOR ALL TO authenticated USING (true)" approach
with JWT-claim-based admin authorization.

Admin users must have a JWT claim: { "role": "admin" }
This is set in Supabase via the user's app_metadata or a custom claim.

The browser never sees the service role key. Admin writes happen through:
1. Edge Functions using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
2. JWT-asserted policies for authenticated admin users

For tables that need both admin writes and public reads, this adds
admin-specific write policies without touching existing SELECT policies.
*/

-- Helper to check admin role from JWT claims
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    ''
  ) = 'admin'
$$;

-- ── products ──
create policy "admin_write_products" on products
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── product_variants ──
create policy "admin_write_product_variants" on product_variants
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── product_images ──
create policy "admin_write_product_images" on product_images
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── categories ──
create policy "admin_write_categories" on categories
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── collections ──
create policy "admin_write_collections" on collections
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── music_releases ──
create policy "admin_write_releases" on music_releases
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── tracks ──
create policy "admin_write_tracks" on tracks
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── music_videos ──
create policy "admin_write_music_videos" on music_videos
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── news_articles ──
create policy "admin_write_news_articles" on news_articles
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── events ──
create policy "admin_write_events" on events
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── campaigns ──
create policy "admin_write_campaigns" on campaigns
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── campaign_products ──
create policy "admin_write_campaign_products" on campaign_products
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── campaign_releases ──
create policy "admin_write_campaign_releases" on campaign_releases
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── site_settings ──
create policy "admin_write_site_settings" on site_settings
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── orders ── (admin can read/update all orders)
create policy "admin_readwrite_orders" on orders
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── order_items ──
create policy "admin_readwrite_order_items" on order_items
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── discounts ──
create policy "admin_write_discounts" on discounts
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── newsletter_subscribers ──
-- Keep existing anon insert policy. Add admin write for management.
create policy "admin_write_newsletter_subscribers" on newsletter_subscribers
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── contact_enquiries ──
-- Keep existing anon insert policy. Add admin write for management.
create policy "admin_readwrite_contact_enquiries" on contact_enquiries
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- ── audit_logs ──
create policy "admin_readwrite_audit_logs" on audit_logs
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');
