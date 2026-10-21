/*
# Add AB16 website and contact settings

1. Purpose
- Stores the confirmed AB16 website address and Zoho contact email in the existing singleton site settings row.
- Makes the website address editable through the existing admin settings screen.
- Keeps customer support and general contact email consistent across the storefront.

2. Modified table
- `site_settings`
  - `website_url` stores `https://ab16clothing.co.uk`.
  - `contact_email` stores `mcjamieg@zohomail.eu`.
  - `support_email` stores `mcjamieg@zohomail.eu`.

3. Security and data safety
- Preserves the existing public read policy on `site_settings`.
- Adds no new tables or policies.
- Does not delete or rename any existing data.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'website_url') THEN
    ALTER TABLE public.site_settings ADD COLUMN website_url text;
  END IF;
END $$;

UPDATE public.site_settings
SET website_url = 'https://ab16clothing.co.uk',
    contact_email = 'mcjamieg@zohomail.eu',
    support_email = 'mcjamieg@zohomail.eu'
WHERE id = (SELECT id FROM public.site_settings ORDER BY updated_at NULLS LAST LIMIT 1);
