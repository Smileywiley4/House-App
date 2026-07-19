import { useEffect, useId, useRef, useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { api } from "@/api";
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
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suppressAutocomplete = useRef("");
  const autocompleteRequest = useRef(0);
  const listboxId = useId();
  const isHero = variant === "hero";

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

  const searchAddress = async (rawAddress) => {
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
    } catch (err) {
      setError(err?.message || "Could not load property. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    searchAddress(address);
  };

  const chooseSuggestion = (suggestion) => {
    suppressAutocomplete.current = suggestion.address;
    searchAddress(suggestion.address);
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
            onChange={(e) => {
              suppressAutocomplete.current = "";
              setAddress(e.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
            onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
            onKeyDown={handleInputKeyDown}
            placeholder="Enter a property address..."
            className={inputClass}
            aria-label="Search property by address"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen && suggestions.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={activeSuggestion >= 0 ? `${listboxId}-${activeSuggestion}` : undefined}
            autoComplete="off"
          />
          {suggestionsOpen && (suggestionsLoading || suggestions.length > 0) && (
            <div
              id={listboxId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xl"
            >
              {suggestionsLoading && suggestions.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                  <Loader2 size={15} className="animate-spin text-[#10b981]" /> Finding addresses...
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
                      {suggestion.secondary_text && (
                        <span className="block truncate text-xs text-slate-500">{suggestion.secondary_text}</span>
                      )}
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
