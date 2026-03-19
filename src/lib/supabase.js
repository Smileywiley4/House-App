import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client = null;

export function getSharedSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!_client) _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

let _sessionReady = null;

/**
 * Wait for Supabase to finish recovering the session from localStorage.
 * Call this before getSession() on page load.
 */
export function waitForSession() {
  if (_sessionReady) return _sessionReady;
  const client = getSharedSupabase();
  if (!client) return Promise.resolve(null);
  _sessionReady = new Promise((resolve) => {
    let resolved = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!resolved) { resolved = true; resolve(session); }
      subscription.unsubscribe();
    });
    setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 3000);
  });
  return _sessionReady;
}
