import { useState, useEffect } from "react";
import { Bookmark, ChevronDown } from "lucide-react";
import { api } from "@/api";
/** Dropdown to select a preset and load its weights into activeCategories. clientId for realtor client presets. */
export default function PresetPicker({ activeCategories, onLoadPreset, clientId, className = "" }) {
  const [presets, setPresets] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.entities.Preset.list(clientId)
      .then(setPresets)
      .catch(() => setPresets([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  const loadPreset = (preset) => {
    const weights = preset.weights || {};
    const next = activeCategories.map((c) => ({
      ...c,
      importance: weights[c.id] !== undefined ? weights[c.id] : c.importance,
    }));
    onLoadPreset(next, preset.filters || {});
    setOpen(false);
  };

  if (loading || presets.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-[#1a2234] hover:bg-slate-50 transition"
      >
        <Bookmark size={14} />
        Load preset
        <ChevronDown size={14} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl border border-slate-200 shadow-lg py-2 min-w-[200px]">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => loadPreset(p)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition"
              >
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
