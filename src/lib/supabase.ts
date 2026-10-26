import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../supabase/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the app environment, then rebuild.');
}

try {
  const parsedUrl = new URL(supabaseUrl);
  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
    throw new Error('VITE_SUPABASE_URL must be an HTTPS Supabase project URL.');
  }
} catch (error) {
  if (error instanceof TypeError) throw new Error('VITE_SUPABASE_URL must be a valid HTTPS Supabase project URL.');
  throw error;
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  // Catalog and site content change outside the browser. Avoid serving an old
  // PostgREST GET response from the browser's HTTP cache after an upload/sync.
  global: {
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
