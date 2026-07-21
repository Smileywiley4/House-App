import { useMemo } from "react";

const BED_OPTS = ["1", "2", "3", "4", "5+"];
const BATH_OPTS = ["1", "2", "3", "4", "5+"];
const PROPERTY_TYPES = [
  { id: "houses", label: "Houses" },
  { id: "townhomes", label: "Townhomes" },
  { id: "apartments", label: "Apartments" },
  { id: "condos", label: "Condos" },
  { id: "multi_family", label: "Multi-Family" },
  { id: "lots", label: "Lots/Land" },
];
const PARKING_OPTS = [
  { value: "", label: "Any" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
];
const SQFT_PRESETS = ["", "500", "750", "1000", "1250", "1500", "1750", "2000", "2500", "3000", "4000", "5000"];
const LOT_PRESETS = ["", "2000", "3000", "4000", "5000", "7500", "10000", "15000", "20000", "43560", "87120"];

/** Auto-score factors available as browse min filters (1–10). */
export const BROWSE_SCORE_FACTORS = [
  { id: "hospital_distance", label: "Hospital proximity" },
  { id: "schools", label: "School proximity" },
  { id: "public_transportation", label: "Transit access" },
  { id: "neighborhood_safety", label: "Emergency services" },
  { id: "location_lifestyle", label: "Walkability & amenities" },
  { id: "highway_access", label: "Infrastructure access" },
  { id: "bedroom_count", label: "Bedroom score" },
  { id: "bathroom_count", label: "Bathroom score" },
  { id: "overall_living_space", label: "Living space score" },
  { id: "hoa_cost", label: "HOA cost score" },
  { id: "garage_storage", label: "Garage score" },
];

function toggleInList(list, value) {
  const next = new Set(list || []);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return [...next];
}

function ChipGroup({ label, options, selected, onChange }) {
  return (
    <div>
      <div className="text-xs font-bold text-slate-700 mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = (selected || []).includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(toggleInList(selected, opt))}
              className={`min-w-[2.5rem] px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                active
                  ? "bg-[#10b981] border-[#10b981] text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScoreMinRow({ label, value, onChange }) {
  const active = value != null && value !== "" && Number(value) > 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-slate-600">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#10b981] tabular-nums">
            {active ? `≥ ${value}/10` : "Any"}
          </span>
          {active && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={active ? Number(value) : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(n <= 0 ? null : n);
        }}
        className="w-full"
        aria-label={`${label} minimum auto-score`}
      />
    </div>
  );
}

/**
 * Browse map filters: price (inputs + dual range), beds/baths chips, property types,
 * HOA, parking, amenities, sqft/lot/year, auto-score mins.
 */
export default function BrowseFilters({ filters, onChange, compact = false }) {
  const f = filters || {};
  const set = (patch) => onChange({ ...f, ...patch });
  const scoreMins = (f.score_mins && typeof f.score_mins === "object" ? f.score_mins : {}) || {};

  const setScoreMin = (id, value) => {
    const next = { ...scoreMins };
    if (value == null) delete next[id];
    else next[id] = value;
    const patched = { ...f };
    if (Object.keys(next).length) patched.score_mins = next;
    else delete patched.score_mins;
    onChange(patched);
  };

  const priceMin = Number(f.price_min ?? f.budget_min ?? 0) || 0;
  const priceMax = Number(f.price_max ?? f.budget_max ?? 2000000) || 2000000;
  const maxBound = 2000000;

  const priceLabel = useMemo(() => {
    const fmt = (n) =>
      n >= 1000000 ? `$${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M` : `$${Math.round(n / 1000)}K`;
    return `${fmt(priceMin)} – ${priceMax >= maxBound ? "Any" : fmt(priceMax)}`;
  }, [priceMin, priceMax]);

  const activeScoreCount = Object.keys(scoreMins).length;

  return (
    <div className={`space-y-5 ${compact ? "text-sm" : ""}`}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-slate-700">Price</div>
          <div className="text-[11px] font-semibold text-[#10b981]">{priceLabel}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            value={f.price_min ?? ""}
            onChange={(e) => set({ price_min: e.target.value === "" ? "" : Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            value={f.price_max ?? ""}
            onChange={(e) => set({ price_max: e.target.value === "" ? "" : Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
        </div>
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={maxBound}
            step={10000}
            value={priceMin}
            onChange={(e) => {
              const v = Number(e.target.value);
              set({ price_min: Math.min(v, priceMax) });
            }}
            className="w-full"
            aria-label="Minimum price"
          />
          <input
            type="range"
            min={0}
            max={maxBound}
            step={10000}
            value={Math.min(priceMax, maxBound)}
            onChange={(e) => {
              const v = Number(e.target.value);
              set({ price_max: Math.max(v, priceMin) });
            }}
            className="w-full"
            aria-label="Maximum price"
          />
        </div>
      </div>

      <ChipGroup
        label="Bedrooms"
        options={BED_OPTS}
        selected={f.beds || []}
        onChange={(beds) => set({ beds })}
      />
      <ChipGroup
        label="Bathrooms"
        options={BATH_OPTS}
        selected={f.baths || []}
        onChange={(baths) => set({ baths })}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-slate-700">Auto-score minimums</div>
          {activeScoreCount > 0 && (
            <span className="text-[11px] font-semibold text-[#10b981]">{activeScoreCount} active</span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Keep homes scoring at least this high (1–10). Location scores use Google Places (cached);
          beds/baths/sqft/HOA/garage use listing data.
        </p>
        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          {BROWSE_SCORE_FACTORS.map((factor) => (
            <ScoreMinRow
              key={factor.id}
              label={factor.label}
              value={scoreMins[factor.id]}
              onChange={(v) => setScoreMin(factor.id, v)}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Property type</div>
        <div className="flex flex-wrap gap-1.5">
          {PROPERTY_TYPES.map((t) => {
            const active = (f.property_types || []).includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => set({ property_types: toggleInList(f.property_types, t.id) })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  active
                    ? "bg-[#1a2234] border-[#1a2234] text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">HOA</div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={Boolean(f.no_hoa)}
            onChange={(e) => set({ no_hoa: e.target.checked })}
            className="rounded border-slate-300"
          />
          Exclude listings with HOA fees
        </label>
      </div>

      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Parking spots</div>
        <select
          value={f.parking_min ?? ""}
          onChange={(e) => set({ parking_min: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          {PARKING_OPTS.map((o) => (
            <option key={o.value || "any"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Must have garage</div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={Boolean(f.must_have_garage)}
            onChange={(e) => set({ must_have_garage: e.target.checked })}
            className="rounded border-slate-300"
          />
          Must have garage
        </label>
      </div>

      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Square feet</div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <select
            value={f.sqft_min ?? ""}
            onChange={(e) => set({ sqft_min: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
          >
            <option value="">No Min</option>
            {SQFT_PRESETS.filter(Boolean).map((v) => (
              <option key={v} value={v}>
                {Number(v).toLocaleString()}+
              </option>
            ))}
          </select>
          <span className="text-slate-300">—</span>
          <select
            value={f.sqft_max ?? ""}
            onChange={(e) => set({ sqft_max: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
          >
            <option value="">No Max</option>
            {SQFT_PRESETS.filter(Boolean).map((v) => (
              <option key={v} value={v}>
                {Number(v).toLocaleString()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Lot size (sqft)</div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <select
            value={f.lot_min ?? ""}
            onChange={(e) => set({ lot_min: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
          >
            <option value="">No Min</option>
            {LOT_PRESETS.filter(Boolean).map((v) => (
              <option key={v} value={v}>
                {Number(v).toLocaleString()}+
              </option>
            ))}
          </select>
          <span className="text-slate-300">—</span>
          <select
            value={f.lot_max ?? ""}
            onChange={(e) => set({ lot_max: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
          >
            <option value="">No Max</option>
            {LOT_PRESETS.filter(Boolean).map((v) => (
              <option key={v} value={v}>
                {Number(v).toLocaleString()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Year built</div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <input
            type="number"
            placeholder="No Min"
            value={f.year_built_min ?? ""}
            onChange={(e) => set({ year_built_min: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <span className="text-slate-300">—</span>
          <input
            type="number"
            placeholder="No Max"
            value={f.year_built_max ?? ""}
            onChange={(e) => set({ year_built_max: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Basement</div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={Boolean(f.has_basement)}
            onChange={(e) => set({ has_basement: e.target.checked })}
            className="rounded border-slate-300"
          />
          Has basement
        </label>
      </div>

      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Number of stories</div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={Boolean(f.single_story_only)}
            onChange={(e) => set({ single_story_only: e.target.checked })}
            className="rounded border-slate-300"
          />
          Single-story only
        </label>
      </div>

      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Other amenities</div>
        <div className="space-y-2">
          {[
            ["must_have_ac", "Must have A/C"],
            ["must_have_pool", "Must have pool"],
            ["waterfront", "Waterfront"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={Boolean(f[key])}
                onChange={(e) => set({ [key]: e.target.checked })}
                className="rounded border-slate-300"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
