import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, MapPin, Plus, X, Trophy, ChevronDown, ChevronUp, BarChart3, Loader2, Check } from "lucide-react";
import { getPropertyByAddress } from "@/core/propertyService";
import { MANDATORY_CATEGORIES } from "@/components/evaluate/CategoryPicker";
import { NEIGHBORHOOD_CATEGORIES } from "@/components/evaluate/categories";
import { api } from "@/api";

const DEFAULT_CATEGORIES = () => [
  ...MANDATORY_CATEGORIES.map(c => ({ ...c, importance: 5, score: 5 })),
  ...NEIGHBORHOOD_CATEGORIES.map(c => ({ ...c, importance: 5, score: 5 })),
];

function calcScore(cats) {
  const total = cats.reduce((s, c) => s + c.importance * c.score, 0);
  const max = cats.reduce((s, c) => s + c.importance * 10, 0);
  return max > 0 ? Math.round((total / max) * 100) : 0;
}

function loadIncomingProperty() {
  try {
    const raw = sessionStorage.getItem("compareProperty");
    if (!raw) return null;
    sessionStorage.removeItem("compareProperty");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function QuickCompare() {
  const [panels, setPanels] = useState(() => {
    const incoming = loadIncomingProperty();
    const panel1 = incoming
      ? {
          id: 1,
          address: incoming.property?.address || "",
          property: incoming.property,
          loading: false,
          error: null,
          categories: incoming.categories || DEFAULT_CATEGORIES(),
          expanded: true,
        }
      : { id: 1, address: "", property: null, loading: false, error: null, categories: DEFAULT_CATEGORIES(), expanded: true };

    return [
      panel1,
      { id: 2, address: "", property: null, loading: false, error: null, categories: DEFAULT_CATEGORIES(), expanded: true },
    ];
  });

  const updatePanel = (id, updates) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const searchProperty = async (id) => {
    const panel = panels.find(p => p.id === id);
    if (!panel?.address.trim()) return;
    updatePanel(id, { loading: true, error: null });
    try {
      const data = await getPropertyByAddress(panel.address);
      updatePanel(id, { property: data, loading: false });
    } catch (err) {
      updatePanel(id, { error: err.message || "Could not load property", loading: false });
    }
  };

  const updateScore = (panelId, catId, val) => {
    setPanels(prev => prev.map(p =>
      p.id === panelId
        ? { ...p, categories: p.categories.map(c => c.id === catId ? { ...c, score: val } : c) }
        : p
    ));
  };

  const updateImportance = (panelId, catId, val) => {
    setPanels(prev => prev.map(p =>
      p.id === panelId
        ? { ...p, categories: p.categories.map(c => c.id === catId ? { ...c, importance: val } : c) }
        : p
    ));
  };

  const scores = panels.map(p => calcScore(p.categories));
  const bothScored = panels[0].property && panels[1].property;
  const winner = bothScored ? (scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1) : -1;

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <div className="relative overflow-hidden bg-[#1a2234] px-6 py-12 text-center">
        <div className="absolute inset-0">
          <img src="/banner-compare.png" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#1a2234]/70" />
        </div>
        <div className="relative">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            <BarChart3 className="inline mr-2 text-[#10b981]" size={28} />
            Quick Compare
          </h1>
          <p className="text-slate-400 text-sm">Search two properties, score them, and see which one wins — no account needed.</p>
        </div>
      </div>

      {bothScored && (
        <div className="bg-white border-b border-slate-100 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-6">
            <ScoreBadge label={panels[0].property?.address} score={scores[0]} isWinner={winner === 0} />
            <span className="text-slate-300 font-bold text-lg">vs</span>
            <ScoreBadge label={panels[1].property?.address} score={scores[1]} isWinner={winner === 1} />
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {panels.map((panel, idx) => (
            <PropertyPanel
              key={panel.id}
              panel={panel}
              index={idx}
              score={scores[idx]}
              isWinner={winner === idx}
              onAddressChange={(val) => updatePanel(panel.id, { address: val })}
              onSearch={() => searchProperty(panel.id)}
              onScoreChange={(catId, val) => updateScore(panel.id, catId, val)}
              onImportanceChange={(catId, val) => updateImportance(panel.id, catId, val)}
              onAutoScoreApply={(scoreUpdates) => {
                setPanels(prev => prev.map(p =>
                  p.id === panel.id
                    ? { ...p, categories: p.categories.map(c => {
                        const upd = scoreUpdates.find(u => u.id === c.id);
                        return upd ? { ...c, score: Math.min(10, Math.max(1, upd.score)) } : c;
                      })}
                    : p
                ));
              }}
              onToggleExpand={() => updatePanel(panel.id, { expanded: !panel.expanded })}
              onClear={() => updatePanel(panel.id, { address: "", property: null, error: null, categories: DEFAULT_CATEGORIES(), expanded: true })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ label, score, isWinner }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl ${isWinner ? "bg-[#10b981]/10 border border-[#10b981]/30" : "bg-slate-50 border border-slate-100"}`}>
      {isWinner && <Trophy size={16} className="text-[#c9a84c]" />}
      <div>
        <div className="text-xs text-slate-400 truncate max-w-[140px]">{label}</div>
        <div className={`text-xl font-bold ${isWinner ? "text-[#10b981]" : "text-[#1a2234]"}`}>{score}/100</div>
      </div>
    </div>
  );
}

function PropertyPanel({ panel, index, score, isWinner, onAddressChange, onSearch, onScoreChange, onImportanceChange, onAutoScoreApply, onToggleExpand, onClear }) {
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);

  const colorClass = score >= 70 ? "text-green-500" : score >= 40 ? "text-[#c9a84c]" : "text-red-500";
  const barColor = score >= 70 ? "#22c55e" : score >= 40 ? "#c9a84c" : "#ef4444";

  const runAutoScore = async () => {
    if (!panel.property) return;
    setAutoLoading(true);
    setAutoApplied(false);
    try {
      const addr = [panel.property.address, panel.property.city, panel.property.state].filter(Boolean).join(", ");
      const data = await api.property.autoscore(addr);
      if (data?.scores) {
        const updates = Object.entries(data.scores).map(([id, s]) => ({ id, score: s }));
        onAutoScoreApply(updates);
        setAutoApplied(true);
      }
    } catch { /* ignore */ }
    setAutoLoading(false);
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isWinner ? "border-[#10b981] ring-2 ring-[#10b981]/20" : "border-slate-100"}`}>
      <div className="p-5 bg-[#1a2234]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded-full">
            Property {index + 1}
          </span>
          {isWinner && (
            <span className="text-xs font-bold text-[#c9a84c] bg-[#c9a84c]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Trophy size={10} /> Winner
            </span>
          )}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="flex gap-2">
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={panel.address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="Enter address..."
              className="w-full pl-9 pr-3 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#10b981]"
            />
          </div>
          <button
            type="submit"
            disabled={panel.loading}
            className="px-4 py-3 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center gap-1.5"
          >
            {panel.loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={14} />}
            {panel.loading ? "..." : "Search"}
          </button>
        </form>
        {panel.error && <p className="text-red-400 text-xs mt-2">{panel.error}</p>}
      </div>

      {panel.property && (
        <>
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-[#1a2234] text-base">{panel.property.address}</h3>
                <p className="text-slate-400 text-xs">{panel.property.city}, {panel.property.state} {panel.property.zip}</p>
              </div>
              <button onClick={onClear} className="text-slate-300 hover:text-red-400 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: "Price", value: panel.property.price ? `$${Number(panel.property.price).toLocaleString()}` : "—" },
                { label: "Beds", value: panel.property.bedrooms ?? "—" },
                { label: "Baths", value: panel.property.bathrooms ?? "—" },
                { label: "Sqft", value: panel.property.sqft ? Number(panel.property.sqft).toLocaleString() : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-[#1a2234]">{value}</div>
                  <div className="text-[10px] text-slate-400">{label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <div className={`text-3xl font-bold ${colorClass}`}>{score}<span className="text-base text-slate-400">/100</span></div>
              <div className="flex-1">
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: barColor }} />
                </div>
              </div>
            </div>

            <button
              onClick={runAutoScore}
              disabled={autoLoading}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition disabled:opacity-60"
            >
              {autoLoading ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
              {autoLoading ? "Scoring..." : autoApplied ? <><Check size={13} /> Scored — Run Again</> : "Auto-Score with Google"}
            </button>
          </div>

          <div className="px-5 py-3 border-b border-slate-100">
            <button onClick={onToggleExpand} className="flex items-center gap-2 text-sm font-semibold text-[#10b981] hover:underline w-full">
              {panel.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {panel.expanded ? "Hide" : "Show"} scoring categories ({panel.categories.length})
            </button>
          </div>

          {panel.expanded && (
            <div className="px-4 py-3 space-y-3 max-h-[50vh] overflow-y-auto">
              {panel.categories.map(cat => (
                <CompactSlider
                  key={cat.id}
                  category={cat}
                  onScoreChange={(val) => onScoreChange(cat.id, val)}
                  onImportanceChange={(val) => onImportanceChange(cat.id, val)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!panel.property && !panel.loading && (
        <div className="p-10 text-center text-slate-300">
          <MapPin size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Search an address to start scoring</p>
        </div>
      )}
    </div>
  );
}

function CompactSlider({ category, onScoreChange, onImportanceChange }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="mb-2">
        <span className="text-xs font-semibold text-[#1a2234]">{category.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-400">Importance</span>
            <span className="font-bold text-[#10b981]">{category.importance}/10</span>
          </div>
          <input
            type="range" min="0" max="10" value={category.importance}
            onChange={(e) => onImportanceChange(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{ background: `linear-gradient(to right, #10b981 ${category.importance * 10}%, #e2e8f0 ${category.importance * 10}%)` }}
          />
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-400">Score</span>
            <span className="font-bold text-[#1a2234]">{category.score}/10</span>
          </div>
          <input
            type="range" min="0" max="10" value={category.score}
            onChange={(e) => onScoreChange(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{ background: `linear-gradient(to right, #1a2234 ${category.score * 10}%, #e2e8f0 ${category.score * 10}%)` }}
          />
        </div>
      </div>
    </div>
  );
}
