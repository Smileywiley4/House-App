/**
 * Property search with caching for consistency (same address → same result).
 * When using Python backend, uses server-side cache (POST /api/property/search); otherwise client cache + LLM.
 */
import { api } from '@/api';

const CACHE_KEY_PREFIX = 'propertypulse_prop_';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function normalizeAddress(address) {
  if (!address || typeof address !== 'string') return '';
  return address
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\b(st|street|ave|avenue|blvd|dr|drive|ln|lane|rd|road|ct|court)\b/gi, (m) => m.toLowerCase());
}

function cacheKey(address) {
  return CACHE_KEY_PREFIX + normalizeAddress(address);
}

function getCached(address) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const key = cacheKey(address);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, at } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function setCached(address, data) {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = cacheKey(address);
    localStorage.setItem(key, JSON.stringify({ data, at: Date.now() }));
  } catch {}
}

const PROPERTY_LLM_SCHEMA = {
  type: 'object',
  properties: {
    address: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    zip: { type: 'string' },
    price: { type: 'number' },
    bedrooms: { type: 'number' },
    bathrooms: { type: 'number' },
    sqft: { type: 'number' },
    year_built: { type: 'number' },
    description: { type: 'string' },
    lat: { type: 'number' },
    lng: { type: 'number' },
    walk_score: { type: 'number' },
    school_rating: { type: 'string' },
    nearby_hospitals: { type: 'string' },
    nearby_highways: { type: 'string' },
    nearby_schools: { type: 'string' },
    on_market: { type: 'boolean' },
    listing_source: { type: 'string' },
  },
};

const PROPERTY_LLM_PROMPT = (addr) => `You are a real estate data assistant. For the address "${addr}", return accurate, consistent property data.

Rules:
- Use the same structure every time this address is queried (consistent data).
- If this is a real address, use realistic values aligned with public records and major listing sites (Zillow, Realtor.com, Redfin) when such data would be available.
- Determine if the property is currently listed for sale on the open market (MLS or major portals). Set on_market to true only if it is actively for sale; otherwise false.
- Set listing_source to the primary source if on_market is true (e.g. "MLS", "Zillow", "Realtor.com") or null if not for sale.

Return JSON with: address, city, state, zip, price (number USD), bedrooms, bathrooms, sqft, year_built, description (2-3 sentence neighborhood/summary), lat, lng, walk_score (0-100), school_rating (e.g. "8/10"), nearby_hospitals, nearby_highways, nearby_schools, on_market (boolean), listing_source (string or null).`;

/** Map API / network failures to user-friendly search errors. */
export function formatPropertySearchError(err) {
  if (!err) return 'Could not load property. Try again.';
  if (err.isNetworkError) return err.message;
  const status = err.status;
  if (status === 404) {
    return err.message || 'Address not found. Try adding city and state.';
  }
  if (status === 503) {
    return err.message || 'Property search is temporarily unavailable.';
  }
  if (status === 403) {
    return err.message || 'This search requires a Premium subscription.';
  }
  return err.message || 'Could not load property. Try again.';
}

/**
 * Fetch property details by address. Uses cache for consistency; same address returns same result within TTL.
 * @param {string} address - Full or partial address
 * @returns {Promise<object>} Property object including on_market for "For Sale" badge
 */
export async function getPropertyByAddress(address) {
  const normalized = (address || '').trim();
  if (!normalized) throw new Error('Address is required');

  if (api.property?.search) {
    try {
      const data = await api.property.search(normalized);
      return { ...data, on_market: !!data?.on_market, listing_source: data?.listing_source || null };
    } catch (err) {
      const friendly = formatPropertySearchError(err);
      const wrapped = new Error(friendly);
      wrapped.status = err?.status;
      wrapped.isNetworkError = err?.isNetworkError;
      throw wrapped;
    }
  }

  const cached = getCached(normalized);
  if (cached) return cached;

  const data = await api.integrations.invokeLLM({
    prompt: PROPERTY_LLM_PROMPT(normalized),
    response_json_schema: { type: 'object', properties: PROPERTY_LLM_SCHEMA.properties },
    add_context_from_internet: true,
  });

  const result = {
    ...data,
    on_market: !!data?.on_market,
    listing_source: data?.listing_source || null,
  };

  setCached(normalized, result);
  return result;
}
