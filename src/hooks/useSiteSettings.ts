import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SiteSettings } from '@/types';

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.from('site_settings').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (active) setSettings(data as SiteSettings | null);
    });
    return () => { active = false; };
  }, []);

  return settings;
}
