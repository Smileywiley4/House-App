import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { getPropertyByAddress } from "@/core/propertyService";

/**
 * Always-visible search bar (rendered in the global header).
 * Lets users start a new search from any page.
 */
export default function SearchBarTop() {
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const value = (address || "").trim();
    if (!value) return;

    setError(null);
    setLoading(true);
    try {
      const data = await getPropertyByAddress(value);

      const qp = new URLSearchParams();
      qp.set("address", data?.address ?? value);
      if (data?.city) qp.set("city", data.city);
      if (data?.state) qp.set("state", data.state);
      if (data?.price !== null && data?.price !== undefined) qp.set("price", String(data.price));
      if (data?.bedrooms !== null && data?.bedrooms !== undefined) qp.set("beds", String(data.bedrooms));
      if (data?.bathrooms !== null && data?.bathrooms !== undefined) qp.set("baths", String(data.bathrooms));
      if (data?.sqft !== null && data?.sqft !== undefined) qp.set("sqft", String(data.sqft));
      if (data?.year_built !== null && data?.year_built !== undefined) qp.set("year", String(data.year_built));

      navigate(`${createPageUrl("Evaluate")}?${qp.toString()}`);
    } catch (err) {
      setError(err?.message || "Could not load property. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm sm:max-w-2xl mx-auto">
      <form onSubmit={submit} className="flex items-stretch gap-2">
        <div className="flex-1 relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter a property address..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-300 focus:outline-none focus:border-[#c9a84c] focus:bg-white/15 transition-all text-sm"
            aria-label="Search property by address"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-all disabled:opacity-60 flex items-center gap-2 whitespace-nowrap text-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? "Searching..." : "Search"}
        </button>
      </form>
      {error && <p className="text-xs text-red-200 mt-1">{error}</p>}
    </div>
  );
}

