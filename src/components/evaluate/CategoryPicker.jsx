import { useState } from "react";
import { Check, X, Search, Plus, PenLine } from "lucide-react";
import { trackCustomCategory } from "@/core/customCategoryTracker";

export const MANDATORY_CATEGORIES = [
  { id: "hospital_distance", label: "Distance to Hospital" },
  { id: "highway_access", label: "Highway Access" },
  { id: "schools", label: "Schools" },
];

export const OPTIONAL_CATEGORIES = [
  { id: "bedroom_count", label: "Bedroom Count" },
  { id: "bathroom_count", label: "Bathroom Count" },
  { id: "overall_living_space", label: "Overall Living Space" },
  { id: "property_tax_cost", label: "Property Tax Cost" },
  { id: "hoa_cost", label: "HOA Cost" },
  { id: "front_yard", label: "Front Yard" },
  { id: "back_yard", label: "Back Yard" },
  { id: "garage_storage", label: "Garage / Storage" },
  { id: "renovation_potential", label: "Renovation Potential" },
  { id: "renovation_costs", label: "Renovation Costs" },
  { id: "living_room_space", label: "Living Room Space" },
  { id: "location_lifestyle", label: "Location for Lifestyle" },
  { id: "location_investment", label: "Location for Investment" },
  { id: "neighborhood_safety", label: "Neighborhood Safety" },
  { id: "motivated_seller", label: "Motivated Seller?" },
  { id: "parking", label: "Parking" },
  { id: "public_transportation", label: "Public Transportation Access" },
  { id: "outdoor_entertainment", label: "Outdoor Entertainment Space" },
  { id: "appliances_included", label: "Appliances Included" },
  { id: "livable_layout", label: "Livable Layout" },
  { id: "landscaping_maturity", label: "Landscaping Maturity" },
  { id: "irrigation_issues", label: "Irrigation Issues" },
  { id: "local_construction", label: "Local Construction" },
  { id: "home_construction_stability", label: "Home Construction Stability" },
  { id: "electrical_issues", label: "Electrical Issues" },
  { id: "plumbing_issues", label: "Plumbing Issues" },
  { id: "sewer_line_age", label: "Sewer Line Age" },
  { id: "insulation", label: "Insulation (Attic, Crawlspace, etc.)" },
  { id: "hvac", label: "HVAC" },
  { id: "fireplace", label: "Fireplace" },
  { id: "roof_quality", label: "Roof Quality" },
  { id: "longterm_neighborhood_value", label: "Long-Term Neighborhood Value" },
  { id: "siding_defects", label: "Siding Defects" },
];

const ALL_BUILTIN_IDS = new Set([
  ...MANDATORY_CATEGORIES.map(c => c.id),
  ...OPTIONAL_CATEGORIES.map(c => c.id),
]);

export default function CategoryPicker({ activeIds, onAdd, onRemove, onClose }) {
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("");

  const ALL_CATEGORIES = [...MANDATORY_CATEGORIES, ...OPTIONAL_CATEGORIES];
  const filtered = ALL_CATEGORIES.filter(
    c => c.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleAddCustom = () => {
    const name = customName.trim();
    if (!name) return;
    const id = "custom_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (activeIds.includes(id)) return;
    const cat = { id, label: name, custom: true };
    trackCustomCategory(name);
    onAdd(cat);
    setCustomName("");
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-[#14192E] text-lg">Add Categories</h2>
            <p className="text-xs text-slate-500 mt-0.5">Select as many as you need. Changes apply instantly.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>

        <>
          <div className="px-6 py-4 border-b border-slate-50 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#106B49]/30 border border-transparent focus:border-[#106B49]"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[#106B49]/20 bg-[#106B49]/5 p-2">
              <PenLine size={16} className="ml-1 shrink-0 text-[#106B49]" />
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                placeholder="Add custom category"
                maxLength={80}
                className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-[#14192E] outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleAddCustom}
                disabled={!customName.trim()}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#106B49] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0C4F37] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-4 py-3">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No matching categories</div>
            ) : (
              <div className="space-y-1">
                {filtered.map(cat => {
                  const isActive = activeIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isActive}
                      onClick={() => isActive ? onRemove(cat.id) : onAdd(cat)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                        isActive ? "bg-[#106B49]/5" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                        isActive
                          ? "border-[#106B49] bg-[#106B49] text-white"
                          : "border-slate-300 bg-white"
                      }`}>
                        {isActive && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className={`text-sm font-medium ${isActive ? "text-[#0C4F37]" : "text-[#14192E]"}`}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-[#14192E] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2A3150]"
            >
              Done
            </button>
          </div>
        </>
      </div>
    </div>
  );
}