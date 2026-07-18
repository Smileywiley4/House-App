import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { getPropertyByAddress } from "@/core/propertyService";
import { useAuth } from "@/lib/AuthContext";

const PENDING_SEARCH_KEY = "pp_pending_address_search";

/**
 * Shared address search — used in the Home hero and the global header bar.
 * @param {"hero"|"header"} variant
 */
export default function PropertyAddressSearchForm({ variant = "header", className = "" }) {
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isHero = variant === "hero";

  const searchAddress = useCallback(async (value) => {
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
      if (data?.lat != null) qp.set("lat", String(data.lat));
      if (data?.lng != null) qp.set("lng", String(data.lng));

      navigate(`${createPageUrl("Evaluate")}?${qp.toString()}`);
    } catch (err) {
      if (err?.status === 401) {
        sessionStorage.setItem(PENDING_SEARCH_KEY, value);
        navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      setError(err?.message || "Could not load property. Try again.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated) return;
    const pendingAddress = sessionStorage.getItem(PENDING_SEARCH_KEY)?.trim();
    if (!pendingAddress) return;
    sessionStorage.removeItem(PENDING_SEARCH_KEY);
    setAddress(pendingAddress);
    searchAddress(pendingAddress);
  }, [isAuthenticated, isLoadingAuth, searchAddress]);

  const submit = async (e) => {
    e.preventDefault();
    const value = (address || "").trim();
    if (!value) return;

    if (isLoadingAuth) {
      setError("Checking your session. Please try again.");
      return;
    }
    if (!isAuthenticated) {
      sessionStorage.setItem(PENDING_SEARCH_KEY, value);
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    await searchAddress(value);
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
    </div>
  );
}
