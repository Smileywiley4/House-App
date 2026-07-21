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

function requireApiBase() {
  if (!baseUrl) {
    throw new Error(
      'VITE_API_BASE_URL is missing. Set it in .env.local (e.g. http://localhost:8000) when VITE_USE_PYTHON_BACKEND=true.',
    );
  }
}

function parseApiErrorBody(text, fallback) {
  if (!text) return fallback;
  try {
    const j = JSON.parse(text);
    const d = j.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) {
      return d.map((x) => (typeof x === 'string' ? x : x?.msg || JSON.stringify(x))).join('. ');
    }
    if (typeof j.message === 'string') return j.message;
    return text;
  } catch {
    return text || fallback;
  }
}

function wrapNetworkError(err, path) {
  const raw = err?.message || String(err);
  const isNetwork =
    raw === 'Failed to fetch' ||
    raw === 'NetworkError when attempting to fetch resource.' ||
    raw.includes('Network request failed') ||
    err?.name === 'TypeError';
  if (!isNetwork) return err;
  const hint = baseUrl
    ? ` (${baseUrl.replace(/^https?:\/\//, '')})`
    : '';
  const message =
    `Property search is temporarily unavailable${hint}. ` +
    'The server may be down or misconfigured — try again in a few minutes.';
  const wrapped = new Error(message);
  wrapped.isNetworkError = true;
  wrapped.cause = err;
  wrapped.path = path;
  return wrapped;
}

async function request(method, path, body = undefined, extraHeaders = undefined) {
  requireApiBase();
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (extraHeaders && typeof extraHeaders === 'object') {
    Object.assign(headers, extraHeaders);
  }
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
  } catch (err) {
    throw wrapNetworkError(err, path);
  }
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(parseApiErrorBody(text, res.statusText));
    err.status = res.status;
    throw err;
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return null;
  return res.json();
}

/** Auth profile calls: try Railway first, then same-origin Vercel bridge. */
async function requestAuthProfile(method, path, body = undefined) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const bases = [];
  if (baseUrl) bases.push(baseUrl);
  if (typeof window !== 'undefined' && window.location?.origin && !bases.includes(window.location.origin)) {
    bases.push(window.location.origin);
  }

  let lastErr = null;
  for (const base of bases) {
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text();
        const err = new Error(parseApiErrorBody(text, res.statusText));
        err.status = res.status;
        // Stale Railway JWT / missing route → try next base
        if (res.status === 401 || res.status === 404 || res.status === 502 || res.status === 503) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      if (res.status === 204 || res.headers.get('content-length') === '0') return null;
      return res.json();
    } catch (err) {
      lastErr = wrapNetworkError(err, path);
      if (err?.status && err.status !== 401 && err.status !== 404) throw lastErr;
    }
  }
  throw lastErr || new Error('Auth profile unavailable');
}

async function publicGet(path, signal) {
  requireApiBase();
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, { credentials: 'include', signal });
  } catch (err) {
    throw wrapNetworkError(err, path);
  }
  if (!res.ok) throw new Error(parseApiErrorBody(await res.text(), res.statusText));
  return res.json();
}

async function requestBlob(method, path) {
  requireApiBase();
  const token = await getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, { method, headers, credentials: 'include' });
  } catch (err) {
    throw wrapNetworkError(err, path);
  }
  if (!res.ok) {
    const err = new Error(await res.text() || res.statusText);
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

/**
 * Google Drive v3 proxy: JSON or binary body, optional query + extra headers.
 * @param {object} [options]
 * @param {Record<string, string|number|boolean|undefined>} [options.query]
 * @param {object} [options.jsonBody] - sets Content-Type application/json
 * @param {Blob|ArrayBuffer|Uint8Array|string|undefined} [options.body] - raw body (set Content-Type in options.headers if needed)
 * @param {Record<string, string>} [options.headers]
 * @param {boolean} [options.rawResponse] - return fetch Response
 * @returns {Promise<object|Blob|null|Response>}
 */
async function requestDriveProxy(method, path, options = {}) {
  requireApiBase();
  const {
    query = {},
    jsonBody,
    body,
    headers: optHeaders = {},
    rawResponse = false,
  } = options;
  const token = await getToken();
  const headers = { ...optHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  let reqBody;
  if (jsonBody !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || headers['content-type'] || 'application/json';
    reqBody = JSON.stringify(jsonBody);
  } else if (body !== undefined && body !== null) {
    reqBody = body;
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/octet-stream';
    }
  }
  const p = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v == null || v === '') return;
    if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
    else p.set(k, String(v));
  });
  const qs = p.toString();
  const url = `${baseUrl}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { method, headers, body: reqBody, credentials: 'include' });
  if (rawResponse) return res;
  if (!res.ok) {
    const err = new Error(await res.text() || res.statusText);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return res.json();
  return res.blob();
}

async function uploadVisitPhoto(savedId, file, caption) {
  requireApiBase();
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
  return {
    auth: {
      me: () => requestAuthProfile('GET', '/api/auth/me'),
      updateMe: (profile) => requestAuthProfile('PATCH', '/api/auth/me', profile),
      requestLicenseVerification: (payload = {}) =>
        requestAuthProfile('POST', '/api/auth/me/license/request-verification', payload),
      deleteMe: () => requestAuthProfile('DELETE', '/api/auth/me', { confirmation: 'DELETE' }),
      exportMe: () => requestAuthProfile('GET', '/api/auth/me/export'),
      updateEmail: async (email) => {
        // Official Supabase email-change: confirmation is emailed to the new address.
        // profiles.email is synced after confirmation (DB trigger + /api/auth/me).
        const normalized = String(email || '').trim().toLowerCase();
        if (!normalized.includes('@')) {
          throw new Error('Enter a valid email address.');
        }
        const emailRedirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/login?redirect=${encodeURIComponent('/profile?tab=security&email_changed=1')}`
            : undefined;
        const { data, error } = await getSupabase().auth.updateUser(
          { email: normalized },
          emailRedirectTo ? { emailRedirectTo } : undefined
        );
        if (error) throw error;
        return {
          email: data?.user?.email || null,
          pendingEmail: data?.user?.new_email || normalized,
        };
      },
      getEmailChangeStatus: async () => {
        const { data: { user } } = await getSupabase().auth.getUser();
        if (!user) return { email: null, pendingEmail: null };
        return {
          email: user.email || null,
          pendingEmail: user.new_email || null,
        };
      },
      updatePassword: async (password) => {
        const { error } = await getSupabase().auth.updateUser({ password });
        if (error) throw error;
      },
      logout: async (returnUrl) => {
        await getSupabase().auth.signOut({ scope: 'local' });
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
      autocomplete: (query, signal) =>
        publicGet(`/api/property/autocomplete?q=${encodeURIComponent(query)}`, signal),
      browse: (body) => request('POST', '/api/property/browse', body),
      searchByCriteria: (filters, source = 'public') =>
        request('POST', '/api/property/search-by-criteria', { filters, source }),
      autoscore: (address, property) => request('POST', '/api/property/autoscore', { address, property }),
      /** Google Places API (New) searchNearby; optional `fieldMask` e.g. `places.displayName` */
      placesSearchNearby: (body, fieldMask) =>
        request(
          'POST',
          '/api/property/places/search-nearby',
          body,
          fieldMask ? { 'X-Goog-FieldMask': fieldMask } : undefined,
        ),
    },
    geo: {
      /** Nominatim place boundary (city/ZIP/neighborhood) → { ring, label, lat, lng } */
      boundary: (query, signal) =>
        publicGet(`/api/geo/boundary?q=${encodeURIComponent(query)}`, signal),
    },
    browsePrefs: {
      remember: (body) => request('POST', '/api/browse-prefs/remember', body),
      getSuggested: () => request('GET', '/api/browse-prefs/suggested'),
      /** Unified saved presets + soft-learned suggestions (Browse + SearchByPreset). */
      list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.clientId) q.set('client_id', params.clientId);
        if (params.limit != null) q.set('limit', String(params.limit));
        const qs = q.toString();
        return request('GET', `/api/browse-prefs/list${qs ? `?${qs}` : ''}`);
      },
    },
    listingAlerts: {
      list: () => request('GET', '/api/listing-alerts'),
      create: (data) => request('POST', '/api/listing-alerts', data),
      update: (id, data) => request('PATCH', `/api/listing-alerts/${id}`, data),
      delete: (id) => request('DELETE', `/api/listing-alerts/${id}`),
    },
    notifications: {
      list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.unread_only) q.set('unread_only', 'true');
        if (params.limit != null) q.set('limit', String(params.limit));
        const qs = q.toString();
        return request('GET', `/api/notifications${qs ? `?${qs}` : ''}`);
      },
      unreadCount: () => request('GET', '/api/notifications/unread-count'),
      markRead: (id) => request('POST', `/api/notifications/${id}/read`),
      markAllRead: () => request('POST', '/api/notifications/read-all'),
    },
    contacts: {
      search: (q) => request('GET', `/api/contacts/search?q=${encodeURIComponent(q || '')}`),
      list: () => request('GET', '/api/contacts'),
      add: (body) => request('POST', '/api/contacts', body),
      accept: (id) => request('POST', `/api/contacts/${encodeURIComponent(id)}/accept`),
      decline: (id) => request('POST', `/api/contacts/${encodeURIComponent(id)}/decline`),
      update: (id, body) => request('PATCH', `/api/contacts/${encodeURIComponent(id)}`, body),
      remove: (id) => request('DELETE', `/api/contacts/${encodeURIComponent(id)}`),
    },
    shares: {
      send: (body) => request('POST', '/api/shares', body),
      inbox: () => request('GET', '/api/shares/inbox'),
      sent: () => request('GET', '/api/shares/sent'),
      pendingCount: () => request('GET', '/api/shares/pending-count'),
      clientReport: (contactUserId) =>
        request(
          'GET',
          `/api/shares/client-report?contact_user_id=${encodeURIComponent(contactUserId || '')}`,
        ),
      get: (id) => request('GET', `/api/shares/${encodeURIComponent(id)}`),
      markViewed: (id) => request('POST', `/api/shares/${encodeURIComponent(id)}/view`),
      returnScores: (id, body) => request('POST', `/api/shares/${encodeURIComponent(id)}/return`, body),
      cancel: (id) => request('POST', `/api/shares/${encodeURIComponent(id)}/cancel`),
    },
    integrations: {
      invokeLLM: (options) => request('POST', '/api/integrations/llm/invoke', {
        prompt: options.prompt,
        response_json_schema: options.response_json_schema,
        feature: options.feature || 'invoke',
      }),
      /**
       * Google AMP URL API (batch). Response: { ampUrls: AmpUrl[], urlErrors: AmpUrlError[] }
       * AmpUrl: { originalUrl: string, ampUrl: string, cdnAmpUrl: string }
       * AmpUrlError: { errorCode: string (Google ErrorCode), errorMessage: string, originalUrl: string }
       * @param {{ urls: string[], lookupStrategy?: 'FETCH_LIVE_DOC'|'IN_INDEX_DOC'|'LOOKUP_STRATEGY_UNSPECIFIED' }} body
       */
      ampUrlBatchGet: (body) =>
        request('POST', '/api/integrations/google/amp-url/batch-get', body),
      /**
       * Google Workspace Admin — Data Transfer API (requires backend SA + JWT user with plan `admin`).
       * Query params use snake_case (FastAPI).
       */
      workspaceDataTransfer: {
        listApplications: (params = {}) => {
          const q = new URLSearchParams();
          if (params.customer_id != null && params.customer_id !== '') q.set('customer_id', String(params.customer_id));
          if (params.max_results != null) q.set('max_results', String(params.max_results));
          if (params.page_token) q.set('page_token', params.page_token);
          const qs = q.toString();
          return request('GET', `/api/integrations/google/workspace/datatransfer/applications${qs ? `?${qs}` : ''}`);
        },
        getApplication: (applicationId) =>
          request('GET', `/api/integrations/google/workspace/datatransfer/applications/${encodeURIComponent(applicationId)}`),
        listTransfers: (params = {}) => {
          const q = new URLSearchParams();
          if (params.customer_id != null && params.customer_id !== '') q.set('customer_id', String(params.customer_id));
          if (params.max_results != null) q.set('max_results', String(params.max_results));
          if (params.page_token) q.set('page_token', params.page_token);
          if (params.new_owner_user_id) q.set('new_owner_user_id', params.new_owner_user_id);
          if (params.old_owner_user_id) q.set('old_owner_user_id', params.old_owner_user_id);
          if (params.status) q.set('status', params.status);
          const qs = q.toString();
          return request('GET', `/api/integrations/google/workspace/datatransfer/transfers${qs ? `?${qs}` : ''}`);
        },
        getTransfer: (dataTransferId) =>
          request('GET', `/api/integrations/google/workspace/datatransfer/transfers/${encodeURIComponent(dataTransferId)}`),
        createTransfer: (body) =>
          request('POST', '/api/integrations/google/workspace/datatransfer/transfers', body),
      },
      /**
       * AdSense Management API v2 (requires plan `admin` + OAuth refresh token on server).
       * @param {string} accountRef e.g. "accounts/pub-1234567890"
       */
      adsense: {
        listAccounts: (params = {}) => {
          const q = new URLSearchParams();
          if (params.page_size != null) q.set('page_size', String(params.page_size));
          if (params.page_token) q.set('page_token', params.page_token);
          const qs = q.toString();
          return request('GET', `/api/integrations/google/adsense/accounts${qs ? `?${qs}` : ''}`);
        },
        getAccount: (accountRef) =>
          request('GET', `/api/integrations/google/adsense/accounts/${encodeURIComponent(accountRef)}`),
        listChildAccounts: (accountRef, params = {}) => {
          const q = new URLSearchParams();
          if (params.page_size != null) q.set('page_size', String(params.page_size));
          if (params.page_token) q.set('page_token', params.page_token);
          const qs = q.toString();
          return request(
            'GET',
            `/api/integrations/google/adsense/accounts/${encodeURIComponent(accountRef)}/child-accounts${qs ? `?${qs}` : ''}`,
          );
        },
        listAdClients: (accountRef, params = {}) => {
          const q = new URLSearchParams();
          if (params.page_size != null) q.set('page_size', String(params.page_size));
          if (params.page_token) q.set('page_token', params.page_token);
          const qs = q.toString();
          return request(
            'GET',
            `/api/integrations/google/adsense/accounts/${encodeURIComponent(accountRef)}/adclients${qs ? `?${qs}` : ''}`,
          );
        },
        generateReport: (accountRef, body) =>
          request(
            'POST',
            `/api/integrations/google/adsense/accounts/${encodeURIComponent(accountRef)}/reports:generate`,
            body,
          ),
        generateReportCsv: async (accountRef, body) => {
          const token = await getToken();
          const headers = { 'Content-Type': 'application/json' };
          if (token) headers.Authorization = `Bearer ${token}`;
          const res = await fetch(
            `${baseUrl}/api/integrations/google/adsense/accounts/${encodeURIComponent(accountRef)}/reports:generateCsv`,
            { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' },
          );
          if (!res.ok) throw new Error((await res.text()) || res.statusText);
          return res.text();
        },
        listSites: (accountRef, params = {}) => {
          const q = new URLSearchParams();
          if (params.page_size != null) q.set('page_size', String(params.page_size));
          if (params.page_token) q.set('page_token', params.page_token);
          const qs = q.toString();
          return request(
            'GET',
            `/api/integrations/google/adsense/accounts/${encodeURIComponent(accountRef)}/sites${qs ? `?${qs}` : ''}`,
          );
        },
        listPayments: (accountRef) =>
          request('GET', `/api/integrations/google/adsense/accounts/${encodeURIComponent(accountRef)}/payments`),
        listAlerts: (accountRef, params = {}) => {
          const q = new URLSearchParams();
          if (params.language_code) q.set('language_code', params.language_code);
          const qs = q.toString();
          return request(
            'GET',
            `/api/integrations/google/adsense/accounts/${encodeURIComponent(accountRef)}/alerts${qs ? `?${qs}` : ''}`,
          );
        },
      },
      /**
       * AdSense Platform API v1alpha (Google discovery). Same OAuth as Management; writes need GOOGLE_ADSENSE_ACCESS=readwrite.
       * @param {string} platformId e.g. pub-… (or full `platforms/pub-…`)
       * @param {string} accountId sub-account id or full `platforms/…/accounts/…`
       * @param {string} siteId site id or full resource name
       */
      adsensePlatform: {
        listAccounts: (platformId, params = {}) => {
          const q = new URLSearchParams();
          if (params.page_size != null) q.set('page_size', String(params.page_size));
          if (params.page_token) q.set('page_token', params.page_token);
          const qs = q.toString();
          return request(
            'GET',
            `/api/integrations/google/adsense-platform/v1alpha/platforms/${encodeURIComponent(platformId)}/accounts${qs ? `?${qs}` : ''}`,
          );
        },
        lookupAccount: (platformId, params = {}) => {
          const q = new URLSearchParams();
          if (params.creation_request_id) q.set('creation_request_id', params.creation_request_id);
          const qs = q.toString();
          return request(
            'GET',
            `/api/integrations/google/adsense-platform/v1alpha/platforms/${encodeURIComponent(platformId)}/accounts:lookup${qs ? `?${qs}` : ''}`,
          );
        },
        getAccount: (platformId, accountId) =>
          request(
            'GET',
            `/api/integrations/google/adsense-platform/v1alpha/platforms/${encodeURIComponent(platformId)}/accounts/${encodeURIComponent(accountId)}`,
          ),
        createAccount: (platformId, body) =>
          request(
            'POST',
            `/api/integrations/google/adsense-platform/v1alpha/platforms/${encodeURIComponent(platformId)}/accounts`,
            body,
          ),
        closeAccount: (platformId, accountId, body = {}) =>
          request(
            'POST',
            `/api/integrations/google/adsense-platform/v1alpha/platforms/${encodeURIComponent(platformId)}/accounts/${encodeURIComponent(accountId)}:close`,
            body,
          ),
        createEvent: (platformId, accountId, body) =>
          request(
            'POST',
            `/api/integrations/google/adsense-platform/v1alpha/platforms/${encodeURIComponent(platformId)}/accounts/${encodeURIComponent(accountId)}/events`,
            body,
          ),
        listSites: (platformId, accountId, params = {}) => {
          const q = new URLSearchParams();
          if (params.page_size != null) q.set('page_size', String(params.page_size));
          if (params.page_token) q.set('page_token', params.page_token);
          const qs = q.toString();
          return request(
            'GET',
            `/api/integrations/google/adsense-platform/v1alpha/platforms/${encodeURIComponent(platformId)}/accounts/${encodeURIComponent(accountId)}/sites${qs ? `?${qs}` : ''}`,
          );
        },
        getSite: (platformId, accountId, siteId) =>
          request(
            'GET',
            `/api/integrations/google/adsense-platform/v1alpha/platforms/${encodeURIComponent(platformId)}/accounts/${encodeURIComponent(accountId)}/sites/${encodeURIComponent(siteId)}`,
          ),
        createSite: (platformId, accountId, body) =>
          request(
            'POST',
            `/api/integrations/google/adsense-platform/v1alpha/platforms/${encodeURIComponent(platformId)}/accounts/${encodeURIComponent(accountId)}/sites`,
            body,
          ),
        requestSiteReview: (platformId, accountId, siteId) =>
          request(
            'POST',
            `/api/integrations/google/adsense-platform/v1alpha/platforms/${encodeURIComponent(platformId)}/accounts/${encodeURIComponent(accountId)}/sites/${encodeURIComponent(siteId)}:requestReview`,
            {},
          ),
        deleteSite: (platformId, accountId, siteId) =>
          request(
            'DELETE',
            `/api/integrations/google/adsense-platform/v1alpha/platforms/${encodeURIComponent(platformId)}/accounts/${encodeURIComponent(accountId)}/sites/${encodeURIComponent(siteId)}`,
          ),
        /**
         * Transparent Platform: accounts/{account}/platforms/… (v1alpha discovery).
         * @param {string} adsenseAccountId pub-… or accounts/pub-…
         */
        transparent: {
          listPlatforms: (adsenseAccountId, params = {}) => {
            const q = new URLSearchParams();
            if (params.page_size != null) q.set('page_size', String(params.page_size));
            if (params.page_token) q.set('page_token', params.page_token);
            const qs = q.toString();
            return request(
              'GET',
              `/api/integrations/google/adsense-platform/v1alpha/accounts/${encodeURIComponent(adsenseAccountId)}/platforms${qs ? `?${qs}` : ''}`,
            );
          },
          getPlatform: (adsenseAccountId, platformId) =>
            request(
              'GET',
              `/api/integrations/google/adsense-platform/v1alpha/accounts/${encodeURIComponent(adsenseAccountId)}/platforms/${encodeURIComponent(platformId)}`,
            ),
          listGroups: (adsenseAccountId, platformId, params = {}) => {
            const q = new URLSearchParams();
            if (params.page_size != null) q.set('page_size', String(params.page_size));
            if (params.page_token) q.set('page_token', params.page_token);
            const qs = q.toString();
            return request(
              'GET',
              `/api/integrations/google/adsense-platform/v1alpha/accounts/${encodeURIComponent(adsenseAccountId)}/platforms/${encodeURIComponent(platformId)}/groups${qs ? `?${qs}` : ''}`,
            );
          },
          getGroup: (adsenseAccountId, platformId, groupId) =>
            request(
              'GET',
              `/api/integrations/google/adsense-platform/v1alpha/accounts/${encodeURIComponent(adsenseAccountId)}/platforms/${encodeURIComponent(platformId)}/groups/${encodeURIComponent(groupId)}`,
            ),
          patchGroup: (adsenseAccountId, platformId, groupId, body, params = {}) => {
            const q = new URLSearchParams();
            if (params.update_mask) q.set('update_mask', params.update_mask);
            const qs = q.toString();
            return request(
              'PATCH',
              `/api/integrations/google/adsense-platform/v1alpha/accounts/${encodeURIComponent(adsenseAccountId)}/platforms/${encodeURIComponent(platformId)}/groups/${encodeURIComponent(groupId)}${qs ? `?${qs}` : ''}`,
              body,
            );
          },
          listChildSites: (adsenseAccountId, platformId, childAccountId, params = {}) => {
            const q = new URLSearchParams();
            if (params.page_size != null) q.set('page_size', String(params.page_size));
            if (params.page_token) q.set('page_token', params.page_token);
            const qs = q.toString();
            return request(
              'GET',
              `/api/integrations/google/adsense-platform/v1alpha/accounts/${encodeURIComponent(adsenseAccountId)}/platforms/${encodeURIComponent(platformId)}/childAccounts/${encodeURIComponent(childAccountId)}/sites${qs ? `?${qs}` : ''}`,
            );
          },
          getChildSite: (adsenseAccountId, platformId, childAccountId, siteId) =>
            request(
              'GET',
              `/api/integrations/google/adsense-platform/v1alpha/accounts/${encodeURIComponent(adsenseAccountId)}/platforms/${encodeURIComponent(platformId)}/childAccounts/${encodeURIComponent(childAccountId)}/sites/${encodeURIComponent(siteId)}`,
            ),
          patchChildSite: (adsenseAccountId, platformId, childAccountId, siteId, body, params = {}) => {
            const q = new URLSearchParams();
            if (params.update_mask) q.set('update_mask', params.update_mask);
            const qs = q.toString();
            return request(
              'PATCH',
              `/api/integrations/google/adsense-platform/v1alpha/accounts/${encodeURIComponent(adsenseAccountId)}/platforms/${encodeURIComponent(platformId)}/childAccounts/${encodeURIComponent(childAccountId)}/sites/${encodeURIComponent(siteId)}${qs ? `?${qs}` : ''}`,
              body,
            );
          },
        },
      },
      /**
       * Publisher revenue: AdSense daily estimate → Supabase (admin). Does not move money to Stripe.
       * @see docs/PUBLISHER_REVENUE_ADSENSE_STRIPE.md
       */
      revenue: {
        adsenseDailySnapshot: () =>
          request('POST', '/api/integrations/revenue/adsense-daily-snapshot'),
        listSnapshots: (params = {}) => {
          const q = new URLSearchParams();
          if (params.limit != null) q.set('limit', String(params.limit));
          const qs = q.toString();
          return request('GET', `/api/integrations/revenue/snapshots${qs ? `?${qs}` : ''}`);
        },
      },
      /**
       * Google Analytics Hub — GCP service account on server (admin JWT).
       * Path segment matches Google API version: `v1` (full surface) or `v1beta1` (subset; v1-only methods 404).
       * Set VITE_GOOGLE_ANALYTICS_HUB_API_VERSION=v1beta1 to match beta discovery.
       * https://cloud.google.com/bigquery/docs/analytics-hub-introduction
       */
      analyticsHub: (() => {
        const raw = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_ANALYTICS_HUB_API_VERSION) || 'v1';
        const AH_VER = String(raw).trim().toLowerCase() === 'v1beta1' ? 'v1beta1' : 'v1';
        const bp = (projectId, locationId) =>
          `/api/integrations/google/analytics-hub/${AH_VER}/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}`;
        const de = (projectId, locationId, dataExchangeId) =>
          `${bp(projectId, locationId)}/dataExchanges/${encodeURIComponent(dataExchangeId)}`;
        const pg = (params) => {
          const q = new URLSearchParams();
          if (params.page_size != null) q.set('page_size', String(params.page_size));
          if (params.page_token) q.set('page_token', params.page_token);
          return q.toString();
        };
        return {
          listDataExchanges: (projectId, locationId, params = {}) => {
            const qs = pg(params);
            return request('GET', `${bp(projectId, locationId)}/dataExchanges${qs ? `?${qs}` : ''}`);
          },
          getDataExchange: (projectId, locationId, dataExchangeId) =>
            request('GET', `${de(projectId, locationId, dataExchangeId)}`),
          createDataExchange: (projectId, locationId, dataExchangeId, body) => {
            const q = new URLSearchParams({ data_exchange_id: dataExchangeId });
            return request('POST', `${bp(projectId, locationId)}/dataExchanges?${q}`, body);
          },
          patchDataExchange: (projectId, locationId, dataExchangeId, body, params) => {
            const q = new URLSearchParams({ update_mask: params.update_mask });
            return request('PATCH', `${de(projectId, locationId, dataExchangeId)}?${q}`, body);
          },
          deleteDataExchange: (projectId, locationId, dataExchangeId) =>
            request('DELETE', `${de(projectId, locationId, dataExchangeId)}`),
          subscribeDataExchange: (projectId, locationId, dataExchangeId, body) =>
            request('POST', `${de(projectId, locationId, dataExchangeId)}:subscribe`, body),
          listDataExchangeSubscriptions: (projectId, locationId, dataExchangeId, params = {}) => {
            const q = new URLSearchParams();
            if (params.include_deleted_subscriptions != null) {
              q.set('include_deleted_subscriptions', String(params.include_deleted_subscriptions));
            }
            if (params.page_size != null) q.set('page_size', String(params.page_size));
            if (params.page_token) q.set('page_token', params.page_token);
            const qs = q.toString();
            return request('GET', `${de(projectId, locationId, dataExchangeId)}:listSubscriptions${qs ? `?${qs}` : ''}`);
          },
          dataExchangeGetIamPolicy: (projectId, locationId, dataExchangeId, body = {}) =>
            request('POST', `${de(projectId, locationId, dataExchangeId)}:getIamPolicy`, body),
          dataExchangeSetIamPolicy: (projectId, locationId, dataExchangeId, body) =>
            request('POST', `${de(projectId, locationId, dataExchangeId)}:setIamPolicy`, body),
          dataExchangeTestIamPermissions: (projectId, locationId, dataExchangeId, body) =>
            request('POST', `${de(projectId, locationId, dataExchangeId)}:testIamPermissions`, body),
          listListings: (projectId, locationId, dataExchangeId, params = {}) => {
            const qs = pg(params);
            return request('GET', `${de(projectId, locationId, dataExchangeId)}/listings${qs ? `?${qs}` : ''}`);
          },
          getListing: (projectId, locationId, dataExchangeId, listingId) =>
            request('GET', `${de(projectId, locationId, dataExchangeId)}/listings/${encodeURIComponent(listingId)}`),
          createListing: (projectId, locationId, dataExchangeId, listingId, body) => {
            const q = new URLSearchParams({ listing_id: listingId });
            return request('POST', `${de(projectId, locationId, dataExchangeId)}/listings?${q}`, body);
          },
          patchListing: (projectId, locationId, dataExchangeId, listingId, body, params) => {
            const q = new URLSearchParams({ update_mask: params.update_mask });
            return request(
              'PATCH',
              `${de(projectId, locationId, dataExchangeId)}/listings/${encodeURIComponent(listingId)}?${q}`,
              body,
            );
          },
          deleteListing: (projectId, locationId, dataExchangeId, listingId, params = {}) => {
            const q = new URLSearchParams();
            if (params.delete_commercial != null) q.set('delete_commercial', String(params.delete_commercial));
            const qs = q.toString();
            return request(
              'DELETE',
              `${de(projectId, locationId, dataExchangeId)}/listings/${encodeURIComponent(listingId)}${qs ? `?${qs}` : ''}`,
            );
          },
          subscribeListing: (projectId, locationId, dataExchangeId, listingId, body) =>
            request(
              'POST',
              `${de(projectId, locationId, dataExchangeId)}/listings/${encodeURIComponent(listingId)}:subscribe`,
              body,
            ),
          listListingSubscriptions: (projectId, locationId, dataExchangeId, listingId, params = {}) => {
            const q = new URLSearchParams();
            if (params.include_deleted_subscriptions != null) {
              q.set('include_deleted_subscriptions', String(params.include_deleted_subscriptions));
            }
            if (params.page_size != null) q.set('page_size', String(params.page_size));
            if (params.page_token) q.set('page_token', params.page_token);
            const qs = q.toString();
            return request(
              'GET',
              `${de(projectId, locationId, dataExchangeId)}/listings/${encodeURIComponent(listingId)}:listSubscriptions${qs ? `?${qs}` : ''}`,
            );
          },
          listingGetIamPolicy: (projectId, locationId, dataExchangeId, listingId, body = {}) =>
            request(
              'POST',
              `${de(projectId, locationId, dataExchangeId)}/listings/${encodeURIComponent(listingId)}:getIamPolicy`,
              body,
            ),
          listingSetIamPolicy: (projectId, locationId, dataExchangeId, listingId, body) =>
            request(
              'POST',
              `${de(projectId, locationId, dataExchangeId)}/listings/${encodeURIComponent(listingId)}:setIamPolicy`,
              body,
            ),
          listingTestIamPermissions: (projectId, locationId, dataExchangeId, listingId, body) =>
            request(
              'POST',
              `${de(projectId, locationId, dataExchangeId)}/listings/${encodeURIComponent(listingId)}:testIamPermissions`,
              body,
            ),
          listQueryTemplates: (projectId, locationId, dataExchangeId, params = {}) => {
            const qs = pg(params);
            return request('GET', `${de(projectId, locationId, dataExchangeId)}/queryTemplates${qs ? `?${qs}` : ''}`);
          },
          getQueryTemplate: (projectId, locationId, dataExchangeId, templateId) =>
            request(
              'GET',
              `${de(projectId, locationId, dataExchangeId)}/queryTemplates/${encodeURIComponent(templateId)}`,
            ),
          createQueryTemplate: (projectId, locationId, dataExchangeId, queryTemplateId, body) => {
            const q = new URLSearchParams({ query_template_id: queryTemplateId });
            return request('POST', `${de(projectId, locationId, dataExchangeId)}/queryTemplates?${q}`, body);
          },
          patchQueryTemplate: (projectId, locationId, dataExchangeId, templateId, body, params = {}) => {
            const q = new URLSearchParams();
            if (params.update_mask) q.set('update_mask', params.update_mask);
            const qs = q.toString();
            return request(
              'PATCH',
              `${de(projectId, locationId, dataExchangeId)}/queryTemplates/${encodeURIComponent(templateId)}${qs ? `?${qs}` : ''}`,
              body,
            );
          },
          deleteQueryTemplate: (projectId, locationId, dataExchangeId, templateId) =>
            request(
              'DELETE',
              `${de(projectId, locationId, dataExchangeId)}/queryTemplates/${encodeURIComponent(templateId)}`,
            ),
          submitQueryTemplate: (projectId, locationId, dataExchangeId, templateId, body = {}) =>
            request(
              'POST',
              `${de(projectId, locationId, dataExchangeId)}/queryTemplates/${encodeURIComponent(templateId)}:submit`,
              body,
            ),
          approveQueryTemplate: (projectId, locationId, dataExchangeId, templateId, body = {}) =>
            request(
              'POST',
              `${de(projectId, locationId, dataExchangeId)}/queryTemplates/${encodeURIComponent(templateId)}:approve`,
              body,
            ),
          listSubscriptions: (projectId, locationId, params = {}) => {
            const q = new URLSearchParams();
            if (params.filter) q.set('filter', params.filter);
            if (params.page_size != null) q.set('page_size', String(params.page_size));
            if (params.page_token) q.set('page_token', params.page_token);
            const qs = q.toString();
            return request('GET', `${bp(projectId, locationId)}/subscriptions${qs ? `?${qs}` : ''}`);
          },
          getSubscription: (projectId, locationId, subscriptionId) =>
            request('GET', `${bp(projectId, locationId)}/subscriptions/${encodeURIComponent(subscriptionId)}`),
          refreshSubscription: (projectId, locationId, subscriptionId, body = {}) =>
            request('POST', `${bp(projectId, locationId)}/subscriptions/${encodeURIComponent(subscriptionId)}:refresh`, body),
          revokeSubscription: (projectId, locationId, subscriptionId, body = {}) =>
            request('POST', `${bp(projectId, locationId)}/subscriptions/${encodeURIComponent(subscriptionId)}:revoke`, body),
          deleteSubscription: (projectId, locationId, subscriptionId) =>
            request('DELETE', `${bp(projectId, locationId)}/subscriptions/${encodeURIComponent(subscriptionId)}`),
          subscriptionGetIamPolicy: (projectId, locationId, subscriptionId, body = {}) =>
            request('POST', `${bp(projectId, locationId)}/subscriptions/${encodeURIComponent(subscriptionId)}:getIamPolicy`, body),
          subscriptionSetIamPolicy: (projectId, locationId, subscriptionId, body) =>
            request('POST', `${bp(projectId, locationId)}/subscriptions/${encodeURIComponent(subscriptionId)}:setIamPolicy`, body),
          listOrgDataExchanges: (organizationId, locationId, params = {}) => {
            const qs = pg(params);
            const base = `/api/integrations/google/analytics-hub/${AH_VER}/organizations/${encodeURIComponent(organizationId)}/locations/${encodeURIComponent(locationId)}/dataExchanges`;
            return request('GET', `${base}${qs ? `?${qs}` : ''}`);
          },
        };
      })(),
      /**
       * Google Android Management API v1 — GCP service account on server (admin JWT).
       * https://developers.google.com/android/management
       */
      androidManagement: (() => {
        const B = `/api/integrations/google/android-management/v1`;
        const ent = (enterpriseId) => `${B}/enterprises/${encodeURIComponent(enterpriseId)}`;
        const q = (obj) => {
          const p = new URLSearchParams();
          Object.entries(obj || {}).forEach(([k, v]) => {
            if (v == null || v === '') return;
            if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
            else p.set(k, String(v));
          });
          const s = p.toString();
          return s ? `?${s}` : '';
        };
        return {
          createSignupUrl: (params = {}) =>
            request('POST', `${B}/signupUrls${q({ projectId: params.project_id, callbackUrl: params.callback_url, adminEmail: params.admin_email, allowedDomains: params.allowed_domains })}`),
          listEnterprises: (params) =>
            request('GET', `${B}/enterprises${q({ projectId: params.project_id, pageSize: params.page_size, pageToken: params.page_token, view: params.view })}`),
          createEnterprise: (body, params = {}) =>
            request(
              'POST',
              `${B}/enterprises${q({ projectId: params.project_id, signupUrlName: params.signup_url_name, enterpriseToken: params.enterprise_token, agreementAccepted: params.agreement_accepted })}`,
              body,
            ),
          getEnterprise: (enterpriseId) => request('GET', `${ent(enterpriseId)}`),
          patchEnterprise: (enterpriseId, body, params = {}) =>
            request('PATCH', `${ent(enterpriseId)}${q({ updateMask: params.update_mask })}`, body),
          deleteEnterprise: (enterpriseId) => request('DELETE', `${ent(enterpriseId)}`),
          generateEnterpriseUpgradeUrl: (enterpriseId, body) =>
            request('POST', `${ent(enterpriseId)}:generateEnterpriseUpgradeUrl`, body),
          createEnrollmentToken: (enterpriseId, body) => request('POST', `${ent(enterpriseId)}/enrollmentTokens`, body),
          listEnrollmentTokens: (enterpriseId, params = {}) =>
            request('GET', `${ent(enterpriseId)}/enrollmentTokens${q({ pageSize: params.page_size, pageToken: params.page_token })}`),
          getEnrollmentToken: (enterpriseId, tokenId) =>
            request('GET', `${ent(enterpriseId)}/enrollmentTokens/${encodeURIComponent(tokenId)}`),
          deleteEnrollmentToken: (enterpriseId, tokenId) =>
            request('DELETE', `${ent(enterpriseId)}/enrollmentTokens/${encodeURIComponent(tokenId)}`),
          createWebToken: (enterpriseId, body) => request('POST', `${ent(enterpriseId)}/webTokens`, body),
          listDevices: (enterpriseId, params = {}) =>
            request('GET', `${ent(enterpriseId)}/devices${q({ pageSize: params.page_size, pageToken: params.page_token })}`),
          getDevice: (enterpriseId, deviceId) =>
            request('GET', `${ent(enterpriseId)}/devices/${encodeURIComponent(deviceId)}`),
          patchDevice: (enterpriseId, deviceId, body, params = {}) =>
            request('PATCH', `${ent(enterpriseId)}/devices/${encodeURIComponent(deviceId)}${q({ updateMask: params.update_mask })}`, body),
          deleteDevice: (enterpriseId, deviceId, params = {}) =>
            request(
              'DELETE',
              `${ent(enterpriseId)}/devices/${encodeURIComponent(deviceId)}${q({ wipeDataFlags: params.wipe_data_flags, wipeReasonMessage: params.wipe_reason_message })}`,
            ),
          issueDeviceCommand: (enterpriseId, deviceId, body) =>
            request('POST', `${ent(enterpriseId)}/devices/${encodeURIComponent(deviceId)}:issueCommand`, body),
          listDeviceOperations: (enterpriseId, deviceId, params = {}) =>
            request(
              'GET',
              `${ent(enterpriseId)}/devices/${encodeURIComponent(deviceId)}/operations${q({ filter: params.filter, pageSize: params.page_size, pageToken: params.page_token, returnPartialSuccess: params.return_partial_success })}`,
            ),
          getDeviceOperation: (enterpriseId, deviceId, operationId) =>
            request('GET', `${ent(enterpriseId)}/devices/${encodeURIComponent(deviceId)}/operations/${encodeURIComponent(operationId)}`),
          cancelDeviceOperation: (enterpriseId, deviceId, operationId) =>
            request('POST', `${ent(enterpriseId)}/devices/${encodeURIComponent(deviceId)}/operations/${encodeURIComponent(operationId)}:cancel`),
          listPolicies: (enterpriseId, params = {}) =>
            request('GET', `${ent(enterpriseId)}/policies${q({ pageSize: params.page_size, pageToken: params.page_token })}`),
          getPolicy: (enterpriseId, policyId) =>
            request('GET', `${ent(enterpriseId)}/policies/${encodeURIComponent(policyId)}`),
          patchPolicy: (enterpriseId, policyId, body, params = {}) =>
            request('PATCH', `${ent(enterpriseId)}/policies/${encodeURIComponent(policyId)}${q({ updateMask: params.update_mask })}`, body),
          deletePolicy: (enterpriseId, policyId) =>
            request('DELETE', `${ent(enterpriseId)}/policies/${encodeURIComponent(policyId)}`),
          modifyPolicyApplications: (enterpriseId, policyId, body) =>
            request('POST', `${ent(enterpriseId)}/policies/${encodeURIComponent(policyId)}:modifyPolicyApplications`, body),
          removePolicyApplications: (enterpriseId, policyId, body) =>
            request('POST', `${ent(enterpriseId)}/policies/${encodeURIComponent(policyId)}:removePolicyApplications`, body),
          getApplication: (enterpriseId, packageName, params = {}) =>
            request(
              'GET',
              `${ent(enterpriseId)}/applications/${encodeURIComponent(packageName)}${q({ languageCode: params.language_code })}`,
            ),
          listWebApps: (enterpriseId, params = {}) =>
            request('GET', `${ent(enterpriseId)}/webApps${q({ pageSize: params.page_size, pageToken: params.page_token })}`),
          createWebApp: (enterpriseId, body) => request('POST', `${ent(enterpriseId)}/webApps`, body),
          getWebApp: (enterpriseId, webAppId) =>
            request('GET', `${ent(enterpriseId)}/webApps/${encodeURIComponent(webAppId)}`),
          patchWebApp: (enterpriseId, webAppId, body, params = {}) =>
            request('PATCH', `${ent(enterpriseId)}/webApps/${encodeURIComponent(webAppId)}${q({ updateMask: params.update_mask })}`, body),
          deleteWebApp: (enterpriseId, webAppId) =>
            request('DELETE', `${ent(enterpriseId)}/webApps/${encodeURIComponent(webAppId)}`),
          createMigrationToken: (enterpriseId, body) => request('POST', `${ent(enterpriseId)}/migrationTokens`, body),
          listMigrationTokens: (enterpriseId, params = {}) =>
            request('GET', `${ent(enterpriseId)}/migrationTokens${q({ pageSize: params.page_size, pageToken: params.page_token })}`),
          getMigrationToken: (enterpriseId, migrationTokenId) =>
            request('GET', `${ent(enterpriseId)}/migrationTokens/${encodeURIComponent(migrationTokenId)}`),
          getProvisioningInfo: (provisioningInfoId) =>
            request('GET', `${B}/provisioningInfo/${encodeURIComponent(provisioningInfoId)}`),
        };
      })(),
      googleChat: (() => {
        const B = `/api/integrations/google/chat/v1`;
        const q = (obj) => {
          const p = new URLSearchParams();
          Object.entries(obj || {}).forEach(([k, v]) => {
            if (v == null || v === '') return;
            if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
            else p.set(k, String(v));
          });
          const s = p.toString();
          return s ? `?${s}` : '';
        };
        const mediaPath = (resourceName) =>
          `${B}/media/${String(resourceName)
            .split('/')
            .map((s) => encodeURIComponent(s))
            .join('/')}`;
        return {
          downloadMedia: (resourceName, params = {}) =>
            requestBlob('GET', `${mediaPath(resourceName)}${q({ alt: params.alt ?? 'media', fields: params.fields })}`),
          uploadAttachment: async (spaceId, file, params = {}) => {
            const token = await getToken();
            const filename = params.filename || file.name || 'file';
            const form = new FormData();
            form.append('file', file);
            const qs = new URLSearchParams({ filename });
            const res = await fetch(
              `${baseUrl}${B}/spaces/${encodeURIComponent(spaceId)}/attachments:upload?${qs}`,
              {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: form,
                credentials: 'include',
              },
            );
            if (!res.ok) {
              const err = new Error(await res.text() || res.statusText);
              err.status = res.status;
              throw err;
            }
            return res.json();
          },
          listSpaces: (params = {}) =>
            request('GET', `${B}/spaces${q({ pageSize: params.page_size, pageToken: params.page_token, filter: params.filter })}`),
          searchSpaces: (params) =>
            request(
              'GET',
              `${B}/spaces:search${q({
                query: params.query,
                useAdminAccess: params.use_admin_access,
                pageSize: params.page_size,
                pageToken: params.page_token,
                orderBy: params.order_by,
              })}`,
            ),
          createSpace: (body, params = {}) => request('POST', `${B}/spaces${q({ requestId: params.request_id })}`, body),
          setupSpace: (body) => request('POST', `${B}/spaces:setup`, body),
          findDirectMessage: (params) =>
            request('GET', `${B}/spaces:findDirectMessage${q({ name: params.name })}`),
          getSpace: (spaceId, params = {}) =>
            request('GET', `${B}/spaces/${encodeURIComponent(spaceId)}${q({ useAdminAccess: params.use_admin_access })}`),
          patchSpace: (spaceId, body, params = {}) =>
            request(
              'PATCH',
              `${B}/spaces/${encodeURIComponent(spaceId)}${q({ updateMask: params.update_mask, useAdminAccess: params.use_admin_access })}`,
              body,
            ),
          deleteSpace: (spaceId, params = {}) =>
            request('DELETE', `${B}/spaces/${encodeURIComponent(spaceId)}${q({ useAdminAccess: params.use_admin_access })}`),
          completeImportSpace: (spaceId, body = {}) =>
            request('POST', `${B}/spaces/${encodeURIComponent(spaceId)}:completeImport`, body),
          createMessage: (spaceId, body, params = {}) =>
            request(
              'POST',
              `${B}/spaces/${encodeURIComponent(spaceId)}/messages${q({
                threadKey: params.thread_key,
                requestId: params.request_id,
                messageReplyOption: params.message_reply_option,
                messageId: params.message_id,
              })}`,
              body,
            ),
          listMessages: (spaceId, params = {}) =>
            request(
              'GET',
              `${B}/spaces/${encodeURIComponent(spaceId)}/messages${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
                filter: params.filter,
                orderBy: params.order_by,
                showDeleted: params.show_deleted,
              })}`,
            ),
          getMessage: (spaceId, messageId) =>
            request('GET', `${B}/spaces/${encodeURIComponent(spaceId)}/messages/${encodeURIComponent(messageId)}`),
          updateMessage: (spaceId, messageId, body, params = {}) =>
            request(
              'PUT',
              `${B}/spaces/${encodeURIComponent(spaceId)}/messages/${encodeURIComponent(messageId)}${q({
                updateMask: params.update_mask,
                allowMissing: params.allow_missing,
              })}`,
              body,
            ),
          patchMessage: (spaceId, messageId, body, params = {}) =>
            request(
              'PATCH',
              `${B}/spaces/${encodeURIComponent(spaceId)}/messages/${encodeURIComponent(messageId)}${q({
                updateMask: params.update_mask,
                allowMissing: params.allow_missing,
              })}`,
              body,
            ),
          deleteMessage: (spaceId, messageId, params = {}) =>
            request(
              'DELETE',
              `${B}/spaces/${encodeURIComponent(spaceId)}/messages/${encodeURIComponent(messageId)}${q({ force: params.force })}`,
            ),
          getMessageAttachment: (spaceId, messageId, attachmentId) =>
            request(
              'GET',
              `${B}/spaces/${encodeURIComponent(spaceId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
            ),
          createReaction: (spaceId, messageId, body) =>
            request('POST', `${B}/spaces/${encodeURIComponent(spaceId)}/messages/${encodeURIComponent(messageId)}/reactions`, body),
          listReactions: (spaceId, messageId, params = {}) =>
            request(
              'GET',
              `${B}/spaces/${encodeURIComponent(spaceId)}/messages/${encodeURIComponent(messageId)}/reactions${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
                filter: params.filter,
              })}`,
            ),
          deleteReaction: (spaceId, messageId, reactionId) =>
            request(
              'DELETE',
              `${B}/spaces/${encodeURIComponent(spaceId)}/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(reactionId)}`,
            ),
          listMembers: (spaceId, params = {}) =>
            request(
              'GET',
              `${B}/spaces/${encodeURIComponent(spaceId)}/members${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
                filter: params.filter,
                showGroups: params.show_groups,
                showInvited: params.show_invited,
                useAdminAccess: params.use_admin_access,
              })}`,
            ),
          getMember: (spaceId, memberId, params = {}) =>
            request(
              'GET',
              `${B}/spaces/${encodeURIComponent(spaceId)}/members/${memberId.split('/').map(encodeURIComponent).join('/')}${q({ useAdminAccess: params.use_admin_access })}`,
            ),
          createMember: (spaceId, body, params = {}) =>
            request(
              'POST',
              `${B}/spaces/${encodeURIComponent(spaceId)}/members${q({ useAdminAccess: params.use_admin_access })}`,
              body,
            ),
          patchMember: (spaceId, memberId, body, params = {}) =>
            request(
              'PATCH',
              `${B}/spaces/${encodeURIComponent(spaceId)}/members/${memberId.split('/').map(encodeURIComponent).join('/')}${q({
                updateMask: params.update_mask,
                useAdminAccess: params.use_admin_access,
              })}`,
              body,
            ),
          deleteMember: (spaceId, memberId, params = {}) =>
            request(
              'DELETE',
              `${B}/spaces/${encodeURIComponent(spaceId)}/members/${memberId.split('/').map(encodeURIComponent).join('/')}${q({
                useAdminAccess: params.use_admin_access,
              })}`,
            ),
          listSpaceEvents: (spaceId, params = {}) =>
            request(
              'GET',
              `${B}/spaces/${encodeURIComponent(spaceId)}/spaceEvents${q({
                filter: params.filter,
                pageSize: params.page_size,
                pageToken: params.page_token,
              })}`,
            ),
          getSpaceEvent: (spaceId, eventId) =>
            request('GET', `${B}/spaces/${encodeURIComponent(spaceId)}/spaceEvents/${encodeURIComponent(eventId)}`),
          createCustomEmoji: (body) => request('POST', `${B}/customEmojis`, body),
          listCustomEmojis: (params = {}) =>
            request(
              'GET',
              `${B}/customEmojis${q({ pageSize: params.page_size, pageToken: params.page_token, filter: params.filter })}`,
            ),
          getCustomEmoji: (emojiId) =>
            request('GET', `${B}/customEmojis/${String(emojiId).split('/').map(encodeURIComponent).join('/')}`),
          deleteCustomEmoji: (emojiId) =>
            request('DELETE', `${B}/customEmojis/${String(emojiId).split('/').map(encodeURIComponent).join('/')}`),
          getSpaceReadState: (userId, spaceId) =>
            request('GET', `${B}/users/${encodeURIComponent(userId)}/spaces/${encodeURIComponent(spaceId)}/spaceReadState`),
          updateSpaceReadState: (userId, spaceId, body, params = {}) =>
            request(
              'PATCH',
              `${B}/users/${encodeURIComponent(userId)}/spaces/${encodeURIComponent(spaceId)}/spaceReadState${q({ updateMask: params.update_mask })}`,
              body,
            ),
          getThreadReadState: (userId, spaceId, threadId) =>
            request(
              'GET',
              `${B}/users/${encodeURIComponent(userId)}/spaces/${encodeURIComponent(spaceId)}/threads/${encodeURIComponent(threadId)}/threadReadState`,
            ),
          getSpaceNotificationSetting: (userId, spaceId) =>
            request(
              'GET',
              `${B}/users/${encodeURIComponent(userId)}/spaces/${encodeURIComponent(spaceId)}/spaceNotificationSetting`,
            ),
          patchSpaceNotificationSetting: (userId, spaceId, body, params = {}) =>
            request(
              'PATCH',
              `${B}/users/${encodeURIComponent(userId)}/spaces/${encodeURIComponent(spaceId)}/spaceNotificationSetting${q({ updateMask: params.update_mask })}`,
              body,
            ),
        };
      })(),
      chromeWebstore: (() => {
        const B = `/api/integrations/google/chrome-webstore/v2`;
        const q = (obj) => {
          const p = new URLSearchParams();
          Object.entries(obj || {}).forEach(([k, v]) => {
            if (v == null || v === '') return;
            p.set(k, String(v));
          });
          const s = p.toString();
          return s ? `?${s}` : '';
        };
        const item = (publisherId, itemId) =>
          `${B}/publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(itemId)}`;
        return {
          publishItem: (publisherId, itemId, body = {}, params = {}) =>
            request('POST', `${item(publisherId, itemId)}:publish${q({ fields: params.fields })}`, body),
          fetchItemStatus: (publisherId, itemId, params = {}) =>
            request('GET', `${item(publisherId, itemId)}:fetchStatus${q({ fields: params.fields })}`),
          cancelSubmission: (publisherId, itemId, body = {}, params = {}) =>
            request('POST', `${item(publisherId, itemId)}:cancelSubmission${q({ fields: params.fields })}`, body),
          setPublishedDeployPercentage: (publisherId, itemId, body, params = {}) =>
            request(
              'POST',
              `${item(publisherId, itemId)}:setPublishedDeployPercentage${q({ fields: params.fields })}`,
              body,
            ),
          uploadPackage: async (publisherId, itemId, file) => {
            const token = await getToken();
            const form = new FormData();
            form.append('file', file);
            const res = await fetch(`${baseUrl}${item(publisherId, itemId)}:upload`, {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: form,
              credentials: 'include',
            });
            if (!res.ok) {
              const err = new Error(await res.text() || res.statusText);
              err.status = res.status;
              throw err;
            }
            return res.json();
          },
        };
      })(),
      ...(() => {
        const q = (obj) => {
          const p = new URLSearchParams();
          Object.entries(obj || {}).forEach(([k, v]) => {
            if (v == null || v === '') return;
            if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
            else p.set(k, String(v));
          });
          const s = p.toString();
          return s ? `?${s}` : '';
        };
        const makeDataFusion = (version) => {
          const B = `/api/integrations/google/data-fusion/${version}`;
          const pl = (projectId, locationId) =>
            `${B}/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}`;
          const inst = (projectId, locationId, instanceId) =>
            `${pl(projectId, locationId)}/instances/${encodeURIComponent(instanceId)}`;
          return {
            getLocation: (projectId, locationId) => request('GET', pl(projectId, locationId)),
            listLocations: (projectId, params = {}) =>
              request(
                'GET',
                `${B}/projects/${encodeURIComponent(projectId)}/locations${q({
                  filter: params.filter,
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                  extraLocationTypes: params.extra_location_types,
                })}`,
              ),
            getOperation: (projectId, locationId, operationId) =>
              request('GET', `${pl(projectId, locationId)}/operations/${encodeURIComponent(operationId)}`),
            deleteOperation: (projectId, locationId, operationId) =>
              request('DELETE', `${pl(projectId, locationId)}/operations/${encodeURIComponent(operationId)}`),
            listOperations: (projectId, locationId, params = {}) =>
              request(
                'GET',
                `${pl(projectId, locationId)}/operations${q({
                  filter: params.filter,
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                  returnPartialSuccess: params.return_partial_success,
                })}`,
              ),
            cancelOperation: (projectId, locationId, operationId, body = {}) =>
              request('POST', `${pl(projectId, locationId)}/operations/${encodeURIComponent(operationId)}:cancel`, body),
            listInstances: (projectId, locationId, params = {}) =>
              request(
                'GET',
                `${pl(projectId, locationId)}/instances${q({
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                  orderBy: params.order_by,
                  filter: params.filter,
                })}`,
              ),
            createInstance: (projectId, locationId, instanceId, body) =>
              request('POST', `${pl(projectId, locationId)}/instances${q({ instanceId: instanceId })}`, body),
            getInstance: (projectId, locationId, instanceId) => request('GET', inst(projectId, locationId, instanceId)),
            patchInstance: (projectId, locationId, instanceId, body, params = {}) =>
              request('PATCH', `${inst(projectId, locationId, instanceId)}${q({ updateMask: params.update_mask })}`, body),
            deleteInstance: (projectId, locationId, instanceId, params = {}) =>
              request('DELETE', `${inst(projectId, locationId, instanceId)}${q({ force: params.force })}`),
            restartInstance: (projectId, locationId, instanceId, body = {}) =>
              request('POST', `${inst(projectId, locationId, instanceId)}:restart`, body),
            getInstanceIamPolicy: (projectId, locationId, instanceId, params = {}) => {
              const psp = new URLSearchParams();
              if (params.options_requested_policy_version != null && params.options_requested_policy_version !== '') {
                psp.set('options.requestedPolicyVersion', String(params.options_requested_policy_version));
              }
              const s = psp.toString();
              return request('GET', `${inst(projectId, locationId, instanceId)}:getIamPolicy${s ? `?${s}` : ''}`);
            },
            setInstanceIamPolicy: (projectId, locationId, instanceId, body) =>
              request('POST', `${inst(projectId, locationId, instanceId)}:setIamPolicy`, body),
            testInstanceIamPermissions: (projectId, locationId, instanceId, body) =>
              request('POST', `${inst(projectId, locationId, instanceId)}:testIamPermissions`, body),
            createDnsPeering: (projectId, locationId, instanceId, dnsPeeringId, body) =>
              request(
                'POST',
                `${inst(projectId, locationId, instanceId)}/dnsPeerings${q({ dnsPeeringId: dnsPeeringId })}`,
                body,
              ),
            listDnsPeerings: (projectId, locationId, instanceId, params = {}) =>
              request(
                'GET',
                `${inst(projectId, locationId, instanceId)}/dnsPeerings${q({
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                })}`,
              ),
            deleteDnsPeering: (projectId, locationId, instanceId, dnsPeeringId) =>
              request(
                'DELETE',
                `${inst(projectId, locationId, instanceId)}/dnsPeerings/${encodeURIComponent(dnsPeeringId)}`,
              ),
            listVersions: (projectId, locationId, params = {}) =>
              request(
                'GET',
                `${pl(projectId, locationId)}/versions${q({
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                  latestPatchOnly: params.latest_patch_only,
                })}`,
              ),
          };
        };
        const Bb = `/api/integrations/google/data-fusion/v1beta1`;
        const plb = (projectId, locationId) =>
          `${Bb}/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}`;
        const instb = (projectId, locationId, instanceId) =>
          `${plb(projectId, locationId)}/instances/${encodeURIComponent(instanceId)}`;
        const encResourceTail = (resourcePath) =>
          String(resourcePath || '')
            .replace(/^\/+/, '')
            .split('/')
            .filter(Boolean)
            .map(encodeURIComponent)
            .join('/');
        return {
          dataFusion: makeDataFusion('v1'),
          dataFusionV1beta1: {
            ...makeDataFusion('v1beta1'),
            upgradeInstance: (projectId, locationId, instanceId, body = {}) =>
              request('POST', `${instb(projectId, locationId, instanceId)}:upgrade`, body),
            removeIamPolicy: (projectId, locationId, resourcePath, body = {}) =>
              request(
                'POST',
                `${Bb}/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}/${encResourceTail(resourcePath)}:removeIamPolicy`,
                body,
              ),
            listNamespaces: (projectId, locationId, instanceId, params = {}) =>
              request(
                'GET',
                `${instb(projectId, locationId, instanceId)}/namespaces${q({
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                  view: params.view,
                })}`,
              ),
            getNamespaceIamPolicy: (projectId, locationId, instanceId, namespaceId, params = {}) => {
              const psp = new URLSearchParams();
              if (params.options_requested_policy_version != null && params.options_requested_policy_version !== '') {
                psp.set('options.requestedPolicyVersion', String(params.options_requested_policy_version));
              }
              const s = psp.toString();
              const n = `${instb(projectId, locationId, instanceId)}/namespaces/${encodeURIComponent(namespaceId)}`;
              return request('GET', `${n}:getIamPolicy${s ? `?${s}` : ''}`);
            },
            setNamespaceIamPolicy: (projectId, locationId, instanceId, namespaceId, body) =>
              request(
                'POST',
                `${instb(projectId, locationId, instanceId)}/namespaces/${encodeURIComponent(namespaceId)}:setIamPolicy`,
                body,
              ),
            testNamespaceIamPermissions: (projectId, locationId, instanceId, namespaceId, body) =>
              request(
                'POST',
                `${instb(projectId, locationId, instanceId)}/namespaces/${encodeURIComponent(namespaceId)}:testIamPermissions`,
                body,
              ),
          },
        };
      })(),
      ...(() => {
        const q = (obj) => {
          const p = new URLSearchParams();
          Object.entries(obj || {}).forEach(([k, v]) => {
            if (v == null || v === '') return;
            if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
            else p.set(k, String(v));
          });
          const s = p.toString();
          return s ? `?${s}` : '';
        };
        const makeFilestore = (version) => {
          const B = `/api/integrations/google/filestore/${version}`;
          const pl = (projectId, locationId) =>
            `${B}/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}`;
          const inst = (projectId, locationId, instanceId) =>
            `${pl(projectId, locationId)}/instances/${encodeURIComponent(instanceId)}`;
          const snap = (projectId, locationId, instanceId, snapshotId) =>
            `${inst(projectId, locationId, instanceId)}/snapshots/${encodeURIComponent(snapshotId)}`;
          const bak = (projectId, locationId, backupId) =>
            `${pl(projectId, locationId)}/backups/${encodeURIComponent(backupId)}`;
          return {
            getLocation: (projectId, locationId) => request('GET', pl(projectId, locationId)),
            listLocations: (projectId, params = {}) =>
              request(
                'GET',
                `${B}/projects/${encodeURIComponent(projectId)}/locations${q({
                  filter: params.filter,
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                  extraLocationTypes: params.extra_location_types,
                })}`,
              ),
            getOperation: (projectId, locationId, operationId) =>
              request('GET', `${pl(projectId, locationId)}/operations/${encodeURIComponent(operationId)}`),
            deleteOperation: (projectId, locationId, operationId) =>
              request('DELETE', `${pl(projectId, locationId)}/operations/${encodeURIComponent(operationId)}`),
            listOperations: (projectId, locationId, params = {}) =>
              request(
                'GET',
                `${pl(projectId, locationId)}/operations${q({
                  filter: params.filter,
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                  returnPartialSuccess: params.return_partial_success,
                })}`,
              ),
            cancelOperation: (projectId, locationId, operationId, body = {}) =>
              request('POST', `${pl(projectId, locationId)}/operations/${encodeURIComponent(operationId)}:cancel`, body),
            listInstances: (projectId, locationId, params = {}) =>
              request(
                'GET',
                `${pl(projectId, locationId)}/instances${q({
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                  orderBy: params.order_by,
                  filter: params.filter,
                })}`,
              ),
            createInstance: (projectId, locationId, instanceId, body) =>
              request('POST', `${pl(projectId, locationId)}/instances${q({ instanceId: instanceId })}`, body),
            getInstance: (projectId, locationId, instanceId) => request('GET', inst(projectId, locationId, instanceId)),
            patchInstance: (projectId, locationId, instanceId, body, params = {}) =>
              request('PATCH', `${inst(projectId, locationId, instanceId)}${q({ updateMask: params.update_mask })}`, body),
            deleteInstance: (projectId, locationId, instanceId, params = {}) =>
              request('DELETE', `${inst(projectId, locationId, instanceId)}${q({ force: params.force })}`),
            restoreInstance: (projectId, locationId, instanceId, body) =>
              request('POST', `${inst(projectId, locationId, instanceId)}:restore`, body),
            revertInstance: (projectId, locationId, instanceId, body) =>
              request('POST', `${inst(projectId, locationId, instanceId)}:revert`, body),
            promoteReplica: (projectId, locationId, instanceId, body = {}) =>
              request('POST', `${inst(projectId, locationId, instanceId)}:promoteReplica`, body),
            pauseReplica: (projectId, locationId, instanceId, body = {}) =>
              request('POST', `${inst(projectId, locationId, instanceId)}:pauseReplica`, body),
            resumeReplica: (projectId, locationId, instanceId, body = {}) =>
              request('POST', `${inst(projectId, locationId, instanceId)}:resumeReplica`, body),
            listSnapshots: (projectId, locationId, instanceId, params = {}) =>
              request(
                'GET',
                `${inst(projectId, locationId, instanceId)}/snapshots${q({
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                  orderBy: params.order_by,
                  filter: params.filter,
                  returnPartialSuccess: params.return_partial_success,
                })}`,
              ),
            getSnapshot: (projectId, locationId, instanceId, snapshotId) =>
              request('GET', snap(projectId, locationId, instanceId, snapshotId)),
            createSnapshot: (projectId, locationId, instanceId, snapshotId, body) =>
              request(
                'POST',
                `${inst(projectId, locationId, instanceId)}/snapshots${q({ snapshotId: snapshotId })}`,
                body,
              ),
            deleteSnapshot: (projectId, locationId, instanceId, snapshotId) =>
              request('DELETE', snap(projectId, locationId, instanceId, snapshotId)),
            patchSnapshot: (projectId, locationId, instanceId, snapshotId, body, params = {}) =>
              request(
                'PATCH',
                `${snap(projectId, locationId, instanceId, snapshotId)}${q({ updateMask: params.update_mask })}`,
                body,
              ),
            listBackups: (projectId, locationId, params = {}) =>
              request(
                'GET',
                `${pl(projectId, locationId)}/backups${q({
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                  orderBy: params.order_by,
                  filter: params.filter,
                })}`,
              ),
            getBackup: (projectId, locationId, backupId) => request('GET', bak(projectId, locationId, backupId)),
            createBackup: (projectId, locationId, backupId, body) =>
              request('POST', `${pl(projectId, locationId)}/backups${q({ backupId: backupId })}`, body),
            deleteBackup: (projectId, locationId, backupId) => request('DELETE', bak(projectId, locationId, backupId)),
            patchBackup: (projectId, locationId, backupId, body, params = {}) =>
              request('PATCH', `${bak(projectId, locationId, backupId)}${q({ updateMask: params.update_mask })}`, body),
          };
        };
        const Bb = `/api/integrations/google/filestore/v1beta1`;
        const plb = (projectId, locationId) =>
          `${Bb}/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}`;
        const instb = (projectId, locationId, instanceId) =>
          `${plb(projectId, locationId)}/instances/${encodeURIComponent(instanceId)}`;
        const shrb = (projectId, locationId, instanceId, shareId) =>
          `${instb(projectId, locationId, instanceId)}/shares/${encodeURIComponent(shareId)}`;
        return {
          filestore: makeFilestore('v1'),
          filestoreV1beta1: {
            ...makeFilestore('v1beta1'),
            listShares: (projectId, locationId, instanceId, params = {}) =>
              request(
                'GET',
                `${instb(projectId, locationId, instanceId)}/shares${q({
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                  orderBy: params.order_by,
                  filter: params.filter,
                })}`,
              ),
            getShare: (projectId, locationId, instanceId, shareId) =>
              request('GET', shrb(projectId, locationId, instanceId, shareId)),
            createShare: (projectId, locationId, instanceId, shareId, body) =>
              request('POST', `${instb(projectId, locationId, instanceId)}/shares${q({ shareId: shareId })}`, body),
            deleteShare: (projectId, locationId, instanceId, shareId) =>
              request('DELETE', shrb(projectId, locationId, instanceId, shareId)),
            patchShare: (projectId, locationId, instanceId, shareId, body, params = {}) =>
              request(
                'PATCH',
                `${shrb(projectId, locationId, instanceId, shareId)}${q({ updateMask: params.update_mask })}`,
                body,
              ),
          },
        };
      })(),
      ...(() => {
        const makeOsLogin = (version) => {
          const B = `/api/integrations/google/oslogin/${version}`;
          const q = (obj) => {
            const p = new URLSearchParams();
            Object.entries(obj || {}).forEach(([k, v]) => {
              if (v == null || v === '') return;
              if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
              else p.set(k, String(v));
            });
            const s = p.toString();
            return s ? `?${s}` : '';
          };
          const userPath = (userId) => `${B}/users/${encodeURIComponent(userId)}`;
          const base = {
            signSshPublicKey: (projectId, locationId, body) =>
              request(
                'POST',
                `${B}/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}:signSshPublicKey`,
                body,
              ),
            getLoginProfile: (userId, params = {}) => {
              const query = {
                projectId: params.project_id,
                systemId: params.system_id,
              };
              if (version === 'v1beta' && params.view != null && params.view !== '')
                query.view = params.view;
              return request('GET', `${userPath(userId)}/loginProfile${q(query)}`);
            },
            importSshPublicKey: (userId, body, params = {}) => {
              const query = {
                projectId: params.project_id,
                regions: params.regions,
              };
              if (version === 'v1beta' && params.view != null && params.view !== '')
                query.view = params.view;
              return request('POST', `${userPath(userId)}:importSshPublicKey${q(query)}`, body);
            },
            createSshPublicKey: (userId, body) => request('POST', `${userPath(userId)}/sshPublicKeys`, body),
            getSshPublicKey: (userId, fingerprint) =>
              request('GET', `${userPath(userId)}/sshPublicKeys/${encodeURIComponent(fingerprint)}`),
            patchSshPublicKey: (userId, fingerprint, body, params = {}) =>
              request(
                'PATCH',
                `${userPath(userId)}/sshPublicKeys/${encodeURIComponent(fingerprint)}${q({ updateMask: params.update_mask })}`,
                body,
              ),
            deleteSshPublicKey: (userId, fingerprint) =>
              request('DELETE', `${userPath(userId)}/sshPublicKeys/${encodeURIComponent(fingerprint)}`),
            provisionPosixAccount: (userId, projectRef, body = {}) =>
              request('POST', `${userPath(userId)}/projects/${encodeURIComponent(projectRef)}`, body),
            deletePosixAccount: (userId, projectRef) =>
              request('DELETE', `${userPath(userId)}/projects/${encodeURIComponent(projectRef)}`),
          };
          if (version === 'v1beta') {
            return {
              ...base,
              signSshPublicKeyUserProjectZone: (userId, projectRef, zoneId, body) =>
                request(
                  'POST',
                  `${userPath(userId)}/projects/${encodeURIComponent(projectRef)}/zones/${encodeURIComponent(zoneId)}:signSshPublicKey`,
                  body,
                ),
              signSshPublicKeyUserProjectLocation: (userId, projectRef, locationId, body) =>
                request(
                  'POST',
                  `${userPath(userId)}/projects/${encodeURIComponent(projectRef)}/locations/${encodeURIComponent(locationId)}:signSshPublicKey`,
                  body,
                ),
            };
          }
          return base;
        };
        return {
          osLogin: makeOsLogin('v1'),
          osLoginV1beta: makeOsLogin('v1beta'),
        };
      })(),
      /** Cloud Translation API v3 — https://cloud.google.com/translate/docs/ */
      translate: (() => {
        const B = `/api/integrations/google/translate/v3`;
        const q = (obj) => {
          const p = new URLSearchParams();
          Object.entries(obj || {}).forEach(([k, v]) => {
            if (v == null || v === '') return;
            if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
            else p.set(k, String(v));
          });
          const s = p.toString();
          return s ? `?${s}` : '';
        };
        const p = (projectId) => `${B}/projects/${encodeURIComponent(projectId)}`;
        const pl = (projectId, locationId) => `${p(projectId)}/locations/${encodeURIComponent(locationId)}`;
        const pmdl = (projectId, locationId, modelId) => `${pl(projectId, locationId)}/models/${encodeURIComponent(modelId)}`;
        const pop = (projectId, locationId, operationId) =>
          `${pl(projectId, locationId)}/operations/${encodeURIComponent(operationId)}`;
        const pds = (projectId, locationId, datasetId) =>
          `${pl(projectId, locationId)}/datasets/${encodeURIComponent(datasetId)}`;
        const pgl = (projectId, locationId, glossaryId) =>
          `${pl(projectId, locationId)}/glossaries/${encodeURIComponent(glossaryId)}`;
        const pad = (projectId, locationId, datasetId) =>
          `${pl(projectId, locationId)}/adaptiveMtDatasets/${encodeURIComponent(datasetId)}`;
        const paf = (projectId, locationId, datasetId, fileId) =>
          `${pad(projectId, locationId, datasetId)}/adaptiveMtFiles/${encodeURIComponent(fileId)}`;
        return {
          projectsRomanizeText: (projectId, body) => request('POST', `${p(projectId)}:romanizeText`, body),
          projectsGetSupportedLanguages: (projectId, params = {}) =>
            request(
              'GET',
              `${p(projectId)}/supportedLanguages${q({
                model: params.model,
                displayLanguageCode: params.display_language_code,
              })}`,
            ),
          projectsTranslateText: (projectId, body) => request('POST', `${p(projectId)}:translateText`, body),
          projectsDetectLanguage: (projectId, body) => request('POST', `${p(projectId)}:detectLanguage`, body),
          listLocations: (projectId, params = {}) =>
            request(
              'GET',
              `${p(projectId)}/locations${q({
                filter: params.filter,
                pageSize: params.page_size,
                pageToken: params.page_token,
                extraLocationTypes: params.extra_location_types,
              })}`,
            ),
          getLocation: (projectId, locationId) => request('GET', pl(projectId, locationId)),
          batchTranslateText: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:batchTranslateText`, body),
          adaptiveMtTranslate: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:adaptiveMtTranslate`, body),
          locationsRomanizeText: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:romanizeText`, body),
          locationsGetSupportedLanguages: (projectId, locationId, params = {}) =>
            request(
              'GET',
              `${pl(projectId, locationId)}/supportedLanguages${q({
                model: params.model,
                displayLanguageCode: params.display_language_code,
              })}`,
            ),
          batchTranslateDocument: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:batchTranslateDocument`, body),
          locationsTranslateText: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:translateText`, body),
          translateDocument: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:translateDocument`, body),
          refineText: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:refineText`, body),
          locationsDetectLanguage: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:detectLanguage`, body),
          getModel: (projectId, locationId, modelId) => request('GET', pmdl(projectId, locationId, modelId)),
          deleteModel: (projectId, locationId, modelId) => request('DELETE', pmdl(projectId, locationId, modelId)),
          listModels: (projectId, locationId, params = {}) =>
            request(
              'GET',
              `${pl(projectId, locationId)}/models${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
                filter: params.filter,
              })}`,
            ),
          createModel: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}/models`, body),
          listOperations: (projectId, locationId, params = {}) =>
            request(
              'GET',
              `${pl(projectId, locationId)}/operations${q({
                filter: params.filter,
                pageSize: params.page_size,
                pageToken: params.page_token,
                returnPartialSuccess: params.return_partial_success,
              })}`,
            ),
          getOperation: (projectId, locationId, operationId) =>
            request('GET', pop(projectId, locationId, operationId)),
          deleteOperation: (projectId, locationId, operationId) =>
            request('DELETE', pop(projectId, locationId, operationId)),
          cancelOperation: (projectId, locationId, operationId, body = {}) =>
            request('POST', `${pop(projectId, locationId, operationId)}:cancel`, body),
          waitOperation: (projectId, locationId, operationId, body = {}) =>
            request('POST', `${pop(projectId, locationId, operationId)}:wait`, body),
          importDatasetData: (projectId, locationId, datasetId, body) =>
            request('POST', `${pds(projectId, locationId, datasetId)}:importData`, body),
          createDataset: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}/datasets`, body),
          listDatasets: (projectId, locationId, params = {}) =>
            request(
              'GET',
              `${pl(projectId, locationId)}/datasets${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
              })}`,
            ),
          getDataset: (projectId, locationId, datasetId) => request('GET', pds(projectId, locationId, datasetId)),
          exportDatasetData: (projectId, locationId, datasetId, body) =>
            request('POST', `${pds(projectId, locationId, datasetId)}:exportData`, body),
          deleteDataset: (projectId, locationId, datasetId) =>
            request('DELETE', pds(projectId, locationId, datasetId)),
          listDatasetExamples: (projectId, locationId, datasetId, params = {}) =>
            request(
              'GET',
              `${pds(projectId, locationId, datasetId)}/examples${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
                filter: params.filter,
              })}`,
            ),
          patchGlossary: (projectId, locationId, glossaryId, body, params = {}) =>
            request(
              'PATCH',
              `${pgl(projectId, locationId, glossaryId)}${q({ updateMask: params.update_mask })}`,
              body,
            ),
          getGlossary: (projectId, locationId, glossaryId) =>
            request('GET', pgl(projectId, locationId, glossaryId)),
          deleteGlossary: (projectId, locationId, glossaryId) =>
            request('DELETE', pgl(projectId, locationId, glossaryId)),
          createGlossary: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}/glossaries`, body),
          listGlossaries: (projectId, locationId, params = {}) =>
            request(
              'GET',
              `${pl(projectId, locationId)}/glossaries${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
                filter: params.filter,
              })}`,
            ),
          deleteGlossaryEntry: (projectId, locationId, glossaryId, entryId) =>
            request(
              'DELETE',
              `${pgl(projectId, locationId, glossaryId)}/glossaryEntries/${encodeURIComponent(entryId)}`,
            ),
          getGlossaryEntry: (projectId, locationId, glossaryId, entryId) =>
            request('GET', `${pgl(projectId, locationId, glossaryId)}/glossaryEntries/${encodeURIComponent(entryId)}`),
          patchGlossaryEntry: (projectId, locationId, glossaryId, entryId, body) =>
            request(
              'PATCH',
              `${pgl(projectId, locationId, glossaryId)}/glossaryEntries/${encodeURIComponent(entryId)}`,
              body,
            ),
          listGlossaryEntries: (projectId, locationId, glossaryId, params = {}) =>
            request(
              'GET',
              `${pgl(projectId, locationId, glossaryId)}/glossaryEntries${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
              })}`,
            ),
          createGlossaryEntry: (projectId, locationId, glossaryId, body) =>
            request('POST', `${pgl(projectId, locationId, glossaryId)}/glossaryEntries`, body),
          deleteAdaptiveMtDataset: (projectId, locationId, datasetId) =>
            request('DELETE', pad(projectId, locationId, datasetId)),
          getAdaptiveMtDataset: (projectId, locationId, datasetId) =>
            request('GET', pad(projectId, locationId, datasetId)),
          createAdaptiveMtDataset: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}/adaptiveMtDatasets`, body),
          listAdaptiveMtDatasets: (projectId, locationId, params = {}) =>
            request(
              'GET',
              `${pl(projectId, locationId)}/adaptiveMtDatasets${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
                filter: params.filter,
              })}`,
            ),
          importAdaptiveMtFile: (projectId, locationId, datasetId, body) =>
            request('POST', `${pad(projectId, locationId, datasetId)}:importAdaptiveMtFile`, body),
          listAdaptiveMtSentencesForDataset: (projectId, locationId, datasetId, params = {}) =>
            request(
              'GET',
              `${pad(projectId, locationId, datasetId)}/adaptiveMtSentences${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
              })}`,
            ),
          deleteAdaptiveMtFile: (projectId, locationId, datasetId, fileId) =>
            request('DELETE', paf(projectId, locationId, datasetId, fileId)),
          getAdaptiveMtFile: (projectId, locationId, datasetId, fileId) =>
            request('GET', paf(projectId, locationId, datasetId, fileId)),
          listAdaptiveMtFiles: (projectId, locationId, datasetId, params = {}) =>
            request(
              'GET',
              `${pad(projectId, locationId, datasetId)}/adaptiveMtFiles${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
              })}`,
            ),
          listAdaptiveMtSentencesForFile: (projectId, locationId, datasetId, fileId, params = {}) =>
            request(
              'GET',
              `${paf(projectId, locationId, datasetId, fileId)}/adaptiveMtSentences${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
              })}`,
            ),
        };
      })(),
      /** Cloud Translation API v3beta1 (subset of v3 — no romanize, models, datasets, glossary patch/entries, adaptive MT) */
      translateV3beta1: (() => {
        const B = `/api/integrations/google/translate/v3beta1`;
        const q = (obj) => {
          const p = new URLSearchParams();
          Object.entries(obj || {}).forEach(([k, v]) => {
            if (v == null || v === '') return;
            if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
            else p.set(k, String(v));
          });
          const s = p.toString();
          return s ? `?${s}` : '';
        };
        const p = (projectId) => `${B}/projects/${encodeURIComponent(projectId)}`;
        const pl = (projectId, locationId) => `${p(projectId)}/locations/${encodeURIComponent(locationId)}`;
        const pop = (projectId, locationId, operationId) =>
          `${pl(projectId, locationId)}/operations/${encodeURIComponent(operationId)}`;
        const pgl = (projectId, locationId, glossaryId) =>
          `${pl(projectId, locationId)}/glossaries/${encodeURIComponent(glossaryId)}`;
        return {
          projectsGetSupportedLanguages: (projectId, params = {}) =>
            request(
              'GET',
              `${p(projectId)}/supportedLanguages${q({
                model: params.model,
                displayLanguageCode: params.display_language_code,
              })}`,
            ),
          projectsTranslateText: (projectId, body) => request('POST', `${p(projectId)}:translateText`, body),
          projectsDetectLanguage: (projectId, body) => request('POST', `${p(projectId)}:detectLanguage`, body),
          listLocations: (projectId, params = {}) =>
            request(
              'GET',
              `${p(projectId)}/locations${q({
                filter: params.filter,
                pageSize: params.page_size,
                pageToken: params.page_token,
                extraLocationTypes: params.extra_location_types,
              })}`,
            ),
          getLocation: (projectId, locationId) => request('GET', pl(projectId, locationId)),
          batchTranslateText: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:batchTranslateText`, body),
          locationsGetSupportedLanguages: (projectId, locationId, params = {}) =>
            request(
              'GET',
              `${pl(projectId, locationId)}/supportedLanguages${q({
                model: params.model,
                displayLanguageCode: params.display_language_code,
              })}`,
            ),
          batchTranslateDocument: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:batchTranslateDocument`, body),
          locationsTranslateText: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:translateText`, body),
          translateDocument: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:translateDocument`, body),
          refineText: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:refineText`, body),
          locationsDetectLanguage: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}:detectLanguage`, body),
          listOperations: (projectId, locationId, params = {}) =>
            request(
              'GET',
              `${pl(projectId, locationId)}/operations${q({
                filter: params.filter,
                pageSize: params.page_size,
                pageToken: params.page_token,
                returnPartialSuccess: params.return_partial_success,
              })}`,
            ),
          getOperation: (projectId, locationId, operationId) =>
            request('GET', pop(projectId, locationId, operationId)),
          deleteOperation: (projectId, locationId, operationId) =>
            request('DELETE', pop(projectId, locationId, operationId)),
          cancelOperation: (projectId, locationId, operationId, body = {}) =>
            request('POST', `${pop(projectId, locationId, operationId)}:cancel`, body),
          waitOperation: (projectId, locationId, operationId, body = {}) =>
            request('POST', `${pop(projectId, locationId, operationId)}:wait`, body),
          getGlossary: (projectId, locationId, glossaryId) =>
            request('GET', pgl(projectId, locationId, glossaryId)),
          deleteGlossary: (projectId, locationId, glossaryId) =>
            request('DELETE', pgl(projectId, locationId, glossaryId)),
          createGlossary: (projectId, locationId, body) =>
            request('POST', `${pl(projectId, locationId)}/glossaries`, body),
          listGlossaries: (projectId, locationId, params = {}) =>
            request(
              'GET',
              `${pl(projectId, locationId)}/glossaries${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
                filter: params.filter,
              })}`,
            ),
        };
      })(),
      /**
       * Google Drive API v3 passthrough — https://developers.google.com/workspace/drive/
       * `path` without leading slash, e.g. `files`, `files/abc123`, `about?fields=...` use query option instead.
       * Options: { query, jsonBody, body, headers, rawResponse }.
       */
      drive: (() => {
        const J = `/api/integrations/google/drive/v3`;
        const U = `/api/integrations/google/drive/upload/v3`;
        const R = `/api/integrations/google/drive/resumable/v3`;
        const norm = (p) => String(p || '').replace(/^\/+/, '');
        return {
          v3: (method, path, opts) => requestDriveProxy(method, `${J}/${norm(path)}`, opts),
          upload: (method, path, opts) => requestDriveProxy(method, `${U}/${norm(path)}`, opts),
          resumable: (method, path, opts) => requestDriveProxy(method, `${R}/${norm(path)}`, opts),
          v3Raw: (method, path, opts) =>
            requestDriveProxy(method, `${J}/${norm(path)}`, { ...opts, rawResponse: true }),
          uploadRaw: (method, path, opts) =>
            requestDriveProxy(method, `${U}/${norm(path)}`, { ...opts, rawResponse: true }),
          resumableRaw: (method, path, opts) =>
            requestDriveProxy(method, `${R}/${norm(path)}`, { ...opts, rawResponse: true }),
        };
      })(),
      /**
       * Google Policy Analyzer API v1 — cloud-platform scope.
       * `scope`: "projects" | "organizations" | "folders"
       */
      policyAnalyzer: (() => {
        const B = `/api/integrations/google/policyanalyzer/v1`;
        const q = (obj) => {
          const p = new URLSearchParams();
          Object.entries(obj || {}).forEach(([k, v]) => {
            if (v == null || v === '') return;
            if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
            else p.set(k, String(v));
          });
          const s = p.toString();
          return s ? `?${s}` : '';
        };
        return {
          activitiesQuery: (scope, resourceId, locationId, activityTypeId, params = {}) =>
            request(
              'GET',
              `${B}/${scope}/${encodeURIComponent(resourceId)}/locations/${encodeURIComponent(locationId)}/activityTypes/${encodeURIComponent(activityTypeId)}/activities:query${q({
                filter: params.filter,
                pageSize: params.page_size,
                pageToken: params.page_token,
              })}`,
            ),
        };
      })(),
      /**
       * Google Policy Simulator API — v1 and v1beta IAM replay / org policy preview passthrough.
       * `path` without leading slash, e.g. `projects/foo/locations/global/replays`.
       * Options: { query, jsonBody, body, headers, rawResponse } (same as drive proxy).
       */
      policySimulator: (() => {
        const V1 = `/api/integrations/google/policysimulator/v1`;
        const V1B = `/api/integrations/google/policysimulator/v1beta`;
        const norm = (p) => String(p || '').replace(/^\/+/, '');
        return {
          v1: (method, path, opts) => requestDriveProxy(method, `${V1}/${norm(path)}`, opts),
          v1Raw: (method, path, opts) =>
            requestDriveProxy(method, `${V1}/${norm(path)}`, { ...opts, rawResponse: true }),
          v1beta: (method, path, opts) => requestDriveProxy(method, `${V1B}/${norm(path)}`, opts),
          v1betaRaw: (method, path, opts) =>
            requestDriveProxy(method, `${V1B}/${norm(path)}`, { ...opts, rawResponse: true }),
        };
      })(),
      /**
       * Google DoubleClick Search API v2 (Search Ads 360) — passthrough.
       * `path` without leading slash, e.g. `agency/{id}/advertiser/{id}/idmapping`.
       * Options: { query, jsonBody, body, headers, rawResponse } (same as drive proxy).
       */
      doubleclickSearch: (() => {
        const V2 = `/api/integrations/google/doubleclicksearch/v2`;
        const norm = (p) => String(p || '').replace(/^\/+/, '');
        return {
          v2: (method, path, opts) => requestDriveProxy(method, `${V2}/${norm(path)}`, opts),
          v2Raw: (method, path, opts) =>
            requestDriveProxy(method, `${V2}/${norm(path)}`, { ...opts, rawResponse: true }),
        };
      })(),
      /**
       * Google SaaS Runtime API — v1 and v1beta1 (saasservicemgmt) — https://cloud.google.com/saas-runtime/docs
       * `path` without leading slash, e.g. `projects/p/locations/us-central1/units`.
       * Options: { query, jsonBody, body, headers, rawResponse } (same as drive proxy).
       */
      saasRuntime: (() => {
        const V1 = `/api/integrations/google/saasservicemgmt/v1`;
        const V1B1 = `/api/integrations/google/saasservicemgmt/v1beta1`;
        const norm = (p) => String(p || '').replace(/^\/+/, '');
        return {
          v1: (method, path, opts) => requestDriveProxy(method, `${V1}/${norm(path)}`, opts),
          v1Raw: (method, path, opts) =>
            requestDriveProxy(method, `${V1}/${norm(path)}`, { ...opts, rawResponse: true }),
          v1beta1: (method, path, opts) => requestDriveProxy(method, `${V1B1}/${norm(path)}`, opts),
          v1beta1Raw: (method, path, opts) =>
            requestDriveProxy(method, `${V1B1}/${norm(path)}`, { ...opts, rawResponse: true }),
        };
      })(),
      /**
       * Google Service Networking API v1 — VPC peering / private connections / DNS (servicenetworking.googleapis.com).
       * `path` without leading slash, e.g. `services/servicenetworking.googleapis.com/connections`.
       * Options: { query, jsonBody, body, headers, rawResponse } (same as drive proxy).
       */
      serviceNetworking: (() => {
        const V1 = `/api/integrations/google/servicenetworking/v1`;
        const norm = (p) => String(p || '').replace(/^\/+/, '');
        return {
          v1: (method, path, opts) => requestDriveProxy(method, `${V1}/${norm(path)}`, opts),
          v1Raw: (method, path, opts) =>
            requestDriveProxy(method, `${V1}/${norm(path)}`, { ...opts, rawResponse: true }),
        };
      })(),
      /**
       * Google Data Manager API v1 — https://developers.google.com/data-manager
       * Optional `opts`: { loginAccount, linkedAccount } → forwarded as `login-account` / `linked-account` headers.
       */
      dataManager: (() => {
        const B = `/api/integrations/google/datamanager/v1`;
        const q = (obj) => {
          const p = new URLSearchParams();
          Object.entries(obj || {}).forEach(([k, v]) => {
            if (v == null || v === '') return;
            if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
            else p.set(k, String(v));
          });
          const s = p.toString();
          return s ? `?${s}` : '';
        };
        const acc = (accountType, accountId) =>
          `${B}/accountTypes/${encodeURIComponent(accountType)}/accounts/${encodeURIComponent(accountId)}`;
        const hdr = (opts) => {
          if (!opts) return undefined;
          const h = {};
          if (opts.loginAccount != null) h['login-account'] = String(opts.loginAccount);
          if (opts.linkedAccount != null) h['linked-account'] = String(opts.linkedAccount);
          return Object.keys(h).length ? h : undefined;
        };
        return {
          audienceMembersIngest: (body) => request('POST', `${B}/audienceMembers:ingest`, body),
          audienceMembersRemove: (body) => request('POST', `${B}/audienceMembers:remove`, body),
          eventsIngest: (body) => request('POST', `${B}/events:ingest`, body),
          requestStatusRetrieve: (requestId) =>
            request('GET', `${B}/requestStatus:retrieve${q({ requestId })}`),
          insightsRetrieve: (accountType, accountId, body, opts) =>
            request('POST', `${acc(accountType, accountId)}/insights:retrieve`, body, hdr(opts)),
          partnerLinksCreate: (accountType, accountId, body, opts) =>
            request('POST', `${acc(accountType, accountId)}/partnerLinks`, body, hdr(opts)),
          partnerLinksDelete: (accountType, accountId, partnerLinkId, opts) =>
            request(
              'DELETE',
              `${acc(accountType, accountId)}/partnerLinks/${encodeURIComponent(partnerLinkId)}`,
              undefined,
              hdr(opts),
            ),
          partnerLinksSearch: (accountType, accountId, params = {}, opts) =>
            request(
              'GET',
              `${acc(accountType, accountId)}/partnerLinks:search${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
                filter: params.filter,
              })}`,
              undefined,
              hdr(opts),
            ),
          userListDirectLicensesCreate: (accountType, accountId, body) =>
            request('POST', `${acc(accountType, accountId)}/userListDirectLicenses`, body),
          userListDirectLicensesGet: (accountType, accountId, licenseId) =>
            request('GET', `${acc(accountType, accountId)}/userListDirectLicenses/${encodeURIComponent(licenseId)}`),
          userListDirectLicensesPatch: (accountType, accountId, licenseId, body, params = {}) =>
            request(
              'PATCH',
              `${acc(accountType, accountId)}/userListDirectLicenses/${encodeURIComponent(licenseId)}${q({
                updateMask: params.update_mask,
              })}`,
              body,
            ),
          userListDirectLicensesList: (accountType, accountId, params = {}) =>
            request(
              'GET',
              `${acc(accountType, accountId)}/userListDirectLicenses${q({
                filter: params.filter,
                pageSize: params.page_size,
                pageToken: params.page_token,
              })}`,
            ),
          userListGlobalLicensesCreate: (accountType, accountId, body) =>
            request('POST', `${acc(accountType, accountId)}/userListGlobalLicenses`, body),
          userListGlobalLicensesPatch: (accountType, accountId, licenseId, body, params = {}) =>
            request(
              'PATCH',
              `${acc(accountType, accountId)}/userListGlobalLicenses/${encodeURIComponent(licenseId)}${q({
                updateMask: params.update_mask,
              })}`,
              body,
            ),
          userListGlobalLicensesGet: (accountType, accountId, licenseId) =>
            request('GET', `${acc(accountType, accountId)}/userListGlobalLicenses/${encodeURIComponent(licenseId)}`),
          userListGlobalLicensesList: (accountType, accountId, params = {}) =>
            request(
              'GET',
              `${acc(accountType, accountId)}/userListGlobalLicenses${q({
                filter: params.filter,
                pageSize: params.page_size,
                pageToken: params.page_token,
              })}`,
            ),
          userListGlobalLicenseCustomerInfosList: (accountType, accountId, globalLicenseId, params = {}) =>
            request(
              'GET',
              `${acc(accountType, accountId)}/userListGlobalLicenses/${encodeURIComponent(globalLicenseId)}/userListGlobalLicenseCustomerInfos${q(
                {
                  filter: params.filter,
                  pageSize: params.page_size,
                  pageToken: params.page_token,
                },
              )}`,
            ),
          userListsGet: (accountType, accountId, userListId, opts) =>
            request(
              'GET',
              `${acc(accountType, accountId)}/userLists/${encodeURIComponent(userListId)}`,
              undefined,
              hdr(opts),
            ),
          userListsList: (accountType, accountId, params = {}, opts) =>
            request(
              'GET',
              `${acc(accountType, accountId)}/userLists${q({
                pageSize: params.page_size,
                pageToken: params.page_token,
                filter: params.filter,
              })}`,
              undefined,
              hdr(opts),
            ),
          userListsCreate: (accountType, accountId, body, params = {}, opts) =>
            request(
              'POST',
              `${acc(accountType, accountId)}/userLists${q({ validateOnly: params.validate_only })}`,
              body,
              hdr(opts),
            ),
          userListsPatch: (accountType, accountId, userListId, body, params = {}, opts) =>
            request(
              'PATCH',
              `${acc(accountType, accountId)}/userLists/${encodeURIComponent(userListId)}${q({
                updateMask: params.update_mask,
                validateOnly: params.validate_only,
              })}`,
              body,
              hdr(opts),
            ),
          userListsDelete: (accountType, accountId, userListId, params = {}, opts) =>
            request(
              'DELETE',
              `${acc(accountType, accountId)}/userLists/${encodeURIComponent(userListId)}${q({
                validateOnly: params.validate_only,
              })}`,
              undefined,
              hdr(opts),
            ),
        };
      })(),
    },
    appLogs: {
      logUserInApp: () => Promise.resolve(),
    },
    subscription: {
      createCheckoutSession: (options) =>
        request('POST', '/api/subscription/create-checkout-session', options).then((r) => ({
          url: r?.url,
          upgraded: Boolean(r?.upgraded),
          already_on_plan: Boolean(r?.already_on_plan),
          plan: r?.plan,
          previous_plan: r?.previous_plan,
          message: r?.message,
        })),
      getPortalUrl: () => request('GET', '/api/subscription/portal').then((r) => ({ url: r?.url })),
    },
    promo: {
      redeem: (code, planId = 'premium') =>
        request('POST', '/api/promo/redeem', { code, plan_id: planId }),
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
      searchUsers: (q) => request('GET', `/api/library/users/search?q=${encodeURIComponent(q || '')}`),
      createPeerShare: (body) => request('POST', '/api/library/peer-shares', body),
      deletePeerShare: (shareId) => request('DELETE', `/api/library/peer-shares/${encodeURIComponent(shareId)}`),
      sharedWithMe: () => request('GET', '/api/library/shared-with-me'),
      peerSharesOutgoing: () => request('GET', '/api/library/peer-shares/outgoing'),
    },
    /** Scoring projects (folder-like) — free + paid with plan limits */
    projects: {
      limits: () => request('GET', '/api/projects/limits'),
      validateCompare: (count) => request('POST', '/api/projects/compare/validate', { count }),
      list: () => request('GET', '/api/projects'),
      listInvites: () => request('GET', '/api/projects/invites'),
      create: (data) => request('POST', '/api/projects', data),
      get: (id) => request('GET', `/api/projects/${encodeURIComponent(id)}`),
      update: (id, data) => request('PATCH', `/api/projects/${encodeURIComponent(id)}`, data),
      delete: (id) => request('DELETE', `/api/projects/${encodeURIComponent(id)}`),
      inviteMember: (projectId, body) =>
        request('POST', `/api/projects/${encodeURIComponent(projectId)}/members`, body),
      acceptInvite: (memberId) =>
        request('POST', `/api/projects/members/${encodeURIComponent(memberId)}/accept`),
      declineInvite: (memberId) =>
        request('POST', `/api/projects/members/${encodeURIComponent(memberId)}/decline`),
      removeMember: (projectId, memberId) =>
        request(
          'DELETE',
          `/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
        ),
      addProperty: (projectId, property, opts = {}) =>
        request('POST', `/api/projects/${encodeURIComponent(projectId)}/properties`, {
          property,
          enrich_location: opts.enrich_location !== false,
        }),
      addProperties: (projectId, properties, opts = {}) =>
        request('POST', `/api/projects/${encodeURIComponent(projectId)}/properties/batch`, {
          properties,
          enrich_location: Boolean(opts.enrich_location),
        }),
      removeProperty: (projectId, propId) =>
        request(
          'DELETE',
          `/api/projects/${encodeURIComponent(projectId)}/properties/${encodeURIComponent(propId)}`,
        ),
      rescore: (id) => request('POST', `/api/projects/${encodeURIComponent(id)}/rescore`),
    },
    invitations: {
      send: (body) => request('POST', '/api/invitations', body),
      validateToken: (token) => publicGet(`/api/invitations/validate?token=${encodeURIComponent(token)}`),
      accept: (token) => request('POST', '/api/invitations/accept', { token }),
      listSent: () => request('GET', '/api/invitations/sent'),
    },
    referrals: {
      me: () => request('GET', '/api/referrals/me'),
      validate: (code) => publicGet(`/api/referrals/validate?code=${encodeURIComponent(code)}`),
      claim: (code) => request('POST', '/api/referrals/claim', { code }),
    },
    preferenceCards: {
      preview: () => request('GET', '/api/preference-cards/preview'),
      enableShare: (body) => request('POST', '/api/preference-cards/share', body || {}),
      updateShare: (body) => request('PATCH', '/api/preference-cards/share', body || {}),
      regenerate: () => request('POST', '/api/preference-cards/regenerate'),
      revokeShare: () => request('DELETE', '/api/preference-cards/share'),
      getPublic: (token) =>
        publicGet(`/api/preference-cards/public/${encodeURIComponent(token || '')}`),
    },
    preferences: {
      getLearned: () => request('GET', '/api/preferences/learned'),
      getInsights: () => request('GET', '/api/preferences/insights'),
      startQuestionnaire: (body) => request('POST', '/api/preferences/questionnaire/start', body),
      respondQuestionnaire: (body) => request('POST', '/api/preferences/questionnaire/respond', body),
      explainScore: (body) => request('POST', '/api/preferences/explain-score', body),
      visitNotesToScores: (body) => request('POST', '/api/preferences/visit-notes-to-scores', body),
      realtorDraft: (body) => request('POST', '/api/preferences/realtor-draft', body),
    },
    realtor: {
      assignProperty: (body) => request('POST', '/api/realtor/assignments', body),
      listSentAssignments: () => request('GET', '/api/realtor/assignments/sent'),
      clientInbox: () => request('GET', '/api/realtor/assignments/inbox'),
      markAssignmentRead: (id) => request('PATCH', `/api/realtor/assignments/${encodeURIComponent(id)}/read`),
    },
  };
}
