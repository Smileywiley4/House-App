/**
 * Base44 backend adapter.
 * Implements the PropertyPulse API surface using @base44/sdk.
 */
import { base44 } from '@/api/base44Client';

export const base44Adapter = {
  auth: {
    me: () => base44.auth.me(),
    updateMe: (profile) => base44.auth.updateMe(profile),
    updateEmail: async () => {
      throw new Error("Email updates require Supabase/Python backend");
    },
    updatePassword: async () => {
      throw new Error("Password updates require Supabase/Python backend");
    },
    logout: (returnUrl) => (returnUrl != null ? base44.auth.logout(returnUrl) : base44.auth.logout()),
    redirectToLogin: (returnUrl) => base44.auth.redirectToLogin(returnUrl ?? window?.location?.href),
  },
  entities: {
    PropertyScore: {
      list: (order = '-created_date') => base44.entities.PropertyScore.list(order),
      create: (data) => base44.entities.PropertyScore.create(data),
      delete: (id) => base44.entities.PropertyScore.delete(id),
    },
    Client: {
      list: (order = '-created_date') => base44.entities.Client.list(order),
      create: (data) => base44.entities.Client.create(data),
      delete: (id) => base44.entities.Client.delete(id),
    },
    PrivateListing: {
      list: (order = '-created_date') => base44.entities.PrivateListing.list(order),
      create: (data) => base44.entities.PrivateListing.create(data),
      delete: (id) => base44.entities.PrivateListing.delete(id),
    },
    Preset: {
      list: () => Promise.resolve([]),
      create: () => Promise.reject(new Error('Presets require Python backend or Supabase')),
      update: () => Promise.reject(new Error('Presets require Python backend or Supabase')),
      delete: () => Promise.reject(new Error('Presets require Python backend or Supabase')),
    },
  },
  property: {
    search: undefined,
    searchByCriteria: () => Promise.resolve({ source: 'public', properties: [] }),
    autoscore: () => Promise.resolve({ scores: {} }),
  },
  integrations: {
    invokeLLM: (options) => base44.integrations.Core.InvokeLLM(options),
  },
  appLogs: {
    logUserInApp: (pageName) => base44.appLogs?.logUserInApp?.(pageName) ?? Promise.resolve(),
  },
  subscription: {
    createCheckoutSession: async (options) => {
      if (typeof base44.integrations?.Stripe?.CreateCheckoutSession === 'function') {
        return base44.integrations.Stripe.CreateCheckoutSession(options);
      }
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      return { url: `${base}/Pricing?checkout=1&plan=${encodeURIComponent(options?.planId || 'premium')}` };
    },
    getPortalUrl: async () => {
      if (typeof base44.integrations?.Stripe?.GetPortalUrl === 'function') {
        return base44.integrations.Stripe.GetPortalUrl();
      }
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      return { url: `${base}/Profile` };
    },
  },
};
