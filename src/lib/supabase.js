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
      },
    });
  }
  return _client;
}

let _sessionReady = null;

/**
 * Wait for Supabase to finish recovering the session from localStorage
 * or from OAuth redirect tokens in the URL hash.
 */
export function waitForSession() {
  if (_sessionReady) return _sessionReady;
  const client = getSharedSupabase();
  if (!client) return Promise.resolve(null);
  _sessionReady = new Promise((resolve) => {
    let resolved = false;
    const done = (session) => {
      if (!resolved) { resolved = true; resolve(session); }
    };
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      done(session);
    });
    client.auth.getSession().then(({ data: { session } }) => {
      if (session) done(session);
    });
    setTimeout(() => {
      done(null);
      subscription.unsubscribe();
    }, 5000);
  });
  return _sessionReady;
}
