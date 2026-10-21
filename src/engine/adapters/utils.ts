import type { PostgrestError } from '@supabase/supabase-js';

export function decodeDbError(error: PostgrestError | { message: string }): Error {
  if ('details' in error && error.details) {
    return new Error(`${error.message}${error.details ? ` — ${error.details}` : ''}`);
  }
  if ('hint' in error && error.hint) {
    return new Error(`${error.message}${error.hint ? ` (hint: ${error.hint})` : ''}`);
  }
  return new Error(error.message);
}
