/*
# Set confirmed Jamie G album title

1. Changes
- Updates the existing upcoming Jamie G album record from the temporary title placeholder to `STILL BROKEN`.
- Keeps the artist name as `JAMIE G`, the scheduled release date as 2 December 2026, and the release status as upcoming.
- Keeps `pre_save_url` empty because no genuine pre-save destination has been supplied.

2. Data safety
- Updates only the existing seeded release identified by its stable slug.
- Does not alter products, links, dates, or any unrelated records.
*/

UPDATE public.music_releases
SET title = 'STILL BROKEN',
    artist = 'JAMIE G',
    description = 'Jamie G''s new album STILL BROKEN arrives 02.12.26.',
    pre_save_url = NULL,
    status = 'upcoming'
WHERE slug = 'jamie-g-new-album';
