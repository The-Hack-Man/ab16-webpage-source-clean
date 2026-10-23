-- Update the AB16 Clothing hero headline to "Fae the Scheme to the Scene".
-- Updates both the column default and any existing records still using the old default text.

alter table site_settings
  alter column hero_headline set default 'Fae the Scheme to the Scene';

update site_settings
  set hero_headline = 'Fae the Scheme to the Scene',
      updated_at = now()
  where hero_headline = 'clothes made by a boy from the scheme, for the people of the schemes.';
