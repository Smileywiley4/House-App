/**
 * Human-readable browse/preset filter summaries for chips and selectors.
 * Handles beds/baths stored as string arrays (e.g. ["2"]) from BrowseFilters.
 */

function toNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Compact money: 200000 → "$200K", 1250000 → "$1.3M" */
export function formatCompactPrice(value) {
  const n = toNumber(value);
  if (n == null) return null;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const rounded = m >= 10 ? Math.round(m) : Math.round(m * 10) / 10;
    return `$${rounded}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    const rounded = k >= 100 ? Math.round(k) : Math.round(k * 10) / 10;
    return `$${rounded}K`;
  }
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * Normalize beds/baths which may be number, "2", "5+", or ["2","3"].
 * Returns a short label like "2+" or "2–3" or null.
 */
export function formatBedsOrBaths(value) {
  if (value == null || value === "") return null;
  const list = Array.isArray(value) ? value : [value];
  const parts = list
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    const one = parts[0];
    if (/\+$/.test(one)) return one;
    return `${one}+`;
  }
  const sorted = [...parts].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });
  return `${sorted[0]}–${sorted[sorted.length - 1]}`;
}

/**
 * Build a chip/list label from browse filter object.
 * Example: "2+ beds, $200K–$400K"
 */
export function formatFilterSummary(filters) {
  if (!filters || typeof filters !== "object") return "";
  const parts = [];

  const beds =
    formatBedsOrBaths(filters.beds) ||
    formatBedsOrBaths(filters.beds_min) ||
    formatBedsOrBaths(filters.bedrooms);
  if (beds) parts.push(`${beds} beds`);

  const baths =
    formatBedsOrBaths(filters.baths) ||
    formatBedsOrBaths(filters.baths_min) ||
    formatBedsOrBaths(filters.bathrooms);
  if (baths) parts.push(`${baths} baths`);

  const pmin = filters.price_min ?? filters.budget_min;
  const pmax = filters.price_max ?? filters.budget_max;
  const lo = formatCompactPrice(pmin);
  const hi = formatCompactPrice(pmax);
  if (lo && hi) parts.push(`${lo}–${hi}`);
  else if (lo) parts.push(`${lo}+`);
  else if (hi) parts.push(`up to ${hi}`);

  const sm = filters.score_mins && typeof filters.score_mins === "object" ? filters.score_mins : null;
  if (sm) {
    for (const [k, v] of Object.entries(sm).slice(0, 2)) {
      if (v == null || v === "") continue;
      parts.push(`${String(k).replace(/_/g, " ")} ≥${v}`);
    }
  }

  if (filters.city) {
    const loc = [filters.city, filters.state].filter(Boolean).join(", ");
    if (loc) parts.push(loc);
  } else if (filters.zip) {
    parts.push(String(filters.zip));
  }

  return parts.join(", ");
}

/**
 * Display label for a preset or suggested memory row.
 * Prefer a real user-given name; otherwise format filters.
 */
export function presetDisplayName(item) {
  if (!item) return "Preset";
  const filters = item.filters || {};
  const summary = formatFilterSummary(filters);
  const name = (item.name || "").trim();
  // Suggested/memory rows often have auto labels — always prefer formatted summary.
  if (item.suggested || item.kind === "suggested") {
    return summary || name || "Frequent search";
  }
  // Avoid showing broken auto names like "['2']+ beds, price range"
  if (name && (/\[|'\"\s*\+|price range/i.test(name) || name.includes("['"))) {
    return summary || name;
  }
  if (name && name !== "Frequent search" && name !== "Browse search") {
    return name;
  }
  return summary || name || "Saved search";
}
