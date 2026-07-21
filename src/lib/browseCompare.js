/**
 * Browse → Side-by-Side compare handoff via sessionStorage.
 * Primary key cleared after successful load; backup kept ~2 min for browser back.
 */
const PRIMARY_KEY = "browseCompareProperties";
const BACKUP_KEY = "browseComparePropertiesBackup";
const BACKUP_TTL_MS = 2 * 60 * 1000;

export function storeBrowseCompareSelection(properties) {
  const list = Array.isArray(properties) ? properties : [];
  const payload = JSON.stringify({ savedAt: Date.now(), properties: list });
  try {
    sessionStorage.setItem(PRIMARY_KEY, payload);
    sessionStorage.setItem(BACKUP_KEY, payload);
  } catch {
    /* ignore */
  }
}

export function loadBrowseCompareSelection({ consume = true } = {}) {
  try {
    const primary = sessionStorage.getItem(PRIMARY_KEY);
    const backup = sessionStorage.getItem(BACKUP_KEY);
    const raw = primary || backup;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt) || 0;
    const props = Array.isArray(parsed?.properties) ? parsed.properties : [];
    if (consume) sessionStorage.removeItem(PRIMARY_KEY);
    if (Date.now() - savedAt > BACKUP_TTL_MS) {
      sessionStorage.removeItem(BACKUP_KEY);
      // Only return if we had a fresh primary read
      if (!primary) return [];
    }
    return props;
  } catch {
    return [];
  }
}

export function clearBrowseCompareSelection() {
  try {
    sessionStorage.removeItem(PRIMARY_KEY);
    sessionStorage.removeItem(BACKUP_KEY);
  } catch {
    /* ignore */
  }
}

/** Map a browse listing into a SideBySide / Compare-shaped score row. */
export function browseListingToCompareRow(p) {
  const address =
    p.formatted_address ||
    p.property_address ||
    [p.address, p.city, p.state, p.zip].filter(Boolean).join(", ") ||
    "Unknown";
  const auto = p.auto_scores && typeof p.auto_scores === "object" ? p.auto_scores : {};
  const scores = Object.entries(auto).map(([id, score]) => ({
    category_id: id,
    category_label: id.replace(/_/g, " "),
    score: Number(score) || 0,
    importance: 5,
  }));
  let percentage = p.overall_percentage;
  if (percentage == null && scores.length) {
    const total = scores.reduce((s, c) => s + c.importance * c.score, 0);
    const max = scores.reduce((s, c) => s + c.importance * 10, 0);
    percentage = max > 0 ? Math.round((total / max) * 100) : 0;
  }
  return {
    id: `browse-${p.id || address}`,
    property_address: address,
    scores,
    percentage: percentage ?? 0,
    weighted_total: 0,
    max_possible: 0,
    _browseSnapshot: p,
    _fromBrowse: true,
  };
}
