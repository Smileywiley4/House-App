import { useCallback, useEffect, useState } from "react";
import { Bell, Bookmark, Loader2, Sparkles, X } from "lucide-react";
import { api } from "@/api";
import { loadUserPresets } from "@/lib/loadUserPresets";
import { presetDisplayName } from "@/lib/formatFilterSummary";

function filtersMeaningful(filters) {
  if (!filters || typeof filters !== "object") return false;
  return Object.entries(filters).some(([k, v]) => {
    if (v == null || v === "" || v === false) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return false;
    if (k === "score_mins" && typeof v === "object") return Object.keys(v).length > 0;
    return true;
  });
}

/**
 * Logged-in browse helpers: suggested/saved presets + save alert from current filters.
 */
export default function BrowsePresetsBar({
  filters,
  onApplyFilters,
  mode,
  center,
  radius,
  placeQuery,
}) {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const [message, setMessage] = useState("");
  const [presetName, setPresetName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await loadUserPresets();
      setPresets(Array.isArray(items) ? items.slice(0, 8) : []);
    } catch {
      setPresets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Soft learning: remember filters after debounce when they change.
  useEffect(() => {
    if (!filtersMeaningful(filters)) return;
    const t = setTimeout(() => {
      api.browsePrefs?.remember?.({ filters }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [filters]);

  const apply = (nextFilters) => {
    onApplyFilters?.(nextFilters || {});
    setMessage("Filters applied");
    setTimeout(() => setMessage(""), 2000);
  };

  const savePreset = async () => {
    const name = (presetName || "").trim() || "Browse search";
    if (!filtersMeaningful(filters)) {
      setMessage("Set some filters first");
      return;
    }
    setSaving(true);
    try {
      await api.entities.Preset.create({ name, weights: {}, filters });
      setPresetName("");
      setShowSave(false);
      setMessage("Preset saved");
      await load();
    } catch (err) {
      setMessage(err?.message || "Could not save preset");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 2500);
    }
  };

  const createAlert = async () => {
    if (!filtersMeaningful(filters) && !placeQuery?.trim()) {
      setMessage("Set filters or a place to alert on");
      return;
    }
    setAlerting(true);
    try {
      const criteria = {
        mode: mode || "for_sale",
        filters: filters || {},
        latitude: center?.lat,
        longitude: center?.lng,
        radius: radius || 8,
      };
      // Best-effort parse "City, ST" from place query for alert geo.
      const q = (placeQuery || "").trim();
      if (q) {
        const parts = q.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          criteria.city = parts[0];
          criteria.state = parts[1].slice(0, 2).toUpperCase();
        } else if (/^\d{5}/.test(q)) {
          criteria.zip = q.slice(0, 5);
        }
      }
      await api.listingAlerts.create({
        name: q ? `Matches near ${q}` : "Browse match alert",
        criteria,
        email_enabled: false,
      });
      setMessage("Alert saved — we'll notify you in-app when matches appear");
      await load();
    } catch (err) {
      setMessage(err?.message || "Could not create alert");
    } finally {
      setAlerting(false);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  if (loading && !presets.length) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 px-1 py-1">
        <Loader2 size={12} className="animate-spin" /> Loading your presets…
      </div>
    );
  }

  const chips = presets;

  return (
    <div className="border-b border-slate-100 bg-white px-4 py-2">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide shrink-0">
            Your presets
          </span>
          {chips.length === 0 ? (
            <span className="text-xs text-slate-400">Use filters often to build suggestions</span>
          ) : (
            chips.slice(0, 6).map((chip) => {
              const label = chip.displayName || presetDisplayName(chip);
              return (
                <button
                  key={`${chip.kind}-${chip.id}`}
                  type="button"
                  onClick={() => apply(chip.filters)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition max-w-[200px] truncate ${
                    chip.kind === "suggested"
                      ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                  title={label}
                >
                  {chip.kind === "suggested" ? <Sparkles size={11} /> : <Bookmark size={11} />}
                  <span className="truncate">{label}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {message && <span className="text-[11px] text-[#059669] font-medium">{message}</span>}
          {showSave ? (
            <div className="flex items-center gap-1">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name"
                className="px-2 py-1 rounded-lg border border-slate-200 text-xs w-32"
              />
              <button
                type="button"
                disabled={saving}
                onClick={savePreset}
                className="px-2.5 py-1 rounded-lg bg-[#1a2234] text-white text-[11px] font-bold disabled:opacity-50"
              >
                {saving ? "…" : "Save"}
              </button>
              <button type="button" onClick={() => setShowSave(false)} className="p-1 text-slate-400" aria-label="Cancel">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSave(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Bookmark size={12} /> Save preset
            </button>
          )}
          <button
            type="button"
            disabled={alerting}
            onClick={createAlert}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#10b981]/40 bg-[#10b981]/10 text-[11px] font-bold text-[#059669] hover:bg-[#10b981]/15 disabled:opacity-50"
          >
            <Bell size={12} /> {alerting ? "Saving…" : "Alert me"}
          </button>
        </div>
      </div>
    </div>
  );
}
