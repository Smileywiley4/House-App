import { api } from "@/api";
import { formatFilterSummary, presetDisplayName } from "@/lib/formatFilterSummary";

function normalizeItem(item, kind) {
  const filters = item.filters || {};
  const resolvedKind = item.kind || kind || (item.suggested ? "suggested" : "preset");
  const withKind = { ...item, kind: resolvedKind, filters, suggested: resolvedKind === "suggested" };
  return {
    ...withKind,
    displayName: presetDisplayName(withKind),
    name:
      resolvedKind === "suggested"
        ? formatFilterSummary(filters) || item.name || "Frequent search"
        : (item.name || "").trim() || formatFilterSummary(filters) || "Saved search",
  };
}

/**
 * Unified preset list for Browse + SearchByPreset.
 * Prefers GET /api/browse-prefs/list; falls back to Preset.list + getSuggested.
 *
 * Realtor client-scoped lists only use user_presets for that client_id.
 */
export async function loadUserPresets({ clientId = null } = {}) {
  if (clientId) {
    try {
      const unified = await api.browsePrefs?.list?.({ clientId });
      if (unified?.items || unified?.presets) {
        const items = unified.items || [
          ...(unified.suggestions || []),
          ...(unified.presets || []),
        ];
        return items.map((item) => normalizeItem(item));
      }
    } catch {
      /* fall through */
    }
    const list = await api.entities.Preset.list(clientId).catch(() => []);
    return (Array.isArray(list) ? list : []).map((p) => normalizeItem(p, "preset"));
  }

  try {
    const unified = await api.browsePrefs?.list?.();
    if (unified && (Array.isArray(unified.items) || Array.isArray(unified.presets))) {
      const items = unified.items || [
        ...(unified.suggestions || []),
        ...(unified.presets || []),
      ];
      return items.map((item) => normalizeItem(item));
    }
  } catch {
    /* fall through to dual fetch */
  }

  const [presetList, suggested] = await Promise.all([
    api.entities.Preset.list().catch(() => []),
    api.browsePrefs?.getSuggested?.().catch(() => ({ suggestions: [] })),
  ]);

  const presets = (Array.isArray(presetList) ? presetList : []).map((p) =>
    normalizeItem(p, "preset")
  );
  const suggestions = (suggested?.suggestions || []).map((s) =>
    normalizeItem(s, "suggested")
  );

  const seen = new Set();
  const merged = [];
  for (const item of [...suggestions, ...presets]) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}
