import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Loader2, LocateFixed } from "lucide-react";
import { api } from "@/api";
import { getPropertyByAddress } from "@/core/propertyService";
import PropertySearchPreviewDialog from "@/components/property/PropertySearchPreviewDialog";
import {
  browseAreaUrl,
  browseLocationUrl,
  browsePropertyUrl,
  looksLikePlaceQuery,
  storeBoundaryHandoff,
  storePropertyHandoff,
} from "@/lib/browseHandoff";
import { getCurrentPosition } from "@/lib/geolocation";

/**
 * Shared address / place search — Home hero and sticky header.
 * Property match → preview bubble + navigate to Browse map centered on the home.
 * Place (city/ZIP/neighborhood) → Browse map with place boundary polygon active.
 * @param {"hero"|"header"} variant
 */
export default function PropertyAddressSearchForm({ variant = "header", className = "" }) {
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const [property, setProperty] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suppressAutocomplete = useRef("");
  const autocompleteRequest = useRef(0);
  const navTimer = useRef(null);
  const listboxId = useId();
  const isHero = variant === "hero";

  useEffect(() => {
    return () => {
      if (navTimer.current) window.clearTimeout(navTimer.current);
    };
  }, []);

  useEffect(() => {
    const requestId = ++autocompleteRequest.current;
    const value = address.trim();
    if (suppressAutocomplete.current === value) {
      return undefined;
    }
    if (value.length < 3 || !api.property?.autocomplete) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const result = await api.property.autocomplete(value, controller.signal);
        if (controller.signal.aborted || requestId !== autocompleteRequest.current) return;
        setSuggestions(result?.predictions || []);
        setActiveSuggestion(-1);
        setSuggestionsOpen(true);
      } catch (autocompleteError) {
        if (autocompleteError?.name !== "AbortError") setSuggestions([]);
      } finally {
        if (!controller.signal.aborted && requestId === autocompleteRequest.current) setSuggestionsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address]);

  const goToPlaceBoundary = async (rawQuery) => {
    const value = (rawQuery || "").trim();
    if (!value) return;
    if (!api.geo?.boundary) {
      setError("Place search needs the API. Try again in a moment.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const boundary = await api.geo.boundary(value);
      if (!boundary?.ring?.length && !(Number.isFinite(boundary?.lat) && Number.isFinite(boundary?.lng))) {
        setError("Could not find that place. Try a city and state or ZIP.");
        return;
      }
      storeBoundaryHandoff({
        ring: boundary.ring || [],
        label: boundary.label || value,
        lat: boundary.lat,
        lng: boundary.lng,
      });
      navigate(browseAreaUrl({ label: boundary.label || value }));
    } catch (err) {
      setError(err?.message || "Could not load that place. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const searchProperty = async (rawAddress) => {
    const value = (rawAddress || "").trim();
    if (!value) return;

    autocompleteRequest.current += 1;
    suppressAutocomplete.current = value;
    setAddress(value);
    setSuggestionsOpen(false);
    setSuggestions([]);
    setSuggestionsLoading(false);
    setError(null);
    setLoading(true);
    try {
      const data = await getPropertyByAddress(value);
      setProperty(data);
      setPreviewOpen(true);
      storePropertyHandoff(data);
      if (navTimer.current) window.clearTimeout(navTimer.current);
      // Brief preview bubble, then open the interactive map on this home.
      navTimer.current = window.setTimeout(() => {
        navigate(browsePropertyUrl(data));
      }, 700);
    } catch (err) {
      // If address lookup fails but query looks like a place, try boundary.
      if (looksLikePlaceQuery(value)) {
        setLoading(false);
        await goToPlaceBoundary(value);
        return;
      }
      setError(err?.message || "Could not load property. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const searchAddress = async (rawAddress, kindHint) => {
    const value = (rawAddress || "").trim();
    if (!value) return;

    if (kindHint === "place" || (kindHint !== "property" && looksLikePlaceQuery(value))) {
      autocompleteRequest.current += 1;
      suppressAutocomplete.current = value;
      setAddress(value);
      setSuggestionsOpen(false);
      setSuggestions([]);
      await goToPlaceBoundary(value);
      return;
    }
    await searchProperty(value);
  };

  const submit = (e) => {
    e.preventDefault();
    searchAddress(address);
  };

  const useCurrentLocation = async () => {
    if (locating || loading) return;
    setError(null);
    setLocating(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      navigate(browseLocationUrl({ lat, lng, zoom: 14, label: "Current location" }));
    } catch (err) {
      setError(err?.message || "Could not get your location.");
    } finally {
      setLocating(false);
    }
  };

  const chooseSuggestion = (suggestion) => {
    suppressAutocomplete.current = suggestion.address;
    searchAddress(suggestion.address, suggestion.kind);
  };

  const handleInputKeyDown = (event) => {
    if (!suggestionsOpen || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion(current => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion(current => Math.max(current - 1, 0));
    } else if (event.key === "Escape") {
      setSuggestionsOpen(false);
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeSuggestion]);
    }
  };

  const inputClass = isHero
    ? "w-full pl-11 pr-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:border-[#c9a84c] focus:bg-white/15 transition-all text-base"
    : "w-full pl-11 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-300 focus:outline-none focus:border-[#c9a84c] focus:bg-white/15 transition-all text-sm";

  const buttonClass = isHero
    ? "px-6 py-4 bg-[#047857] hover:bg-[#065f46] text-white font-semibold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap"
    : "px-4 py-2.5 bg-[#047857] hover:bg-[#065f46] text-white font-semibold rounded-xl transition-all disabled:opacity-60 flex items-center gap-2 whitespace-nowrap text-sm";

  return (
    <div className={className}>
      <form
        onSubmit={submit}
        className={isHero ? "flex flex-col sm:flex-row items-stretch gap-3" : "flex items-stretch gap-2"}
      >
        <div className={`relative min-w-0 flex-1 ${isHero ? "z-30" : "z-20"}`}>
          <MapPin
            className={`absolute left-4 top-1/2 z-10 -translate-y-1/2 ${isHero ? "text-slate-400" : "text-slate-300"}`}
            size={18}
          />
          <input
            type="text"
            value={address}
            onChange={(e) => {
              suppressAutocomplete.current = "";
              setAddress(e.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => {
              if (suggestions.length > 0 || suggestionsLoading) setSuggestionsOpen(true);
            }}
            onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 180)}
            onKeyDown={handleInputKeyDown}
            placeholder="Address, city, or ZIP…"
            className={inputClass}
            aria-label="Search property address or place"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen && (suggestions.length > 0 || suggestionsLoading)}
            aria-controls={listboxId}
            aria-activedescendant={activeSuggestion >= 0 ? `${listboxId}-${activeSuggestion}` : undefined}
            autoComplete="off"
          />
          {suggestionsOpen && (suggestionsLoading || suggestions.length > 0) && (
            <div
              id={listboxId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white text-left shadow-2xl"
            >
              {suggestionsLoading && suggestions.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                  <Loader2 size={15} className="animate-spin text-[#10b981]" /> Finding matches...
                </div>
              ) : (
                suggestions.map((suggestion, index) => (
                  <button
                    id={`${listboxId}-${index}`}
                    key={suggestion.place_id || suggestion.address}
                    type="button"
                    role="option"
                    aria-selected={index === activeSuggestion}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseSuggestion(suggestion)}
                    className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 ${
                      index === activeSuggestion ? "bg-[#10b981]/10" : "hover:bg-slate-50"
                    }`}
                  >
                    <MapPin size={16} className="mt-0.5 shrink-0 text-[#10b981]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#1a2234]">{suggestion.main_text}</span>
                      <span className="flex items-center gap-2">
                        {suggestion.secondary_text && (
                          <span className="block truncate text-xs text-slate-500">{suggestion.secondary_text}</span>
                        )}
                        {suggestion.kind === "place" && (
                          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Area
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                ))
              )}
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-right text-[10px] font-medium text-slate-400">
                Powered by Google
              </div>
            </div>
          )}
        </div>
        <button type="submit" disabled={loading || locating} className={buttonClass}>
          {loading ? <Loader2 size={isHero ? 18 : 16} className="animate-spin" /> : <Search size={isHero ? 18 : 16} />}
          {loading ? "Searching..." : "Search"}
        </button>
      </form>
      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={locating || loading}
        title="Uses your device location only when you tap, to search homes nearby"
        aria-label="Use current location to search nearby homes"
        className={
          isHero
            ? "mt-2.5 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[#10b981] hover:text-[#34d399] disabled:opacity-60 mx-auto sm:mx-0"
            : "mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-[#10b981] hover:text-[#34d399] disabled:opacity-60"
        }
      >
        {locating ? (
          <Loader2 size={isHero ? 15 : 13} className="animate-spin" />
        ) : (
          <LocateFixed size={isHero ? 15 : 13} />
        )}
        {locating ? "Getting location…" : "Use current location"}
      </button>
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
