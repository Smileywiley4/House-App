import { useState, useEffect } from "react";

/** Form for search filters (budget, beds, baths, sqft, location). Used when creating preset and when searching. */
export default function PresetFiltersForm({ filters = {}, onChange, compact = false }) {
  const [f, setF] = useState(() => ({
    budget_min: filters.budget_min ?? "",
    budget_max: filters.budget_max ?? "",
    beds_min: filters.beds_min ?? "",
    baths_min: filters.baths_min ?? "",
    sqft_min: filters.sqft_min ?? "",
    sqft_max: filters.sqft_max ?? "",
    city: filters.city ?? "",
    state: filters.state ?? "",
    zip: filters.zip ?? "",
  }));

  useEffect(() => {
    setF({
      budget_min: filters.budget_min ?? "",
      budget_max: filters.budget_max ?? "",
      beds_min: filters.beds_min ?? "",
      baths_min: filters.baths_min ?? "",
      sqft_min: filters.sqft_min ?? "",
      sqft_max: filters.sqft_max ?? "",
      city: filters.city ?? "",
      state: filters.state ?? "",
      zip: filters.zip ?? "",
    });
  }, [filters.budget_min, filters.budget_max, filters.beds_min, filters.baths_min, filters.sqft_min, filters.sqft_max, filters.city, filters.state, filters.zip]);

  const update = (key, val) => {
    const next = { ...f, [key]: val };
    setF(next);
    const out = {};
    if (next.budget_min !== "") out.budget_min = Number(next.budget_min) || next.budget_min;
    if (next.budget_max !== "") out.budget_max = Number(next.budget_max) || next.budget_max;
    if (next.beds_min !== "") out.beds_min = Number(next.beds_min) || next.beds_min;
    if (next.baths_min !== "") out.baths_min = Number(next.baths_min) || next.baths_min;
    if (next.sqft_min !== "") out.sqft_min = Number(next.sqft_min) || next.sqft_min;
    if (next.sqft_max !== "") out.sqft_max = Number(next.sqft_max) || next.sqft_max;
    if (next.city) out.city = next.city.trim();
    if (next.state) out.state = next.state.trim();
    if (next.zip) out.zip = next.zip.trim();
    onChange(out);
  };

  const grid = compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={`grid ${grid} gap-4`}>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Budget min ($)</label>
        <input
          type="number"
          placeholder="0"
          value={f.budget_min}
          onChange={(e) => update("budget_min", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Budget max ($)</label>
        <input
          type="number"
          placeholder="∞"
          value={f.budget_max}
          onChange={(e) => update("budget_max", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Beds min</label>
        <input
          type="number"
          min="0"
          placeholder="—"
          value={f.beds_min}
          onChange={(e) => update("beds_min", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Baths min</label>
        <input
          type="number"
          min="0"
          step="0.5"
          placeholder="—"
          value={f.baths_min}
          onChange={(e) => update("baths_min", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Sqft min</label>
        <input
          type="number"
          min="0"
          placeholder="—"
          value={f.sqft_min}
          onChange={(e) => update("sqft_min", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Sqft max</label>
        <input
          type="number"
          min="0"
          placeholder="—"
          value={f.sqft_max}
          onChange={(e) => update("sqft_max", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">City</label>
        <input
          type="text"
          placeholder="e.g. Austin"
          value={f.city}
          onChange={(e) => update("city", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">State</label>
        <input
          type="text"
          placeholder="e.g. TX"
          value={f.state}
          onChange={(e) => update("state", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">ZIP</label>
        <input
          type="text"
          placeholder="—"
          value={f.zip}
          onChange={(e) => update("zip", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
      </div>
    </div>
  );
}
