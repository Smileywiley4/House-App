/**
 * Supabase backend adapter.
 * Implements the PropertyPulse API surface using @supabase/supabase-js.
 * Set VITE_USE_SUPABASE=true and provide VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
 */
import { getSharedSupabase } from '@/lib/supabase';

const getSupabase = () => {
  const client = getSharedSupabase();
  if (!client) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  return client;
};

/** Map Supabase profile row to User shape */
function profileToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name ?? row.raw_user_meta_data?.full_name,
    default_weights: row.default_weights ?? {},
    role: row.role ?? 'user',
    plan: row.plan ?? 'free',
    realtor_license: row.realtor_license ?? '',
    brokerage: row.brokerage ?? '',
    state: row.state ?? '',
  };
}

/** Map property_scores row to PropertyScore shape */
function rowToPropertyScore(row) {
  if (!row) return null;
  return {
    id: row.id,
    property_address: row.property_address,
    scores: row.scores ?? [],
    weighted_total: row.weighted_total ?? 0,
    max_possible: row.max_possible ?? 0,
    percentage: row.percentage ?? 0,
    created_date: row.created_at,
  };
}

export function createSupabaseAdapter() {
  const supabase = getSupabase();

  return {
    auth: {
      me: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
        let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (!profile) {
          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '',
          });
          const r = await supabase.from('profiles').select('*').eq('id', user.id).single();
          profile = r.data;
        }
        return profileToUser({ ...user, ...profile, email: user.email });
      },
      updateMe: async (profile) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
        const updates = {};
        if (profile.full_name !== undefined) updates.full_name = profile.full_name;
        if (profile.default_weights !== undefined) updates.default_weights = profile.default_weights;
        if (profile.realtor_license !== undefined) updates.realtor_license = profile.realtor_license;
        if (profile.brokerage !== undefined) updates.brokerage = profile.brokerage;
        if (profile.state !== undefined) updates.state = profile.state;
        await supabase.from('profiles').update(updates).eq('id', user.id);
        return profileToUser({ ...user, ...updates });
      },
      logout: async (returnUrl) => {
        await supabase.auth.signOut();
        if (typeof window !== 'undefined' && returnUrl) window.location.href = returnUrl;
      },
      redirectToLogin: (returnUrl) => {
        if (typeof window !== 'undefined') {
          const base = window.location.origin;
          const redirect = encodeURIComponent(returnUrl || window.location.href);
          window.location.href = `${base}/login?redirect=${redirect}`;
        }
      },
    },
    entities: {
      PropertyScore: {
        list: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return [];
          const { data, error } = await supabase
            .from('property_scores')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return (data ?? []).map(rowToPropertyScore);
        },
        create: async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
          const { data, error } = await supabase
            .from('property_scores')
            .insert({
              user_id: user.id,
              property_address: payload.property_address,
              scores: payload.scores ?? [],
              weighted_total: payload.weighted_total ?? 0,
              max_possible: payload.max_possible ?? 0,
              percentage: payload.percentage ?? 0,
            })
            .select()
            .single();
          if (error) throw error;
          return rowToPropertyScore(data);
        },
        delete: async (id) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
          const { error } = await supabase
            .from('property_scores')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
          if (error) throw error;
        },
      },
      Preset: {
        list: async (clientId) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return [];
          let q = supabase.from('user_presets').select('*').eq('user_id', user.id);
          if (clientId) q = q.eq('client_id', clientId);
          else q = q.is('client_id', null);
          const { data, error } = await q.order('created_at', { ascending: false });
          if (error) throw error;
          return data ?? [];
        },
        create: async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
          const { data, error } = await supabase
            .from('user_presets')
            .insert({
              user_id: user.id,
              name: payload.name,
              weights: payload.weights ?? {},
              filters: payload.filters ?? {},
              client_id: payload.client_id || null,
            })
            .select()
            .single();
          if (error) throw error;
          return data;
        },
        update: async (id, payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
          const updates = {};
          if (payload.name !== undefined) updates.name = payload.name;
          if (payload.weights !== undefined) updates.weights = payload.weights;
          if (payload.filters !== undefined) updates.filters = payload.filters;
          const { data, error } = await supabase
            .from('user_presets')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();
          if (error) throw error;
          return data;
        },
        delete: async (id) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
          const { error } = await supabase.from('user_presets').delete().eq('id', id).eq('user_id', user.id);
          if (error) throw error;
        },
      },
      Client: {
        list: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return [];
          const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return data ?? [];
        },
        create: async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
          const { data, error } = await supabase
            .from('clients')
            .insert({
              user_id: user.id,
              name: payload.name,
              email: payload.email ?? null,
              phone: payload.phone ?? null,
              budget_min: payload.budget_min ? Number(payload.budget_min) : null,
              budget_max: payload.budget_max ? Number(payload.budget_max) : null,
              notes: payload.notes ?? null,
              status: payload.status ?? 'active',
            })
            .select()
            .single();
          if (error) throw error;
          return data;
        },
        delete: async (id) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
          const { error } = await supabase.from('clients').delete().eq('id', id).eq('user_id', user.id);
          if (error) throw error;
        },
      },
      PrivateListing: {
        list: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return [];
          const { data, error } = await supabase
            .from('private_listings')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return data ?? [];
        },
        create: async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
          const { data, error } = await supabase
            .from('private_listings')
            .insert({
              user_id: user.id,
              address: payload.address,
              city: payload.city ?? null,
              state: payload.state ?? null,
              zip: payload.zip ?? null,
              price: payload.price ? Number(payload.price) : null,
              bedrooms: payload.bedrooms ? Number(payload.bedrooms) : null,
              bathrooms: payload.bathrooms ? Number(payload.bathrooms) : null,
              sqft: payload.sqft ? Number(payload.sqft) : null,
              year_built: payload.year_built ? Number(payload.year_built) : null,
              status: payload.status ?? 'off_market',
              client_id: payload.client_id || null,
              notes: payload.notes ?? null,
            })
            .select()
            .single();
          if (error) throw error;
          return data;
        },
        delete: async (id) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
          const { error } = await supabase.from('private_listings').delete().eq('id', id).eq('user_id', user.id);
          if (error) throw error;
        },
      },
    },
    property: {
      search: undefined,
      searchByCriteria: async (filters, source = 'public') => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { source, properties: [] };
        if (source === 'private') {
          const { data: rows } = await supabase
            .from('private_listings')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          let list = rows ?? [];
          const f = filters || {};
          if (f.budget_min != null) list = list.filter((x) => (x.price ?? 0) >= Number(f.budget_min));
          if (f.budget_max != null) list = list.filter((x) => (x.price ?? Infinity) <= Number(f.budget_max));
          if (f.beds_min != null) list = list.filter((x) => (x.bedrooms ?? 0) >= Number(f.beds_min));
          if (f.baths_min != null) list = list.filter((x) => (x.bathrooms ?? 0) >= Number(f.baths_min));
          if (f.sqft_min != null) list = list.filter((x) => (x.sqft ?? 0) >= Number(f.sqft_min));
          if (f.sqft_max != null) list = list.filter((x) => (x.sqft ?? Infinity) <= Number(f.sqft_max));
          if (f.city) list = list.filter((x) => (x.city || '').toLowerCase().includes(String(f.city).toLowerCase()));
          if (f.state) list = list.filter((x) => (x.state || '').toLowerCase().includes(String(f.state).toLowerCase()));
          if (f.zip) list = list.filter((x) => (x.zip || '').includes(String(f.zip)));
          return {
            source: 'private',
            properties: list.map((x) => ({
              address: x.address,
              city: x.city,
              state: x.state,
              zip: x.zip,
              price: x.price,
              bedrooms: x.bedrooms,
              bathrooms: x.bathrooms,
              sqft: x.sqft,
              year_built: x.year_built,
              description: x.notes || '',
              on_market: true,
              listing_source: 'Private Listing',
              id: x.id,
            })),
          };
        }
        return { source: 'public', properties: [] };
      },
    },
    integrations: {
      invokeLLM: async (options) => {
        // Call a Supabase Edge Function that proxies to OpenAI/Anthropic (see supabase/functions/invoke-llm).
        // If the function is not deployed, this will throw; add the Edge Function or use Base44 for LLM.
        const { data, error } = await supabase.functions.invoke('invoke-llm', { body: options });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data?.result ?? data;
      },
    },
    appLogs: {
      logUserInApp: () => Promise.resolve(),
    },
    subscription: {
      createCheckoutSession: async (options) => {
        const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: options });
        if (error) throw error;
        if (data?.url) return { url: data.url };
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        return { url: `${base}/Pricing?checkout=1&plan=${encodeURIComponent(options?.planId || 'premium')}` };
      },
      getPortalUrl: async () => {
        const { data, error } = await supabase.functions.invoke('get-portal-url');
        if (!error && data?.url) return { url: data.url };
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        return { url: `${base}/Profile` };
      },
    },
  };
}
