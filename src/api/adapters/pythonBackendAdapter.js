/**
 * Python backend adapter (FastAPI).
 * Frontend uses Supabase for auth only; all other API calls go to the Python backend with Bearer token.
 * Set VITE_USE_PYTHON_BACKEND=true and VITE_API_BASE_URL=http://localhost:8000 (or your backend URL).
 */
import { getSharedSupabase, waitForSession } from '@/lib/supabase';

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function getSupabase() {
  const client = getSharedSupabase();
  if (!client) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required for Python backend');
  return client;
}

async function getToken() {
  await waitForSession();
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

async function uploadVisitPhoto(savedId, file, caption) {
  const token = await getToken();
  const form = new FormData();
  form.append('file', file);
  if (caption) form.append('caption', caption);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}/api/library/saved-properties/${encodeURIComponent(savedId)}/photos`, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include',
  });
  if (!res.ok) {
    const err = new Error(await res.text() || res.statusText);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function createPythonBackendAdapter() {
  const supabase = getSupabase();

  return {
    auth: {
      me: () => request('GET', '/api/auth/me'),
      updateMe: (profile) => request('PATCH', '/api/auth/me', profile),
      updateEmail: async (email) => {
        // Supabase client updates auth email; backend /api/auth/me only stores profile fields.
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
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
      autoscore: (address) => request('POST', '/api/property/autoscore', { address }),
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
    /** Premium/Realtor: visit photos, folders, realtor sharing */
    library: {
      searchRealtors: (q) => request('GET', `/api/library/realtors/search?q=${encodeURIComponent(q || '')}`),
      listSaved: () => request('GET', '/api/library/saved-properties'),
      getSaved: (id) => request('GET', `/api/library/saved-properties/${encodeURIComponent(id)}`),
      createSaved: (data) => request('POST', '/api/library/saved-properties', data),
      updateSaved: (id, data) => request('PATCH', `/api/library/saved-properties/${encodeURIComponent(id)}`, data),
      deleteSaved: (id) => request('DELETE', `/api/library/saved-properties/${encodeURIComponent(id)}`),
      uploadPhoto: (savedId, file, caption) => uploadVisitPhoto(savedId, file, caption),
      deletePhoto: (savedId, photoId) =>
        request('DELETE', `/api/library/saved-properties/${encodeURIComponent(savedId)}/photos/${encodeURIComponent(photoId)}`),
      importListingPhotos: (savedId, listingUrl) =>
        request('POST', `/api/library/saved-properties/${encodeURIComponent(savedId)}/import-listing-photos`, {
          listing_url: listingUrl,
        }),
      shareWithRealtor: (savedId, body) =>
        request('POST', `/api/library/saved-properties/${encodeURIComponent(savedId)}/share`, body),
      listFolders: () => request('GET', '/api/library/folders'),
      createFolder: (data) => request('POST', '/api/library/folders', data),
      deleteFolder: (id) => request('DELETE', `/api/library/folders/${encodeURIComponent(id)}`),
      addToFolder: (folderId, savedPropertyId) =>
        request('POST', `/api/library/folders/${encodeURIComponent(folderId)}/items`, { saved_property_id: savedPropertyId }),
      removeFromFolder: (folderId, savedPropertyId) =>
        request('DELETE', `/api/library/folders/${encodeURIComponent(folderId)}/items/${encodeURIComponent(savedPropertyId)}`),
      realtorInbox: () => request('GET', '/api/library/realtor/inbox'),
    },
  };
}
