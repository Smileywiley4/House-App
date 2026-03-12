/**
 * Shared API types for PropertyPulse.
 * Used by both Base44 and Supabase adapters so the app stays backend-agnostic.
 * Safe to reuse in React Native.
 */

/** @typedef {{ id: string, email?: string, full_name?: string, default_weights?: Record<string, number>, role?: string, plan?: string, realtor_license?: string, brokerage?: string, state?: string }} User */

/** @typedef {{ category_id: string, category_label: string, importance: number, score: number }} ScoreItem */

/** @typedef {{ id: string, property_address: string, scores: ScoreItem[], weighted_total: number, max_possible: number, percentage: number, created_date?: string }} PropertyScore */

/** @typedef {{ name: string, email?: string, phone?: string, budget_min?: string, budget_max?: string, notes?: string, status?: string }} ClientCreate */

/** @typedef {ClientCreate & { id: string }} Client */

/** @typedef {{ address: string, city?: string, state?: string, zip?: string, price?: string, bedrooms?: string, bathrooms?: string, sqft?: string, year_built?: string, status?: string, client_id?: string, notes?: string }} PrivateListingCreate */

/** @typedef {PrivateListingCreate & { id: string }} PrivateListing */

/** @typedef {{ prompt: string, response_json_schema?: object, add_context_from_internet?: boolean }} InvokeLLMOptions */

/** @typedef {{ planId: string, successUrl?: string, cancelUrl?: string }} CreateCheckoutOptions */
/** @typedef {{ url: string }} CheckoutSessionResult */
