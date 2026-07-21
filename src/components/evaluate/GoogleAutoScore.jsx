import { useState } from "react";
import { MapPin, Loader2, Check, RotateCw, Sparkles } from "lucide-react";
import { api } from "@/api";

const SCOREABLE_IDS = new Set([
  "hospital_distance",
  "highway_access",
  "schools",
  "neighborhood_safety",
  "public_transportation",
  "location_lifestyle",
  "location_investment",
  "longterm_neighborhood_value",
  "bedroom_count",
  "bathroom_count",
  "overall_living_space",
  "property_tax_cost",
  "hoa_cost",
  "garage_storage",
  "fireplace",
]);
const LOCATION_SCORE_IDS = new Set([
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
  location_investment: "Recorded sale-price trend",
  longterm_neighborhood_value: "Recorded sale-price trend",
  bedroom_count: "Recorded bedroom count",
  bathroom_count: "Recorded bathroom count",
  overall_living_space: "Recorded total living area",
  property_tax_cost: "Taxes relative to assessed value",
  hoa_cost: "Recorded monthly HOA fee",
  garage_storage: "Recorded garage availability",
  fireplace: "Recorded fireplace availability",
};

export default function GoogleAutoScore({ address, property, categories, onApplyScores }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState(null);

  const propertyFactAvailable = {
    location_investment: (property?.sale_history?.length || 0) >= 2,
    longterm_neighborhood_value: (property?.sale_history?.length || 0) >= 2,
    bedroom_count: property?.beds != null || property?.bedrooms != null,
    bathroom_count: property?.baths != null || property?.bathrooms != null,
    overall_living_space: property?.sqft != null,
    property_tax_cost: property?.annual_taxes != null && property?.tax_assessment != null,
    hoa_cost: property?.hoa_fee != null,
    garage_storage: property?.features?.garage != null,
    fireplace: property?.features?.fireplace != null,
  };
  const eligible = categories.filter(
    c => SCOREABLE_IDS.has(c.id) && (LOCATION_SCORE_IDS.has(c.id) || propertyFactAvailable[c.id]),
  );
  if (eligible.length === 0) return null;

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const data = await api.property.autoscore(address, property);
      setResult(data);
    } catch (e) {
      let msg = e?.message || (typeof e === "string" ? e : "") || "Could not auto-score.";
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.detail) msg = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
      } catch {
        /* plain text error */
      }
      if (e?.status === 503 && !msg.includes("GOOGLE_PLACES") && !msg.includes("Geocoding")) {
        msg = `${msg} (Check GOOGLE_PLACES_API_KEY + Geocoding API + Places API in GCP.)`;
      }
      setError(msg);
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
      <div className="bg-gradient-to-r from-[#14192E] to-[#1e3a5f] px-5 py-3.5 flex items-center gap-2">
        <MapPin size={15} className="text-blue-400" />
        <span className="text-white font-semibold text-sm">Auto-Score</span>
      </div>

      <div className="p-5">
        {!result && !loading && !error && (
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-slate-600 mb-1">
                Automatically score <strong>{eligible.length} categories</strong> using verified property records and location data.
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Scores use recorded facts and consistent formulas. Review and adjust them for your needs.
              </p>
              <button
                onClick={run}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition"
              >
                <MapPin size={14} /> Auto-Score Property
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-2">
            <Loader2 size={18} className="text-blue-500 animate-spin shrink-0" />
            <span className="text-sm text-slate-500">Analyzing property facts and nearby services...</span>
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
            <p className="text-xs text-slate-400 mb-3">Suggested scores based on available verified facts:</p>
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
                const factDetail = result.facts?.[cat.id]?.value;
                const detail = factDetail || (rawVal !== null && rawVal !== undefined
                  ? rawLabel(rawKey, rawVal)
                  : null);

                return (
                  <div key={cat.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                    <div className="shrink-0 w-8 text-center">
                      <span className={`text-base font-bold ${score >= 8 ? "text-[#106B49]" : score >= 5 ? "text-[#E8A33D]" : "text-red-400"}`}>
                        {score}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#14192E]">{cat.label}</div>
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
          <div className="rounded-xl border border-[#106B49]/20 bg-gradient-to-r from-[#106B49]/8 to-[#E8A33D]/8 p-4">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#106B49] text-white shadow-sm">
                <Check size={18} strokeWidth={3} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#14192E]">Auto-scores applied</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Added another supported category? Re-run Auto-Score to calculate and apply its score.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={run}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14192E] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#2A3150] hover:shadow-md"
            >
              <RotateCw size={17} className="text-[#E8A33D]" />
              Re-run Auto-Score
              <Sparkles size={15} className="text-[#106B49]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
