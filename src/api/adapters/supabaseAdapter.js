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
  const license_number = row.license_number ?? row.realtor_license ?? '';
  const brokerage_name = row.brokerage_name ?? row.brokerage ?? '';
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name ?? row.raw_user_meta_data?.full_name,
    default_weights: row.default_weights ?? {},
    role: row.role ?? 'user',
    plan: row.plan ?? 'free',
    realtor_license: license_number,
    license_number,
    brokerage: brokerage_name,
    brokerage_name,
    state: row.state ?? '',
    license_state: row.license_state ?? '',
    license_verification_status: row.license_verification_status ?? 'self_reported',
    license_verified_at: row.license_verified_at ?? null,
    license_verification_notes: row.license_verification_notes ?? '',
    linked_realtor_id: row.linked_realtor_id ?? null,
    avatar_url: row.avatar_url ?? '',
    has_seen_onboarding_quiz: Boolean(row.has_seen_onboarding_quiz),
    has_seen_client_priority_quiz: Boolean(row.has_seen_client_priority_quiz),
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
        if (profile.license_number !== undefined) {
          updates.license_number = profile.license_number;
          updates.realtor_license = profile.license_number;
        }
        if (profile.brokerage !== undefined) updates.brokerage = profile.brokerage;
        if (profile.brokerage_name !== undefined) {
          updates.brokerage_name = profile.brokerage_name;
          updates.brokerage = profile.brokerage_name;
        }
        if (profile.state !== undefined) updates.state = profile.state;
        if (profile.license_state !== undefined) updates.license_state = profile.license_state;
        if (profile.linked_realtor_id !== undefined) updates.linked_realtor_id = profile.linked_realtor_id;
        if (profile.avatar_url !== undefined) updates.avatar_url = profile.avatar_url;
        if (profile.has_seen_onboarding_quiz !== undefined) {
          updates.has_seen_onboarding_quiz = Boolean(profile.has_seen_onboarding_quiz);
        }
        if (profile.has_seen_client_priority_quiz !== undefined) {
          updates.has_seen_client_priority_quiz = Boolean(profile.has_seen_client_priority_quiz);
        }
        await supabase.from('profiles').update(updates).eq('id', user.id);
        return profileToUser({ ...user, ...updates });
      },

      requestLicenseVerification: async (payload = {}) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
        const prep = {};
        if (payload.license_number !== undefined) {
          prep.license_number = payload.license_number;
          prep.realtor_license = payload.license_number;
        }
        if (payload.license_state !== undefined) prep.license_state = payload.license_state;
        if (payload.brokerage_name !== undefined) {
          prep.brokerage_name = payload.brokerage_name;
          prep.brokerage = payload.brokerage_name;
        }
        if (Object.keys(prep).length) {
          await supabase.from('profiles').update(prep).eq('id', user.id);
        }
        const { data, error } = await supabase.rpc('request_license_verification');
        if (error) throw error;
        return profileToUser(data);
      },
      updateEmail: async (email) => {
        const normalized = String(email || '').trim().toLowerCase();
        if (!normalized.includes('@')) {
          throw new Error('Enter a valid email address.');
        }
        const emailRedirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/login?redirect=${encodeURIComponent('/profile?tab=security&email_changed=1')}`
            : undefined;
        const { data, error } = await supabase.auth.updateUser(
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { email: null, pendingEmail: null };
        return {
          email: user.email || null,
          pendingEmail: user.new_email || null,
        };
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
      deleteMe: async () => {
        throw Object.assign(
          new Error('Account deletion requires the Python API (set VITE_USE_PYTHON_BACKEND=true).'),
          { status: 503 }
        );
      },
      exportMe: async () => {
        throw Object.assign(
          new Error('Data export requires the Python API (set VITE_USE_PYTHON_BACKEND=true).'),
          { status: 503 }
        );
      },
      logout: async (returnUrl) => {
        await supabase.auth.signOut({ scope: 'local' });
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
      autoscore: () => Promise.resolve({ scores: {} }),
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
      placesSearchNearby: () =>
        Promise.reject(
          new Error('Google Places searchNearby requires Python backend (VITE_USE_PYTHON_BACKEND=true).'),
        ),
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
      ampUrlBatchGet: async () => {
        throw new Error('Google AMP URL API is available when VITE_USE_PYTHON_BACKEND=true and the FastAPI google_amp router is deployed.');
      },
      workspaceDataTransfer: {
        listApplications: async () => {
          throw new Error('Workspace Data Transfer proxy requires Python backend.');
        },
        getApplication: async () => {
          throw new Error('Workspace Data Transfer proxy requires Python backend.');
        },
        listTransfers: async () => {
          throw new Error('Workspace Data Transfer proxy requires Python backend.');
        },
        getTransfer: async () => {
          throw new Error('Workspace Data Transfer proxy requires Python backend.');
        },
        createTransfer: async () => {
          throw new Error('Workspace Data Transfer proxy requires Python backend.');
        },
      },
      adsense: {
        listAccounts: async () => {
          throw new Error('AdSense API proxy requires Python backend.');
        },
        getAccount: async () => {
          throw new Error('AdSense API proxy requires Python backend.');
        },
        listChildAccounts: async () => {
          throw new Error('AdSense API proxy requires Python backend.');
        },
        listAdClients: async () => {
          throw new Error('AdSense API proxy requires Python backend.');
        },
        generateReport: async () => {
          throw new Error('AdSense API proxy requires Python backend.');
        },
        generateReportCsv: async () => {
          throw new Error('AdSense API proxy requires Python backend.');
        },
        listSites: async () => {
          throw new Error('AdSense API proxy requires Python backend.');
        },
        listPayments: async () => {
          throw new Error('AdSense API proxy requires Python backend.');
        },
        listAlerts: async () => {
          throw new Error('AdSense API proxy requires Python backend.');
        },
      },
      adsensePlatform: {
        listAccounts: async () => {
          throw new Error('AdSense Platform API requires Python backend.');
        },
        lookupAccount: async () => {
          throw new Error('AdSense Platform API requires Python backend.');
        },
        getAccount: async () => {
          throw new Error('AdSense Platform API requires Python backend.');
        },
        createAccount: async () => {
          throw new Error('AdSense Platform API requires Python backend.');
        },
        closeAccount: async () => {
          throw new Error('AdSense Platform API requires Python backend.');
        },
        createEvent: async () => {
          throw new Error('AdSense Platform API requires Python backend.');
        },
        listSites: async () => {
          throw new Error('AdSense Platform API requires Python backend.');
        },
        getSite: async () => {
          throw new Error('AdSense Platform API requires Python backend.');
        },
        createSite: async () => {
          throw new Error('AdSense Platform API requires Python backend.');
        },
        requestSiteReview: async () => {
          throw new Error('AdSense Platform API requires Python backend.');
        },
        deleteSite: async () => {
          throw new Error('AdSense Platform API requires Python backend.');
        },
        transparent: {
          listPlatforms: async () => {
            throw new Error('AdSense Platform API (transparent) requires Python backend.');
          },
          getPlatform: async () => {
            throw new Error('AdSense Platform API (transparent) requires Python backend.');
          },
          listGroups: async () => {
            throw new Error('AdSense Platform API (transparent) requires Python backend.');
          },
          getGroup: async () => {
            throw new Error('AdSense Platform API (transparent) requires Python backend.');
          },
          patchGroup: async () => {
            throw new Error('AdSense Platform API (transparent) requires Python backend.');
          },
          listChildSites: async () => {
            throw new Error('AdSense Platform API (transparent) requires Python backend.');
          },
          getChildSite: async () => {
            throw new Error('AdSense Platform API (transparent) requires Python backend.');
          },
          patchChildSite: async () => {
            throw new Error('AdSense Platform API (transparent) requires Python backend.');
          },
        },
      },
      revenue: {
        adsenseDailySnapshot: async () => {
          throw new Error('Revenue snapshots require Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        listSnapshots: async () => {
          throw new Error('Revenue snapshots require Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
      },
      analyticsHub: (() => {
        const err = async () => {
          throw new Error('Analytics Hub API requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        return {
          listDataExchanges: err,
          getDataExchange: err,
          createDataExchange: err,
          patchDataExchange: err,
          deleteDataExchange: err,
          subscribeDataExchange: err,
          listDataExchangeSubscriptions: err,
          dataExchangeGetIamPolicy: err,
          dataExchangeSetIamPolicy: err,
          dataExchangeTestIamPermissions: err,
          listListings: err,
          getListing: err,
          createListing: err,
          patchListing: err,
          deleteListing: err,
          subscribeListing: err,
          listListingSubscriptions: err,
          listingGetIamPolicy: err,
          listingSetIamPolicy: err,
          listingTestIamPermissions: err,
          listQueryTemplates: err,
          getQueryTemplate: err,
          createQueryTemplate: err,
          patchQueryTemplate: err,
          deleteQueryTemplate: err,
          submitQueryTemplate: err,
          approveQueryTemplate: err,
          listSubscriptions: err,
          getSubscription: err,
          refreshSubscription: err,
          revokeSubscription: err,
          deleteSubscription: err,
          subscriptionGetIamPolicy: err,
          subscriptionSetIamPolicy: err,
          listOrgDataExchanges: err,
        };
      })(),
      androidManagement: (() => {
        const err = async () => {
          throw new Error('Android Management API requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        return {
          createSignupUrl: err,
          listEnterprises: err,
          createEnterprise: err,
          getEnterprise: err,
          patchEnterprise: err,
          deleteEnterprise: err,
          generateEnterpriseUpgradeUrl: err,
          createEnrollmentToken: err,
          listEnrollmentTokens: err,
          getEnrollmentToken: err,
          deleteEnrollmentToken: err,
          createWebToken: err,
          listDevices: err,
          getDevice: err,
          patchDevice: err,
          deleteDevice: err,
          issueDeviceCommand: err,
          listDeviceOperations: err,
          getDeviceOperation: err,
          cancelDeviceOperation: err,
          listPolicies: err,
          getPolicy: err,
          patchPolicy: err,
          deletePolicy: err,
          modifyPolicyApplications: err,
          removePolicyApplications: err,
          getApplication: err,
          listWebApps: err,
          createWebApp: err,
          getWebApp: err,
          patchWebApp: err,
          deleteWebApp: err,
          createMigrationToken: err,
          listMigrationTokens: err,
          getMigrationToken: err,
          getProvisioningInfo: err,
        };
      })(),
      googleChat: (() => {
        const err = async () => {
          throw new Error('Google Chat API requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        return {
          downloadMedia: err,
          uploadAttachment: err,
          listSpaces: err,
          searchSpaces: err,
          createSpace: err,
          setupSpace: err,
          findDirectMessage: err,
          getSpace: err,
          patchSpace: err,
          deleteSpace: err,
          completeImportSpace: err,
          createMessage: err,
          listMessages: err,
          getMessage: err,
          updateMessage: err,
          patchMessage: err,
          deleteMessage: err,
          getMessageAttachment: err,
          createReaction: err,
          listReactions: err,
          deleteReaction: err,
          listMembers: err,
          getMember: err,
          createMember: err,
          patchMember: err,
          deleteMember: err,
          listSpaceEvents: err,
          getSpaceEvent: err,
          createCustomEmoji: err,
          listCustomEmojis: err,
          getCustomEmoji: err,
          deleteCustomEmoji: err,
          getSpaceReadState: err,
          updateSpaceReadState: err,
          getThreadReadState: err,
          getSpaceNotificationSetting: err,
          patchSpaceNotificationSetting: err,
        };
      })(),
      chromeWebstore: (() => {
        const err = async () => {
          throw new Error('Chrome Web Store API requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        return {
          publishItem: err,
          fetchItemStatus: err,
          cancelSubmission: err,
          setPublishedDeployPercentage: err,
          uploadPackage: err,
        };
      })(),
      dataFusion: (() => {
        const err = async () => {
          throw new Error('Data Fusion API requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        return {
          getLocation: err,
          listLocations: err,
          getOperation: err,
          deleteOperation: err,
          listOperations: err,
          cancelOperation: err,
          listInstances: err,
          createInstance: err,
          getInstance: err,
          patchInstance: err,
          deleteInstance: err,
          restartInstance: err,
          getInstanceIamPolicy: err,
          setInstanceIamPolicy: err,
          testInstanceIamPermissions: err,
          createDnsPeering: err,
          listDnsPeerings: err,
          deleteDnsPeering: err,
          listVersions: err,
        };
      })(),
      dataFusionV1beta1: (() => {
        const err = async () => {
          throw new Error('Data Fusion API requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        return {
          getLocation: err,
          listLocations: err,
          getOperation: err,
          deleteOperation: err,
          listOperations: err,
          cancelOperation: err,
          listInstances: err,
          createInstance: err,
          getInstance: err,
          patchInstance: err,
          deleteInstance: err,
          restartInstance: err,
          getInstanceIamPolicy: err,
          setInstanceIamPolicy: err,
          testInstanceIamPermissions: err,
          createDnsPeering: err,
          listDnsPeerings: err,
          deleteDnsPeering: err,
          listVersions: err,
          upgradeInstance: err,
          removeIamPolicy: err,
          listNamespaces: err,
          getNamespaceIamPolicy: err,
          setNamespaceIamPolicy: err,
          testNamespaceIamPermissions: err,
        };
      })(),
      filestore: (() => {
        const err = async () => {
          throw new Error('Filestore API requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        return {
          getLocation: err,
          listLocations: err,
          getOperation: err,
          deleteOperation: err,
          listOperations: err,
          cancelOperation: err,
          listInstances: err,
          createInstance: err,
          getInstance: err,
          patchInstance: err,
          deleteInstance: err,
          restoreInstance: err,
          revertInstance: err,
          promoteReplica: err,
          pauseReplica: err,
          resumeReplica: err,
          listSnapshots: err,
          getSnapshot: err,
          createSnapshot: err,
          deleteSnapshot: err,
          patchSnapshot: err,
          listBackups: err,
          getBackup: err,
          createBackup: err,
          deleteBackup: err,
          patchBackup: err,
        };
      })(),
      filestoreV1beta1: (() => {
        const err = async () => {
          throw new Error('Filestore API requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        return {
          getLocation: err,
          listLocations: err,
          getOperation: err,
          deleteOperation: err,
          listOperations: err,
          cancelOperation: err,
          listInstances: err,
          createInstance: err,
          getInstance: err,
          patchInstance: err,
          deleteInstance: err,
          restoreInstance: err,
          revertInstance: err,
          promoteReplica: err,
          pauseReplica: err,
          resumeReplica: err,
          listSnapshots: err,
          getSnapshot: err,
          createSnapshot: err,
          deleteSnapshot: err,
          patchSnapshot: err,
          listBackups: err,
          getBackup: err,
          createBackup: err,
          deleteBackup: err,
          patchBackup: err,
          listShares: err,
          getShare: err,
          createShare: err,
          deleteShare: err,
          patchShare: err,
        };
      })(),
      osLogin: (() => {
        const err = async () => {
          throw new Error('OS Login API requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        return {
          signSshPublicKey: err,
          getLoginProfile: err,
          importSshPublicKey: err,
          createSshPublicKey: err,
          getSshPublicKey: err,
          patchSshPublicKey: err,
          deleteSshPublicKey: err,
          provisionPosixAccount: err,
          deletePosixAccount: err,
        };
      })(),
      osLoginV1beta: (() => {
        const err = async () => {
          throw new Error('OS Login v1beta API requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        return {
          signSshPublicKey: err,
          getLoginProfile: err,
          importSshPublicKey: err,
          createSshPublicKey: err,
          getSshPublicKey: err,
          patchSshPublicKey: err,
          deleteSshPublicKey: err,
          provisionPosixAccount: err,
          deletePosixAccount: err,
          signSshPublicKeyUserProjectZone: err,
          signSshPublicKeyUserProjectLocation: err,
        };
      })(),
      translate: (() => {
        const err = async () => {
          throw new Error('Cloud Translation API v3 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        const names = [
          'projectsRomanizeText',
          'projectsGetSupportedLanguages',
          'projectsTranslateText',
          'projectsDetectLanguage',
          'listLocations',
          'getLocation',
          'batchTranslateText',
          'adaptiveMtTranslate',
          'locationsRomanizeText',
          'locationsGetSupportedLanguages',
          'batchTranslateDocument',
          'locationsTranslateText',
          'translateDocument',
          'refineText',
          'locationsDetectLanguage',
          'getModel',
          'deleteModel',
          'listModels',
          'createModel',
          'listOperations',
          'getOperation',
          'deleteOperation',
          'cancelOperation',
          'waitOperation',
          'importDatasetData',
          'createDataset',
          'listDatasets',
          'getDataset',
          'exportDatasetData',
          'deleteDataset',
          'listDatasetExamples',
          'patchGlossary',
          'getGlossary',
          'deleteGlossary',
          'createGlossary',
          'listGlossaries',
          'deleteGlossaryEntry',
          'getGlossaryEntry',
          'patchGlossaryEntry',
          'listGlossaryEntries',
          'createGlossaryEntry',
          'deleteAdaptiveMtDataset',
          'getAdaptiveMtDataset',
          'createAdaptiveMtDataset',
          'listAdaptiveMtDatasets',
          'importAdaptiveMtFile',
          'listAdaptiveMtSentencesForDataset',
          'deleteAdaptiveMtFile',
          'getAdaptiveMtFile',
          'listAdaptiveMtFiles',
          'listAdaptiveMtSentencesForFile',
        ];
        return Object.fromEntries(names.map((n) => [n, err]));
      })(),
      translateV3beta1: (() => {
        const err = async () => {
          throw new Error('Cloud Translation API v3beta1 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        const names = [
          'projectsGetSupportedLanguages',
          'projectsTranslateText',
          'projectsDetectLanguage',
          'listLocations',
          'getLocation',
          'batchTranslateText',
          'locationsGetSupportedLanguages',
          'batchTranslateDocument',
          'locationsTranslateText',
          'translateDocument',
          'refineText',
          'locationsDetectLanguage',
          'listOperations',
          'getOperation',
          'deleteOperation',
          'cancelOperation',
          'waitOperation',
          'getGlossary',
          'deleteGlossary',
          'createGlossary',
          'listGlossaries',
        ];
        return Object.fromEntries(names.map((n) => [n, err]));
      })(),
      drive: {
        v3: async () => {
          throw new Error('Google Drive API v3 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        upload: async () => {
          throw new Error('Google Drive API v3 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        resumable: async () => {
          throw new Error('Google Drive API v3 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        v3Raw: async () => {
          throw new Error('Google Drive API v3 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        uploadRaw: async () => {
          throw new Error('Google Drive API v3 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        resumableRaw: async () => {
          throw new Error('Google Drive API v3 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
      },
      policyAnalyzer: {
        activitiesQuery: async () => {
          throw new Error('Policy Analyzer API v1 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
      },
      policySimulator: {
        v1: async () => {
          throw new Error('Policy Simulator API v1 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        v1Raw: async () => {
          throw new Error('Policy Simulator API v1 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        v1beta: async () => {
          throw new Error('Policy Simulator API v1beta requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        v1betaRaw: async () => {
          throw new Error('Policy Simulator API v1beta requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
      },
      doubleclickSearch: {
        v2: async () => {
          throw new Error('DoubleClick Search API v2 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        v2Raw: async () => {
          throw new Error('DoubleClick Search API v2 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
      },
      saasRuntime: {
        v1: async () => {
          throw new Error('SaaS Runtime API v1 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        v1Raw: async () => {
          throw new Error('SaaS Runtime API v1 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        v1beta1: async () => {
          throw new Error('SaaS Runtime API v1beta1 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        v1beta1Raw: async () => {
          throw new Error('SaaS Runtime API v1beta1 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
      },
      serviceNetworking: {
        v1: async () => {
          throw new Error('Service Networking API v1 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
        v1Raw: async () => {
          throw new Error('Service Networking API v1 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        },
      },
      dataManager: (() => {
        const err = async () => {
          throw new Error('Google Data Manager API v1 requires Python backend (VITE_USE_PYTHON_BACKEND=true).');
        };
        const names = [
          'audienceMembersIngest',
          'audienceMembersRemove',
          'eventsIngest',
          'requestStatusRetrieve',
          'insightsRetrieve',
          'partnerLinksCreate',
          'partnerLinksDelete',
          'partnerLinksSearch',
          'userListDirectLicensesCreate',
          'userListDirectLicensesGet',
          'userListDirectLicensesPatch',
          'userListDirectLicensesList',
          'userListGlobalLicensesCreate',
          'userListGlobalLicensesPatch',
          'userListGlobalLicensesGet',
          'userListGlobalLicensesList',
          'userListGlobalLicenseCustomerInfosList',
          'userListsGet',
          'userListsList',
          'userListsCreate',
          'userListsPatch',
          'userListsDelete',
        ];
        return Object.fromEntries(names.map((n) => [n, err]));
      })(),
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
    library: {
      searchRealtors: () =>
        Promise.reject(new Error('Visit library requires Python backend (VITE_USE_PYTHON_BACKEND=true)')),
      listSaved: () => Promise.reject(new Error('Visit library requires Python backend')),
      getSaved: () => Promise.reject(new Error('Visit library requires Python backend')),
      createSaved: () => Promise.reject(new Error('Visit library requires Python backend')),
      updateSaved: () => Promise.reject(new Error('Visit library requires Python backend')),
      deleteSaved: () => Promise.reject(new Error('Visit library requires Python backend')),
      uploadPhoto: () => Promise.reject(new Error('Visit library requires Python backend')),
      deletePhoto: () => Promise.reject(new Error('Visit library requires Python backend')),
      importListingPhotos: () => Promise.reject(new Error('Visit library requires Python backend')),
      shareWithRealtor: () => Promise.reject(new Error('Visit library requires Python backend')),
      listFolders: () => Promise.reject(new Error('Visit library requires Python backend')),
      createFolder: () => Promise.reject(new Error('Visit library requires Python backend')),
      deleteFolder: () => Promise.reject(new Error('Visit library requires Python backend')),
      addToFolder: () => Promise.reject(new Error('Visit library requires Python backend')),
      removeFromFolder: () => Promise.reject(new Error('Visit library requires Python backend')),
      realtorInbox: () => Promise.reject(new Error('Visit library requires Python backend')),
      searchUsers: () => Promise.reject(new Error('Visit library requires Python backend')),
      createPeerShare: () => Promise.reject(new Error('Visit library requires Python backend')),
      deletePeerShare: () => Promise.reject(new Error('Visit library requires Python backend')),
      sharedWithMe: () => Promise.reject(new Error('Visit library requires Python backend')),
      peerSharesOutgoing: () => Promise.reject(new Error('Visit library requires Python backend')),
    },
    projects: {
      limits: () => Promise.reject(new Error('Projects require Python backend')),
      validateCompare: () => Promise.reject(new Error('Projects require Python backend')),
      list: () => Promise.reject(new Error('Projects require Python backend')),
      listInvites: () => Promise.reject(new Error('Projects require Python backend')),
      create: () => Promise.reject(new Error('Projects require Python backend')),
      get: () => Promise.reject(new Error('Projects require Python backend')),
      update: () => Promise.reject(new Error('Projects require Python backend')),
      delete: () => Promise.reject(new Error('Projects require Python backend')),
      inviteMember: () => Promise.reject(new Error('Projects require Python backend')),
      acceptInvite: () => Promise.reject(new Error('Projects require Python backend')),
      declineInvite: () => Promise.reject(new Error('Projects require Python backend')),
      removeMember: () => Promise.reject(new Error('Projects require Python backend')),
      addProperty: () => Promise.reject(new Error('Projects require Python backend')),
      addProperties: () => Promise.reject(new Error('Projects require Python backend')),
      removeProperty: () => Promise.reject(new Error('Projects require Python backend')),
      rescore: () => Promise.reject(new Error('Projects require Python backend')),
    },
    contacts: {
      search: () => Promise.reject(new Error('Contacts require Python backend')),
      list: () => Promise.reject(new Error('Contacts require Python backend')),
      add: () => Promise.reject(new Error('Contacts require Python backend')),
      accept: () => Promise.reject(new Error('Contacts require Python backend')),
      decline: () => Promise.reject(new Error('Contacts require Python backend')),
      update: () => Promise.reject(new Error('Contacts require Python backend')),
      remove: () => Promise.reject(new Error('Contacts require Python backend')),
    },
    shares: {
      send: () => Promise.reject(new Error('Property shares require Python backend')),
      inbox: () => Promise.reject(new Error('Property shares require Python backend')),
      sent: () => Promise.reject(new Error('Property shares require Python backend')),
      pendingCount: () => Promise.resolve({ count: 0 }),
      clientReport: () => Promise.reject(new Error('Property shares require Python backend')),
      get: () => Promise.reject(new Error('Property shares require Python backend')),
      markViewed: () => Promise.reject(new Error('Property shares require Python backend')),
      returnScores: () => Promise.reject(new Error('Property shares require Python backend')),
      cancel: () => Promise.reject(new Error('Property shares require Python backend')),
    },
    invitations: {
      send: () => Promise.reject(new Error('Invitations require Python backend')),
      validateToken: () => Promise.reject(new Error('Invitations require Python backend')),
      accept: () => Promise.reject(new Error('Invitations require Python backend')),
      listSent: () => Promise.reject(new Error('Invitations require Python backend')),
    },
    referrals: {
      me: () => Promise.reject(new Error('Referrals require Python backend')),
      validate: () => Promise.reject(new Error('Referrals require Python backend')),
      claim: () => Promise.reject(new Error('Referrals require Python backend')),
    },
    preferenceCards: {
      preview: () => Promise.reject(new Error('Preference cards require Python backend')),
      enableShare: () => Promise.reject(new Error('Preference cards require Python backend')),
      updateShare: () => Promise.reject(new Error('Preference cards require Python backend')),
      regenerate: () => Promise.reject(new Error('Preference cards require Python backend')),
      revokeShare: () => Promise.reject(new Error('Preference cards require Python backend')),
      getPublic: () => Promise.reject(new Error('Preference cards require Python backend')),
    },
    support: {
      submitFeedback: () =>
        Promise.reject(new Error('In-app feedback requires the Python API (VITE_USE_PYTHON_BACKEND=true).')),
    },
  };
}
