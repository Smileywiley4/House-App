const STORAGE_KEY = 'pp_oauth_pending';

/** Persist signup choices across the Google OAuth redirect. */
export function saveOAuthPending(data) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readOAuthPending() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearOAuthPending() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Returns true when URL looks like a Supabase OAuth return (PKCE code or implicit hash). */
export function isOAuthReturnUrl() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('error') || params.get('error_description')) return true;
  if (params.get('code')) return true;
  const hash = window.location.hash || '';
  return hash.includes('access_token') || hash.includes('refresh_token');
}

export function readOAuthErrorFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const desc = params.get('error_description') || params.get('error');
  return desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : null;
}
