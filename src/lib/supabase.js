import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client = null;

export function getSharedSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        flowType: 'pkce',
      },
    });
  }
  return _client;
}

/**
 * Resolves the current Supabase session from persisted storage (localStorage).
 * Safe to call on every API request — does not use a one-shot timeout that could drop valid sessions.
 */
export function waitForSession() {
  const client = getSharedSupabase();
  if (!client) return Promise.resolve(null);
  return client.auth.getSession().then(({ data: { session } }) => session ?? null);
}
