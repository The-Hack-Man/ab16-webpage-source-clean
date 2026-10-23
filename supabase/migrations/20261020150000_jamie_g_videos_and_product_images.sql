/*
Seed official Jamie G YouTube videos and point clothing photos at the optimised webp files.
*/

UPDATE public.product_images
SET url = '/images/merch/opt/ab16clothing1.webp'
WHERE url = '/images/merch/ab16clothing1.png';

UPDATE public.product_images
SET url = '/images/merch/opt/ab16clothing.webp'
WHERE url = '/images/merch/ab16clothing.png';

INSERT INTO public.music_videos (slug, title, youtube_id, thumbnail_url, description, release_date, status)
VALUES
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
  status = 'published';
