import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, MapPin, Bookmark, Building2, Lock } from "lucide-react";
import { api } from "@/api";
import { usePlan } from "@/core/hooks/usePlan";
import PresetFiltersForm from "@/components/presets/PresetFiltersForm";
import { ForSaleBadge } from "@/components/ForSaleBadge";

export default function SearchByPreset() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("client_id");
  const presetId = searchParams.get("preset_id");
  const urlSource = searchParams.get("source");

  const { plan } = usePlan();
  const isRealtor = plan === "realtor" || plan === "admin";
  const [presets, setPresets] = useState([]);
  const [preset, setPreset] = useState(null);
  const [filters, setFilters] = useState({});
  const [source, setSource] = useState(urlSource === "private" ? "private" : "public");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    api.entities.Preset.list(clientId || null)
      .then((list) => {
        setPresets(list);
        if (presetId && list.length > 0) {
          const p = list.find((x) => x.id === presetId);
          if (p) {
            setPreset(p);
            setFilters(p.filters || {});
          }
        }
      })
      .catch(() => setPresets([]));
  }, [clientId, presetId]);

  const loadPreset = (p) => {
    setPreset(p);
    setFilters(p.filters || {});
  };

  const handleSearch = async () => {
    const f = { ...filters };
    if (!f.city && !f.state && !f.zip) {
      f.city = preset?.filters?.city || "Austin";
      f.state = preset?.filters?.state || "TX";
    }
    setLoading(true);
    setResults(null);
    try {
      const src = isRealtor && source === "private" ? "private" : "public";
      const res = await api.property.searchByCriteria(f, src);
      setResults(res);
    } catch (err) {
      setResults({ source: "public", properties: [], error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const hasLocation = filters.city || filters.state || filters.zip;

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <div className="bg-[#1a2234] px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <Link to={createPageUrl("Home")} className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition">
            ← Back to Search
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Find Properties by Your Preset</h1>
          <p className="text-slate-400 text-sm">
            Use saved preferences to search for matching properties on the public market{isRealtor ? " or in your private listings" : ""}.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Preset selector */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-bold text-[#1a2234] mb-4 flex items-center gap-2">
            <Bookmark size={18} className="text-[#10b981]" />
            Select preset
          </h2>
          {presets.length === 0 ? (
            <p className="text-slate-500 text-sm">
              No presets yet. Save your preferences as a preset in <Link to={createPageUrl("Profile")} className="text-[#10b981] font-semibold">Profile → Presets</Link>.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-6">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => loadPreset(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                    preset?.id === p.id
                      ? "bg-[#10b981] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {preset && (
            <>
              <h3 className="font-semibold text-slate-600 text-sm mb-3">Search filters (from preset)</h3>
              <PresetFiltersForm key={preset?.id || "form"} filters={filters} onChange={setFilters} compact />
              {!hasLocation && (
                <p className="text-amber-600 text-xs mt-3">Add city, state, or ZIP to narrow the search area.</p>
              )}

              {isRealtor && (
                <div className="mt-6 flex items-center gap-4">
                  <span className="text-sm font-medium text-slate-600">Search source:</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="source"
                      checked={source === "public"}
                      onChange={() => setSource("public")}
                      className="text-[#10b981]"
                    />
                    <span className="text-sm">Public market (AI suggested)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="source"
                      checked={source === "private"}
                      onChange={() => setSource("private")}
                      className="text-[#10b981]"
                    />
                    <span className="text-sm flex items-center gap-1">
                      <Lock size={12} /> Private listings
                    </span>
                  </label>
                </div>
              )}

              <button
                onClick={handleSearch}
                disabled={loading}
                className="mt-6 flex items-center gap-2 px-6 py-3 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search size={18} />
                )}
                {loading ? "Searching..." : "Search properties"}
              </button>
            </>
          )}
        </div>

        {/* Results */}
        {results && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              {results.source === "private" ? (
                <Lock size={16} className="text-[#c9a84c]" />
              ) : (
                <MapPin size={16} className="text-[#10b981]" />
              )}
              <span className="font-semibold text-[#1a2234]">
                {results.source === "private" ? "Your private listings" : "Suggested properties on the market"}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {results.properties?.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-500">
                  No matching properties found. Try adjusting your filters.
                </div>
              ) : (
                results.properties?.map((prop, i) => (
                  <PropertyRow key={prop.id || i} property={prop} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyRow({ property }) {
  const fmt = (n) => n?.toLocaleString() ?? "—";
  const addr = [property.address, property.city, property.state].filter(Boolean).join(", ");
  return (
    <div className="px-6 py-4 hover:bg-slate-50 transition">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#1a2234]">{property.address || "Unknown"}</span>
            <ForSaleBadge onMarket={property.on_market} listingSource={property.listing_source} />
          </div>
          <p className="text-slate-500 text-sm">{property.city}, {property.state} {property.zip}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold text-[#10b981]">${fmt(property.price)}</div>
          <div className="text-xs text-slate-400">
            {property.bedrooms}bd · {property.bathrooms}ba · {fmt(property.sqft)} sqft
          </div>
        </div>
      </div>
      {property.description && (
        <p className="text-slate-600 text-sm mt-2 line-clamp-2">{property.description}</p>
      )}
      <Link
        to={createPageUrl("Evaluate") + `?address=${encodeURIComponent(property.address)}&city=${encodeURIComponent(property.city || "")}&state=${encodeURIComponent(property.state || "")}&price=${property.price || ""}&beds=${property.bedrooms || ""}&baths=${property.bathrooms || ""}&sqft=${property.sqft || ""}&year=${property.year_built || ""}`}
        className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-[#10b981] hover:underline"
      >
        Score this property →
      </Link>
    </div>
  );
}
