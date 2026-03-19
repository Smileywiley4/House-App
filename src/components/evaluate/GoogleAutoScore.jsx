import { useState } from "react";
import { MapPin, Loader2, Check, RotateCw } from "lucide-react";
import { api } from "@/api";

const SCOREABLE_IDS = new Set([
  "hospital_distance",
  "highway_access",
  "schools",
  "neighborhood_safety",
  "public_transportation",
  "location_lifestyle",
]);

const CATEGORY_DETAIL = {
  hospital_distance: "Hospital distance",
  highway_access: "Infrastructure access",
  schools: "School proximity",
  neighborhood_safety: "Emergency services",
  public_transportation: "Transit access",
  location_lifestyle: "Walkability & amenities",
};

export default function GoogleAutoScore({ address, categories, onApplyScores }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState(null);

  const eligible = categories.filter(c => SCOREABLE_IDS.has(c.id));
  if (eligible.length === 0) return null;

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const data = await api.property.autoscore(address);
      setResult(data);
    } catch (e) {
      setError("Could not auto-score. Google API may not be configured.");
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!result?.scores) return;
    const updates = [];
    for (const cat of eligible) {
      if (result.scores[cat.id] !== undefined) {
        updates.push({ id: cat.id, score: result.scores[cat.id] });
      }
    }
    onApplyScores(updates);
    setApplied(true);
  };

  const rawLabel = (key, val) => {
    if (val === null || val === undefined) return null;
    if (key.endsWith("_mi")) return `${val} mi`;
    return `${val} nearby`;
  };

  return (
    <div className="bg-white border border-blue-200/60 rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-[#1a2234] to-[#1e3a5f] px-5 py-3.5 flex items-center gap-2">
        <MapPin size={15} className="text-blue-400" />
        <span className="text-white font-semibold text-sm">Auto-Score</span>
        <span className="text-[10px] text-blue-300 font-bold bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 rounded-full ml-1">
          Google Data
        </span>
      </div>

      <div className="p-5">
        {!result && !loading && !error && (
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-slate-600 mb-1">
                Automatically score <strong>{eligible.length} categories</strong> using verified Google Maps data — distances to schools, hospitals, transit, and more.
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Scores are based on real distances and never change between searches.
              </p>
              <button
                onClick={run}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition"
              >
                <MapPin size={14} /> Auto-Score with Google
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-2">
            <Loader2 size={18} className="text-blue-500 animate-spin shrink-0" />
            <span className="text-sm text-slate-500">Measuring real distances from Google Maps...</span>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500 py-2">
            {error}
            <button onClick={run} className="ml-2 text-blue-500 hover:underline text-xs font-medium">Retry</button>
          </div>
        )}

        {result && !applied && (
          <div>
            <p className="text-xs text-slate-400 mb-3">Scores based on verified Google Maps distances:</p>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
              {eligible.map(cat => {
                const score = result.scores?.[cat.id];
                if (score === undefined) return null;
                const rawKey = {
                  hospital_distance: "hospital_mi",
                  schools: "school_mi",
                  public_transportation: "transit_mi",
                  location_lifestyle: "grocery_mi",
                  neighborhood_safety: "police_mi",
                  highway_access: "transit_mi",
                }[cat.id];
                const rawVal = rawKey ? result.raw?.[rawKey] : null;
                const detail = rawVal !== null && rawVal !== undefined
                  ? rawLabel(rawKey, rawVal)
                  : null;

                return (
                  <div key={cat.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                    <div className="shrink-0 w-8 text-center">
                      <span className={`text-base font-bold ${score >= 8 ? "text-[#10b981]" : score >= 5 ? "text-[#c9a84c]" : "text-red-400"}`}>
                        {score}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#1a2234]">{cat.label}</div>
                      <div className="text-[10px] text-slate-400">
                        {CATEGORY_DETAIL[cat.id]}{detail ? ` · ${detail}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={apply}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition"
              >
                Apply Scores
              </button>
              <button
                onClick={run}
                className="px-4 py-2.5 border border-slate-200 text-slate-500 font-semibold rounded-xl text-sm hover:bg-slate-50 transition flex items-center gap-1.5"
              >
                <RotateCw size={13} /> Refresh
              </button>
            </div>
          </div>
        )}

        {applied && (
          <div className="flex items-center gap-2 text-sm text-blue-600 font-semibold py-1">
            <Check size={16} /> Google scores applied!
            <button
              onClick={() => { setResult(null); setApplied(false); }}
              className="ml-auto text-xs text-slate-400 hover:text-slate-600 font-normal"
            >
              Re-run
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
