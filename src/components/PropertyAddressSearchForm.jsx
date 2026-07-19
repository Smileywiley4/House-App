import { useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { getPropertyByAddress } from "@/core/propertyService";
import PropertySearchPreviewDialog from "@/components/property/PropertySearchPreviewDialog";

/**
 * Shared address search — used in the Home hero and the global header bar.
 * @param {"hero"|"header"} variant
 */
export default function PropertyAddressSearchForm({ variant = "header", className = "" }) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [property, setProperty] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const isHero = variant === "hero";

  const submit = async (e) => {
    e.preventDefault();
    const value = (address || "").trim();
    if (!value) return;

    setError(null);
    setLoading(true);
    try {
      const data = await getPropertyByAddress(value);
      setProperty(data);
      setPreviewOpen(true);
    } catch (err) {
      setError(err?.message || "Could not load property. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = isHero
    ? "w-full pl-11 pr-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:border-[#c9a84c] focus:bg-white/15 transition-all text-base"
    : "w-full pl-11 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-300 focus:outline-none focus:border-[#c9a84c] focus:bg-white/15 transition-all text-sm";

  const buttonClass = isHero
    ? "px-6 py-4 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap"
    : "px-4 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-all disabled:opacity-60 flex items-center gap-2 whitespace-nowrap text-sm";

  return (
    <div className={className}>
      <form
        onSubmit={submit}
        className={isHero ? "flex flex-col sm:flex-row items-stretch gap-3" : "flex items-stretch gap-2"}
      >
        <div className="flex-1 relative min-w-0">
          <MapPin
            className={`absolute left-4 top-1/2 -translate-y-1/2 ${isHero ? "text-slate-400" : "text-slate-300"}`}
            size={18}
          />
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter a property address..."
            className={inputClass}
            aria-label="Search property by address"
          />
        </div>
        <button type="submit" disabled={loading} className={buttonClass}>
          {loading ? <Loader2 size={isHero ? 18 : 16} className="animate-spin" /> : <Search size={isHero ? 18 : 16} />}
          {loading ? "Searching..." : "Search"}
        </button>
      </form>
      {error && (
        <p className={`text-xs mt-1.5 ${isHero ? "text-red-300 text-center sm:text-left" : "text-red-200"}`}>
          {error}
        </p>
      )}
      <PropertySearchPreviewDialog
        key={property?.rentcast_id || property?.formatted_address || property?.address || "empty"}
        property={property}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}
