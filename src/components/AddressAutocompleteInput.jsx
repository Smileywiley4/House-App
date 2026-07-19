import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { api } from "@/api";

export default function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = "Enter address...",
  inputClassName = "",
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestVersion = useRef(0);
  const suppressValue = useRef("");
  const listboxId = useId();

  useEffect(() => {
    const requestId = ++requestVersion.current;
    const query = (value || "").trim();
    if (suppressValue.current === query) return undefined;
    if (query.length < 3 || !api.property?.autocomplete) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api.property.autocomplete(query, controller.signal);
        if (controller.signal.aborted || requestId !== requestVersion.current) return;
        setSuggestions(result?.predictions || []);
        setActiveIndex(-1);
        setOpen(true);
      } catch (error) {
        if (error?.name !== "AbortError") setSuggestions([]);
      } finally {
        if (!controller.signal.aborted && requestId === requestVersion.current) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const selectSuggestion = (suggestion) => {
    requestVersion.current += 1;
    suppressValue.current = suggestion.address;
    setSuggestions([]);
    setLoading(false);
    setOpen(false);
    onChange(suggestion.address);
    onSelect?.(suggestion.address);
  };

  const handleKeyDown = (event) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(current => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(current => Math.max(current - 1, 0));
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    }
  };

  return (
    <div className="relative flex-1 min-w-0">
      <MapPin className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" size={15} />
      <input
        type="text"
        value={value}
        onChange={(event) => {
          suppressValue.current = "";
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName}
        role="combobox"
        aria-label="Property address"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        autoComplete="off"
      />

      {open && (loading || suggestions.length > 0) && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xl"
        >
          {loading && suggestions.length === 0 ? (
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
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 ${
                  index === activeIndex ? "bg-[#10b981]/10" : "hover:bg-slate-50"
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
  );
}
