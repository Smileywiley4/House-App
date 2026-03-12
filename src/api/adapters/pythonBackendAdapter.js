/**
 * Python backend adapter (FastAPI).
 * Frontend uses Supabase for auth only; all other API calls go to the Python backend with Bearer token.
 * Set VITE_USE_PYTHON_BACKEND=true and VITE_API_BASE_URL=http://localhost:8000 (or your backend URL).
 */
import { createClient } from '@supabase/supabase-js';

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required for Python backend');
  return createClient(supabaseUrl, supabaseAnonKey);
}

async function getToken() {
  const { data: { session } } = await getSupabase().auth.getSession();
  return session?.access_token ?? null;
}

async function request(method, path, body = undefined) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'include' });
  if (!res.ok) {
    const err = new Error(await res.text() || res.statusText);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return null;
  return res.json();
}

export function createPythonBackendAdapter() {
  const supabase = getSupabase();

  return {
    auth: {
      me: () => request('GET', '/api/auth/me'),
      updateMe: (profile) => request('PATCH', '/api/auth/me', profile),
      logout: async (returnUrl) => {
        await supabase.auth.signOut();
        if (typeof window !== 'undefined' && returnUrl) window.location.href = returnUrl;
      },
      redirectToLogin: (returnUrl) => {
        if (typeof window !== 'undefined') {
          const base = window.location.origin;
          window.location.href = `${base}/login?redirect=${encodeURIComponent(returnUrl || window.location.href)}`;
        }
      },
    },
    entities: {
      PropertyScore: {
        list: () => request('GET', '/api/entities/property_scores'),
        create: (data) => request('POST', '/api/entities/property_scores', data),
        delete: (id) => request('DELETE', `/api/entities/property_scores/${id}`),
      },
      Preset: {
        list: (clientId) => request('GET', clientId ? `/api/entities/presets?client_id=${clientId}` : '/api/entities/presets'),
        create: (data) => request('POST', '/api/entities/presets', data),
        update: (id, data) => request('PATCH', `/api/entities/presets/${id}`, data),
        delete: (id) => request('DELETE', `/api/entities/presets/${id}`),
      },
      Client: {
        list: () => request('GET', '/api/entities/clients'),
        create: (data) => request('POST', '/api/entities/clients', data),
        delete: (id) => request('DELETE', `/api/entities/clients/${id}`),
      },
      PrivateListing: {
        list: () => request('GET', '/api/entities/private_listings'),
        create: (data) => request('POST', '/api/entities/private_listings', data),
        delete: (id) => request('DELETE', `/api/entities/private_listings/${id}`),
      },
    },
    property: {
      search: (address) => request('POST', '/api/property/search', { address }),
      searchByCriteria: (filters, source = 'public') =>
        request('POST', '/api/property/search-by-criteria', { filters, source }),
    },
    integrations: {
      invokeLLM: (options) => request('POST', '/api/integrations/llm/invoke', {
        prompt: options.prompt,
        response_json_schema: options.response_json_schema,
      }),
    },
    appLogs: {
      logUserInApp: () => Promise.resolve(),
    },
    subscription: {
      createCheckoutSession: (options) => request('POST', '/api/subscription/create-checkout-session', options).then((r) => ({ url: r?.url })),
      getPortalUrl: () => request('GET', '/api/subscription/portal').then((r) => ({ url: r?.url })),
    },
  };
}
