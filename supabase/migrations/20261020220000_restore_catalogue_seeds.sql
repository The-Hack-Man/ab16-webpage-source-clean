/*
# Catalogue restoration: products, release, videos, site settings

Re-seeds the catalogue content that was lost when migrations 5-13 were not
applied to the live database. Uses idempotent ON CONFLICT / IF NOT EXISTS
guards so it can be safely re-run.
*/

DO $$
BEGIN
  -- Ensure columns exist (from migrations 5 & 11 that were not applied to remote)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'music_releases' AND column_name = 'announcement_text') THEN
    ALTER TABLE public.music_releases ADD COLUMN announcement_text text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'hero_video_url') THEN
    ALTER TABLE public.site_settings ADD COLUMN hero_video_url text;
  END IF;
END $$;

-- Products
INSERT INTO public.products (
  id, slug, name, description, story, price, compare_at_price,
  category_slug, status, featured, is_new_arrival, available_for_sale,
  availability_label, seo_title, seo_description
) VALUES
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567800',
    'ab16-jumper',
    'AB16 Jumper',
    'AB16 Clothing jumper — details and pricing to be announced.',
    'The first AB16 jumper is coming soon. Join the newsletter for launch news.',
    0, NULL,
    'hoodies',
    'published',
    true,
    false,
    false,
    'COMING SOON / TBA',
    'AB16 Jumper — Coming Soon',
    'The AB16 jumper is coming soon. Sign up for launch announcements.'
  ),
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567801',
    'ab16-tracksuit',
    'AB16 Tracksuit',
    'AB16 Clothing tracksuit — details and pricing to be announced.',
    'The AB16 tracksuit is on the way. Join the newsletter for launch news.',
    0, NULL,
    'tracksuits',
    'published',
    false,
    true,
    false,
    'COMING SOON / TBA',
    'AB16 Tracksuit — Coming Soon',
    'The AB16 tracksuit is coming soon. Sign up for launch announcements.'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  available_for_sale = EXCLUDED.available_for_sale,
  availability_label = EXCLUDED.availability_label;

-- Product images (optimized webp versions)
INSERT INTO public.product_images (product_id, url, alt_text, position)
SELECT p.id, '/images/merch/opt/ab16clothing1.webp', 'AB16 jumper', 0
FROM public.products p
WHERE p.slug = 'ab16-jumper'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_images pi
    WHERE pi.product_id = p.id AND pi.url = '/images/merch/opt/ab16clothing1.webp'
  );

INSERT INTO public.product_images (product_id, url, alt_text, position)
SELECT p.id, '/images/merch/opt/ab16clothing.webp', 'AB16 tracksuit', 0
FROM public.products p
WHERE p.slug = 'ab16-tracksuit'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_images pi
    WHERE pi.product_id = p.id AND pi.url = '/images/merch/opt/ab16clothing.webp'
  );

-- Jamie G — STILL BROKEN album
INSERT INTO public.music_releases (
  id, slug, title, artist, release_type, release_date, status, description,
  explicit, cover_art_url, spotify_url, apple_music_url, youtube_url,
  pre_save_url, countdown_visible, countdown_timezone, announcement_text,
  accent_color, featured_artists
) VALUES (
  'b1c2d3e4-f5a6-7890-bcd1-ef2345678900',
  'jamie-g-new-album',
  'STILL BROKEN',
  'JAMIE G',
  'album',
  '2026-12-02T00:00:00+00'::timestamptz,
  'upcoming',
  'Jamie G''s new album STILL BROKEN arrives 02.12.26.',
  false,
  NULL,
  'https://open.spotify.com/artist/05IDis5l8XLJKkWp7CAOcC',
  'https://music.apple.com/us/artist/jamie-g/1815382137',
  'https://www.youtube.com/channel/UCDTrDLZyf8YTXvKFTHOCkyg',
  NULL,
  true,
  'Europe/London',
  'JAMIE G — NEW ALBUM ARRIVES 02.12.26',
  '#161616',
  NULL
) ON CONFLICT (slug) DO UPDATE SET
  title = 'STILL BROKEN',
  artist = 'JAMIE G',
  description = 'Jamie G''s new album STILL BROKEN arrives 02.12.26.',
  pre_save_url = NULL,
  status = 'upcoming';

-- Site settings — Jamie G platform links and AB16 contact
UPDATE public.site_settings
SET website_url = 'https://ab16clothing.co.uk',
    contact_email = 'mcjamieg@zohomail.eu',
    support_email = 'mcjamieg@zohomail.eu',
    spotify_url = 'https://open.spotify.com/artist/05IDis5l8XLJKkWp7CAOcC',
    apple_music_url = 'https://music.apple.com/us/artist/jamie-g/1815382137',
    amazon_music_url = 'https://music.amazon.co.uk/artists/B0F9SBKZVD/jamie-g',
    youtube_url = 'https://www.youtube.com/channel/UCDTrDLZyf8YTXvKFTHOCkyg',
    tiktok_url = 'https://www.tiktok.com/@jamiegmusic',
    announcement_text = COALESCE(announcement_text, 'JAMIE G — NEW ALBUM ARRIVES 02.12.26');

-- Music videos — official Jamie G videos
INSERT INTO public.music_videos (
  slug, title, youtube_id, thumbnail_url, description, release_date, status
) VALUES
  ('the-lies-you-have-to-live-with', 'THE LIES YOU HAVE TO LIVE WITH', 'VibutbaR_sU', 'https://i.ytimg.com/vi/VibutbaR_sU/hqdefault.jpg', 'Official Jamie G video.', '2026-09-28T15:11:31+00', 'published'),
  ('oh-blondie', 'OH BLONDIE', 'No4C6hRLRSQ', 'https://i.ytimg.com/vi/No4C6hRLRSQ/hqdefault.jpg', 'Official Jamie G video.', '2026-09-28T15:01:24+00', 'published'),
  ('die-before-i-say-sorry', 'DIE BEFORE I SAY SORRY', 'MSTIXuajWLA', 'https://i.ytimg.com/vi/MSTIXuajWLA/hqdefault.jpg', 'Official Jamie G video.', '2026-09-26T12:24:57+00', 'published'),
  ('the-way-i-feel', 'THE WAY I FEEL', 'bVaV7TSOJfg', 'https://i.ytimg.com/vi/bVaV7TSOJfg/hqdefault.jpg', 'Official Jamie G video.', '2026-09-19T11:31:07+00', 'published'),
  ('do-you-love-me-to', 'DO YOU LOVE ME TO', 'mp2aEutpYa8', 'https://i.ytimg.com/vi/mp2aEutpYa8/hqdefault.jpg', 'Official Jamie G video.', '2026-09-01T00:00:00+00', 'published'),
  ('its-ok-to-let-you-go', 'ITS OK TO LET YOU GO', 'LhbCgoGRzD4', 'https://i.ytimg.com/vi/LhbCgoGRzD4/hqdefault.jpg', 'Official Jamie G video.', '2026-08-01T00:00:00+00', 'published'),
  ('soul-anywhere', 'SOUL ANYWHERE', 'JpL0DV1N378', 'https://i.ytimg.com/vi/JpL0DV1N378/hqdefault.jpg', 'Official Jamie G video.', '2026-07-01T00:00:00+00', 'published'),
  ('50-years', '50 YEARS', 'NUh9A_R7jmg', 'https://i.ytimg.com/vi/NUh9A_R7jmg/hqdefault.jpg', 'Official Jamie G video.', '2026-06-01T00:00:00+00', 'published'),
  ('take-her-away', 'TAKE HER AWAY', 'hreuarnSmzk', 'https://i.ytimg.com/vi/hreuarnSmzk/hqdefault.jpg', 'Official Jamie G video.', '2026-05-01T00:00:00+00', 'published'),
  ('free-at-last', 'FREE AT LAST', '_e3JWX-py0A', 'https://i.ytimg.com/vi/_e3JWX-py0A/hqdefault.jpg', 'Official Jamie G video.', '2026-04-01T00:00:00+00', 'published'),
  ('you-got-you', 'YOU GOT YOU', 'vOFO5IVOe8c', 'https://i.ytimg.com/vi/vOFO5IVOe8c/hqdefault.jpg', 'Official Jamie G video.', '2026-03-01T00:00:00+00', 'published'),
  ('glass-house', 'GLASS HOUSE', 'h0Byw0y1t9I', 'https://i.ytimg.com/vi/h0Byw0y1t9I/hqdefault.jpg', 'Official Jamie G video.', '2026-02-01T00:00:00+00', 'published'),
  ('logie-avenue', 'LOGIE AVENUE', 'mu6cf9XAlIk', 'https://i.ytimg.com/vi/mu6cf9XAlIk/hqdefault.jpg', 'Official Jamie G video.', '2026-09-29T12:32:50+00', 'published'),
  ('goodbye-g', 'GOODBYE G', 'zghVOE5OBbw', 'https://i.ytimg.com/vi/zghVOE5OBbw/hqdefault.jpg', 'Official Jamie G video.', '2026-09-28T14:57:53+00', 'published')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  youtube_id = EXCLUDED.youtube_id,
  thumbnail_url = EXCLUDED.thumbnail_url,
  status = EXCLUDED.status;
