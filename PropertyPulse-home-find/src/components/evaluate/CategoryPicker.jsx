import { useState } from "react";
import { X, Search, Plus } from "lucide-react";

export const MANDATORY_CATEGORIES = [
  { id: "hospital_distance", label: "Distance to Hospital", mandatory: true },
  { id: "highway_access", label: "Highway Access", mandatory: true },
  { id: "schools", label: "Schools", mandatory: true },
];

export const OPTIONAL_CATEGORIES = [
  { id: "bedroom_count", label: "Bedroom Count" },
  { id: "bathroom_count", label: "Bathroom Count" },
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

export default function CategoryPicker({ activeIds, onAdd, onClose }) {
  const [query, setQuery] = useState("");

  const filtered = OPTIONAL_CATEGORIES.filter(
    c => !activeIds.includes(c.id) && c.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="font-bold text-[#1a2234] text-lg">Add a Category</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#10b981]/30 border border-transparent focus:border-[#10b981]"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No more categories to add</div>
          ) : (
            <div className="space-y-1">
              {filtered.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => onAdd(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 text-left transition-colors group"
                >
                  <span className="text-sm font-medium text-[#1a2234]">{cat.label}</span>
                  <Plus size={16} className="text-slate-300 group-hover:text-[#10b981] transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}