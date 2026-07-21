import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { api } from "@/api";
import { cn } from "@/lib/utils";
import { PP_FIELD_SEARCH } from "@/lib/fieldStyles";

/**
 * Debounced address / place autocomplete (Google Places via /api/property/autocomplete).
 * @param {(address: string, suggestion?: object) => void} [onSelect]
 */
export default function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = "Enter address...",
  inputClassName = "",
  ariaLabel = "Property address",
  icon = "pin",
  showKindBadge = false,
  /** When value matches this string, skip fetching (e.g. "Current location"). */
  suppressQuery = "",
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestVersion = useRef(0);
  const suppressValue = useRef("");
  const listboxId = useId();
  const Icon = icon === "search" ? Search : MapPin;

  useEffect(() => {
    const requestId = ++requestVersion.current;
    const query = (value || "").trim();
    if (suppressValue.current === query) return undefined;
    if (suppressQuery && query === String(suppressQuery).trim()) {
      setSuggestions([]);
      setLoading(false);
      setFetchError("");
      setOpen(false);
      return undefined;
    }
    if (query.length < 3 || !api.property?.autocomplete) {
      setSuggestions([]);
      setLoading(false);
      setFetchError("");
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setFetchError("");
      try {
        const result = await api.property.autocomplete(query, controller.signal);
        if (controller.signal.aborted || requestId !== requestVersion.current) return;
        const predictions = result?.predictions || [];
        setSuggestions(predictions);
        setActiveIndex(-1);
        setOpen(true);
        if (predictions.length === 0) {
          setFetchError("No matches found");
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          setSuggestions([]);
          setFetchError("Suggestions unavailable");
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted && requestId === requestVersion.current) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, suppressQuery]);

  const selectSuggestion = (suggestion) => {
    requestVersion.current += 1;
    suppressValue.current = suggestion.address;
    setSuggestions([]);
    setLoading(false);
    setFetchError("");
    setOpen(false);
    onChange(suggestion.address);
    onSelect?.(suggestion.address, suggestion);
  };

  const handleKeyDown = (event) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    }
  };

  const showDropdown =
    open && (loading || suggestions.length > 0 || Boolean(fetchError));

  return (
    <div className="relative flex-1 min-w-0">
      <Icon className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#6B6963]" size={15} />
      <input
        type="text"
        value={value}
        onChange={(event) => {
          suppressValue.current = "";
          onChange(event.target.value);
          setOpen(true);
          setFetchError("");
        }}
        onFocus={() => {
          if (suggestions.length > 0 || loading || fetchError) setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "w-full pl-9 pr-3 py-2.5 rounded-xl text-sm",
          PP_FIELD_SEARCH,
          inputClassName
        )}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        autoComplete="off"
      />

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white text-left shadow-xl"
        >
          {loading && suggestions.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <Loader2 size={15} className="animate-spin text-[#106B49]" /> Finding matches...
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <button
                id={`${listboxId}-${index}`}
                key={suggestion.place_id || suggestion.address}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 ${
                  index === activeIndex ? "bg-[#106B49]/10" : "hover:bg-slate-50"
                }`}
              >
                <MapPin size={16} className="mt-0.5 shrink-0 text-[#106B49]" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#14192E]">
                    {suggestion.main_text}
                  </span>
                  <span className="flex items-center gap-2">
                    {suggestion.secondary_text && (
                      <span className="block truncate text-xs text-slate-500">
                        {suggestion.secondary_text}
                      </span>
                    )}
                    {showKindBadge && suggestion.kind === "place" && (
                      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Area
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500">{fetchError || "No matches found"}</div>
          )}
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-right text-[10px] font-medium text-slate-400">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
