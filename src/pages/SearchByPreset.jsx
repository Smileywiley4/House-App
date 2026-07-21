import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, MapPin, Bookmark, Lock, Sparkles, Pencil } from "lucide-react";
import { api } from "@/api";
import { usePlan } from "@/core/hooks/usePlan";
import PresetFiltersForm from "@/components/presets/PresetFiltersForm";
import { ForSaleBadge } from "@/components/ForSaleBadge";
import RequireAuth from "@/components/RequireAuth";
import RenameDialog from "@/components/RenameDialog";
import { loadUserPresets } from "@/lib/loadUserPresets";
import { presetDisplayName } from "@/lib/formatFilterSummary";

export default function SearchByPreset() {
  return (
    <RequireAuth message="Sign in to search by your saved presets">
      <SearchByPresetInner />
    </RequireAuth>
  );
}

function SearchByPresetInner() {
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
  const [renamingPreset, setRenamingPreset] = useState(null);

  useEffect(() => {
    loadUserPresets({ clientId: clientId || null })
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

  const renamePreset = async (name) => {
    if (!renamingPreset?.id || renamingPreset.kind === "suggested") return;
    const updated = await api.entities.Preset.update(renamingPreset.id, { name });
    const nextName = updated?.name || name;
    setPresets((prev) =>
      prev.map((x) =>
        x.id === renamingPreset.id && x.kind !== "suggested"
          ? { ...x, ...(updated || {}), name: nextName, displayName: nextName }
          : x
      )
    );
    if (preset?.id === renamingPreset.id) {
      setPreset((p) => (p ? { ...p, name: nextName, displayName: nextName } : p));
    }
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
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="bg-[#14192E] px-6 py-10">
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
          <h2 className="font-bold text-[#14192E] mb-4 flex items-center gap-2">
            <Bookmark size={18} className="text-[#106B49]" />
            Select preset
          </h2>
          {presets.length === 0 ? (
            <p className="text-slate-500 text-sm">
              No presets yet. Save filters on{" "}
              <Link to={createPageUrl("BrowseProperties")} className="text-[#106B49] font-semibold">
                Search Properties
              </Link>{" "}
              or in{" "}
              <Link to={createPageUrl("Profile")} className="text-[#106B49] font-semibold">
                Profile → Presets
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-6">
              {presets.map((p) => {
                const label = p.displayName || presetDisplayName(p);
                const canRename = p.kind !== "suggested";
                return (
                  <div key={`${p.kind || "preset"}-${p.id}`} className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => loadPreset(p)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
                        preset?.id === p.id
                          ? "bg-[#106B49] text-white"
                          : p.kind === "suggested"
                            ? "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      } ${canRename ? "rounded-r-none" : ""}`}
                      title={label}
                    >
                      {p.kind === "suggested" ? <Sparkles size={14} /> : null}
                      {label}
                    </button>
                    {canRename ? (
                      <button
                        type="button"
                        onClick={() => setRenamingPreset(p)}
                        className={`px-2 py-2 rounded-xl rounded-l-none text-sm transition ${
                          preset?.id === p.id
                            ? "bg-[#0C4F37] text-white hover:bg-[#0a4330]"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-[#106B49]"
                        }`}
                        title="Rename"
                        aria-label={`Rename ${label}`}
                      >
                        <Pencil size={14} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
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
                      className="text-[#106B49]"
                    />
                    <span className="text-sm">Public market (AI suggested)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="source"
                      checked={source === "private"}
                      onChange={() => setSource("private")}
                      className="text-[#106B49]"
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
                className="mt-6 flex items-center gap-2 px-6 py-3 bg-[#106B49] hover:bg-[#0C4F37] text-white font-semibold rounded-xl transition disabled:opacity-60"
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
                <Lock size={16} className="text-[#E8A33D]" />
              ) : (
                <MapPin size={16} className="text-[#106B49]" />
              )}
              <span className="font-semibold text-[#14192E]">
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

      <RenameDialog
        open={!!renamingPreset}
        onOpenChange={(open) => !open && setRenamingPreset(null)}
        title="Rename preset"
        label="Preset name"
        initialValue={renamingPreset?.name || renamingPreset?.displayName || ""}
        onSave={renamePreset}
      />
    </div>
  );
}

function PropertyRow({ property }) {
  const fmt = (n) => n?.toLocaleString() ?? "—";
  return (
    <div className="px-6 py-4 hover:bg-slate-50 transition">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#14192E]">{property.address || "Unknown"}</span>
            <ForSaleBadge onMarket={property.on_market} listingSource={property.listing_source} />
          </div>
          <p className="text-slate-500 text-sm">{property.city}, {property.state} {property.zip}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold text-[#106B49]">${fmt(property.price)}</div>
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
        className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-[#106B49] hover:underline"
      >
        Score this property →
      </Link>
    </div>
  );
}
