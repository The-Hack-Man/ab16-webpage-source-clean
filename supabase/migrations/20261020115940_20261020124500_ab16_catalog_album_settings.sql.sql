/*
# AB16 clothing availability and Jamie G album settings

1. Purpose
- Adds the editable fields needed to show genuine coming-soon clothing without making the items purchasable.
- Adds official Jamie G platform links and release announcement controls to the existing singleton site settings.
- Adds countdown controls to music releases.
- Seeds the two supplied clothing photographs as published, coming-soon catalog items and seeds the scheduled album announcement.

2. Modified tables
- `products`
  - `available_for_sale` controls whether checkout actions are enabled.
  - `availability_label` stores the customer-facing availability message.
- `site_settings`
  - `spotify_url`, `apple_music_url`, and `amazon_music_url` store editable official Jamie G destinations.
- `music_releases`
  - `countdown_visible` controls whether the release countdown is shown.
  - `countdown_timezone` stores the IANA timezone used for the release countdown.
  - `announcement_text` stores editable homepage and music-page announcement copy.

3. Seeded content
- `ab16-jumper` uses `/images/merch/ab16clothing1.png` and is labelled Coming Soon / TBA.
- `ab16-tracksuit` uses `/images/merch/ab16clothing.png` and is labelled Coming Soon / TBA.
- `jamie-g-new-album` is an upcoming album for Jamie G scheduled for 2 December 2026 at midnight in Europe/London, with a title placeholder and no invented cover art or pre-save link.

4. Security and data safety
- Existing row-level security policies are preserved.
- No existing rows are deleted, renamed, or type-changed.
- New public fields are read through the existing public content policies.

5. Important notes
- Product prices remain an internal zero placeholder because the existing price column is required; the storefront displays TBA while `available_for_sale` is false.
- The album cover remains replaceable and is intentionally left empty until an uploaded artwork URL is available.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'available_for_sale') THEN
    ALTER TABLE public.products ADD COLUMN available_for_sale boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'availability_label') THEN
    ALTER TABLE public.products ADD COLUMN availability_label text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'spotify_url') THEN
    ALTER TABLE public.site_settings ADD COLUMN spotify_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'apple_music_url') THEN
    ALTER TABLE public.site_settings ADD COLUMN apple_music_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'amazon_music_url') THEN
    ALTER TABLE public.site_settings ADD COLUMN amazon_music_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'music_releases' AND column_name = 'countdown_visible') THEN
    ALTER TABLE public.music_releases ADD COLUMN countdown_visible boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'music_releases' AND column_name = 'countdown_timezone') THEN
    ALTER TABLE public.music_releases ADD COLUMN countdown_timezone text NOT NULL DEFAULT 'Europe/London';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'music_releases' AND column_name = 'announcement_text') THEN
    ALTER TABLE public.music_releases ADD COLUMN announcement_text text;
  END IF;
END $$;

INSERT INTO public.products (slug, name, description, story, price, category_slug, status, featured, available_for_sale, availability_label, seo_title, seo_description)
VALUES
  ('ab16-jumper', 'AB16 Jumper', 'AB16 Clothing jumper — details and pricing to be announced.', 'The first AB16 jumper is coming soon. Join the newsletter for launch news.', 0, 'hoodies', 'published', true, false, 'COMING SOON / TBA', 'AB16 Jumper — Coming Soon', 'The AB16 jumper is coming soon. Sign up for launch announcements.'),
  ('ab16-tracksuit', 'AB16 Tracksuit', 'AB16 Clothing tracksuit — details and pricing to be announced.', 'The AB16 tracksuit is on the way. Join the newsletter for launch news.', 0, 'tracksuits', 'published', true, false, 'COMING SOON / TBA', 'AB16 Tracksuit — Coming Soon', 'The AB16 tracksuit is coming soon. Sign up for launch announcements.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_images (product_id, url, alt_text, position)
SELECT p.id, '/images/merch/ab16clothing1.png', 'AB16 jumper', 0
FROM public.products p
WHERE p.slug = 'ab16-jumper'
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id AND pi.url = '/images/merch/ab16clothing1.png');

INSERT INTO public.product_images (product_id, url, alt_text, position)
SELECT p.id, '/images/merch/ab16clothing.png', 'AB16 tracksuit', 0
FROM public.products p
WHERE p.slug = 'ab16-tracksuit'
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id AND pi.url = '/images/merch/ab16clothing.png');

INSERT INTO public.music_releases (slug, title, artist, release_type, release_date, status, description, spotify_url, apple_music_url, youtube_url, pre_save_url, countdown_visible, countdown_timezone, announcement_text, accent_color)
VALUES (
  'jamie-g-new-album',
  'NEW ALBUM — TITLE TO BE ANNOUNCED',
  'JAMIE G',
  'album',
  '2026-12-02T00:00:00+00'::timestamptz,
  'upcoming',
  'Jamie G''s new album arrives 02.12.26. The official title and artwork will be announced soon.',
  'https://open.spotify.com/artist/05IDis5l8XLJKkWp7CAOcC',
  'https://music.apple.com/us/artist/jamie-g/1815382137',
  'https://www.youtube.com/channel/UCDTrDLZyf8YTXvKFTHOCkyg',
  NULL,
  true,
  'Europe/London',
  'JAMIE G — NEW ALBUM ARRIVES 02.12.26',
  '#161616'
)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.site_settings
SET spotify_url = 'https://open.spotify.com/artist/05IDis5l8XLJKkWp7CAOcC',
    apple_music_url = 'https://music.apple.com/us/artist/jamie-g/1815382137',
    amazon_music_url = 'https://music.amazon.co.uk/artists/B0F9SBKZVD/jamie-g',
    youtube_url = 'https://www.youtube.com/channel/UCDTrDLZyf8YTXvKFTHOCkyg',
    tiktok_url = 'https://www.tiktok.com/@jamiegmusic',
    announcement_text = COALESCE(announcement_text, 'JAMIE G — NEW ALBUM ARRIVES 02.12.26')
WHERE id = (SELECT id FROM public.site_settings ORDER BY updated_at NULLS LAST LIMIT 1);
