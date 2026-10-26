-- Allow site administrators to manage homepage and Jamie G photography through
-- Admin > Settings, using the existing public product image storage bucket.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS home_fashion_image_url text,
  ADD COLUMN IF NOT EXISTS home_music_image_url text,
  ADD COLUMN IF NOT EXISTS brand_story_image_url text,
  ADD COLUMN IF NOT EXISTS jamie_hero_image_url text,
  ADD COLUMN IF NOT EXISTS jamie_studio_image_url text,
  ADD COLUMN IF NOT EXISTS music_hero_image_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "admin_insert_product_images" ON storage.objects;
CREATE POLICY "admin_insert_product_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "admin_update_product_images" ON storage.objects;
CREATE POLICY "admin_update_product_images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "admin_delete_product_images" ON storage.objects;
CREATE POLICY "admin_delete_product_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
