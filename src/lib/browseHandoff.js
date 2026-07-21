/**
 * Home / header search → BrowseProperties map handoff.
 * Property: lat/lng/zoom query + optional session payload for highlight.
 * Place: sessionStorage boundary ring (polygon) so Browse can fitBounds + filter.
 */
import { createPageUrl } from "@/utils";

const HANDOFF_KEY = "browseMapHandoff";
const HANDOFF_TTL_MS = 5 * 60 * 1000;

/** @param {object} payload */
export function storeBrowseHandoff(payload) {
  try {
    sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({ ...payload, savedAt: Date.now() })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @param {{ consume?: boolean }} [opts]
 * @returns {object | null}
 */
export function loadBrowseHandoff({ consume = true } = {}) {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt) || 0;
    if (Date.now() - savedAt > HANDOFF_TTL_MS) {
      sessionStorage.removeItem(HANDOFF_KEY);
      return null;
    }
    if (consume) sessionStorage.removeItem(HANDOFF_KEY);
    return parsed;
  } catch {
    return null;
  }
}

export function clearBrowseHandoff() {
  try {
    sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    /* ignore */
  }
}

/** Heuristic: ZIP, "City, ST", or short text without a leading street number → place. */
export function looksLikePlaceQuery(query) {
  const t = String(query || "").trim();
  if (!t) return false;
  if (/^\d{5}(-\d{4})?$/.test(t)) return true;
  // Leading house number → property address
  if (/^\d+[A-Za-z]?\s+\S/.test(t)) return false;
  // City, ST (optional ZIP)
  if (/^[A-Za-z][A-Za-z\s.'-]*,\s*[A-Za-z]{2}\b/.test(t)) return true;
  // No digits and short → city / neighborhood name
  if (!/\d/.test(t) && t.split(/\s+/).filter(Boolean).length <= 5) return true;
  return false;
}

export function browsePropertyUrl(property) {
  const params = new URLSearchParams();
  const lat = Number(property?.lat);
  const lng = Number(property?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    params.set("lat", String(lat));
    params.set("lng", String(lng));
  }
  params.set("zoom", "16");
  const address =
    property?.formatted_address ||
    [property?.address, property?.city, property?.state, property?.zip].filter(Boolean).join(", ");
  if (address) params.set("highlightAddress", address);
  return `${createPageUrl("BrowseProperties")}?${params.toString()}`;
}

export function browseAreaUrl({ label } = {}) {
  const params = new URLSearchParams();
  params.set("area", "1");
  if (label) params.set("q", String(label).slice(0, 80));
  return `${createPageUrl("BrowseProperties")}?${params.toString()}`;
}

/** Center Browse on the user’s GPS (no city boundary required). */
export function browseLocationUrl({ lat, lng, zoom = 14, label } = {}) {
  const params = new URLSearchParams();
  const la = Number(lat);
  const ln = Number(lng);
  if (Number.isFinite(la) && Number.isFinite(ln)) {
    params.set("lat", String(la));
    params.set("lng", String(ln));
  }
  params.set("zoom", String(Number.isFinite(Number(zoom)) ? zoom : 14));
  if (label) params.set("highlightAddress", String(label).slice(0, 80));
  return `${createPageUrl("BrowseProperties")}?${params.toString()}`;
}

export function storePropertyHandoff(property) {
  const lat = Number(property?.lat);
  const lng = Number(property?.lng);
  storeBrowseHandoff({
    type: "property",
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    zoom: 16,
    address:
      property?.formatted_address ||
      [property?.address, property?.city, property?.state, property?.zip].filter(Boolean).join(", "),
    property,
  });
}

/**
 * Place boundary handoff (Home search, onboarding quiz → Browse).
 * Optional `filters` / `presetId` / `weights` activate browse scoring context
 * without baking location into the saved importance preset.
 * @param {{
 *   ring?: number[][],
 *   label?: string,
 *   lat?: number|null,
 *   lng?: number|null,
 *   filters?: object|null,
 *   presetId?: string|null,
 *   weights?: Record<string, number>|null,
 * }} opts
 */
export function storeBoundaryHandoff({
  ring,
  label,
  lat,
  lng,
  filters = null,
  presetId = null,
  weights = null,
} = {}) {
  storeBrowseHandoff({
    type: "boundary",
    ring: Array.isArray(ring) ? ring : [],
    label: label || "",
    lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
    lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
    filters: filters && typeof filters === "object" ? filters : null,
    presetId: presetId || null,
    weights: weights && typeof weights === "object" ? weights : null,
  });
}

/**
 * Map high importance weights → soft browse auto-score minimums (1–10).
 * Only categories that Browse already supports as score_mins.
 * @param {Record<string, number>} weights
 * @param {{ minImportance?: number, scoreFloor?: number }} [opts]
 * @returns {Record<string, number>}
 */
export function scoreMinsFromImportanceWeights(weights, opts = {}) {
  const minImportance = Number(opts.minImportance) || 8;
  const scoreFloor = Number(opts.scoreFloor) || 6;
  const factorIds = [
    "hospital_distance",
    "schools",
    "public_transportation",
    "neighborhood_safety",
    "location_lifestyle",
    "highway_access",
    "bedroom_count",
    "bathroom_count",
    "overall_living_space",
    "hoa_cost",
    "garage_storage",
  ];
  /** @type {Record<string, number>} */
  const score_mins = {};
  for (const id of factorIds) {
    const w = Number(weights?.[id]);
    if (Number.isFinite(w) && w >= minImportance) {
      score_mins[id] = scoreFloor;
    }
  }
  return score_mins;
}
