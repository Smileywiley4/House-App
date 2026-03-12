import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Trophy, Home as HomeIcon, LayoutGrid, Columns, Table, AlertCircle } from "lucide-react";

const VIEW_MODES = [
  { id: "columns", label: "Side by Side", icon: Columns },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "table", label: "Table", icon: Table },
];

const scoreColor = (pct) => pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";

export default function SharedComparison() {
  const [scores, setScores] = useState([]);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState("columns");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || window.location.search);
    const data = params.get("data");
    if (!data) { setError(true); return; }
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(data))));
      setScores(decoded);
    } catch {
      setError(true);
    }
  }, []);

  const sorted = [...scores].sort((a, b) => b.percentage - a.percentage);
  const winner = sorted[0];

  const allCategories = [];
  const seen = new Set();
  sorted.forEach(p => {
    (p.scores || []).forEach(cat => {
      if (!seen.has(cat.category_id)) {
        seen.add(cat.category_id);
        allCategories.push({ id: cat.category_id, label: cat.category_label });
      }
    });
  });

  const getScore = (property, catId) => property.scores?.find(s => s.category_id === catId);

  if (error) return (
    <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <AlertCircle size={40} className="mx-auto text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-[#1a2234] mb-2">Invalid Share Link</h2>
        <p className="text-slate-400 text-sm mb-6">This link may be expired or malformed.</p>
        <Link to={createPageUrl("Home")} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#10b981] text-white font-bold rounded-xl text-sm">
          <HomeIcon size={15} /> Go to Property Pulse
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      {/* Header */}
      <div className="bg-[#1a2234] px-6 py-6 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-[#10b981] text-xs font-bold uppercase tracking-widest mb-1">Property Pulse · Shared Comparison</div>
              <h1 className="text-xl font-bold text-white">
                {scores.length} Propert{scores.length !== 1 ? "ies" : "y"} Compared
              </h1>
              <p className="text-slate-400 text-xs mt-0.5">View-only · shared by a Property Pulse user</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-white/10 rounded-xl p-1 gap-1">
                {VIEW_MODES.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setViewMode(id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${viewMode === id ? "bg-[#10b981] text-white" : "text-slate-400 hover:text-white"}`}>
                    <Icon size={14} /><span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
              <Link to={createPageUrl("Home")}
                className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-xs transition">
                Try Property Pulse →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {sorted.length < 1 ? (
          <p className="text-center text-slate-400">No properties found in this share link.</p>
        ) : (
          <>
            {viewMode === "columns" && <ColumnsView comparing={sorted} winner={winner} allCategories={allCategories} getScore={getScore} />}
            {viewMode === "cards" && <CardsView comparing={sorted} winner={winner} />}
            {viewMode === "table" && <TableView comparing={sorted} winner={winner} allCategories={allCategories} getScore={getScore} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── COLUMNS VIEW ─── */
function ColumnsView({ comparing, winner, allCategories, getScore }) {
  return (
    <div>
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `180px repeat(${comparing.length}, 1fr)` }}>
        <div />
        {comparing.map(p => {
          const isWinner = p.id === winner?.id;
          return (
            <div key={p.id} className={`bg-white rounded-2xl border p-5 text-center shadow-sm ${isWinner ? "border-[#10b981]" : "border-slate-100"}`}>
              {isWinner && <div className="flex items-center justify-center gap-1 text-[#10b981] text-xs font-bold mb-2"><Trophy size={12} /> Top Pick</div>}
              <div className="text-sm font-bold text-[#1a2234] leading-tight">{p.property_address?.split(",")[0]}</div>
              <div className="text-xs text-slate-400 mt-0.5">{p.property_address?.split(",").slice(1).join(",").trim()}</div>
              <div className="mt-3 text-3xl font-bold" style={{ color: scoreColor(p.percentage) }}>{p.percentage}%</div>
              <div className="text-[10px] text-slate-400">{p.weighted_total} / {p.max_possible} pts</div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${p.percentage}%`, backgroundColor: scoreColor(p.percentage) }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        {allCategories.map((cat, i) => (
          <div key={cat.id} className={`grid gap-4 rounded-xl p-4 ${i % 2 === 0 ? "bg-white border border-slate-100" : "bg-slate-50"}`}
            style={{ gridTemplateColumns: `180px repeat(${comparing.length}, 1fr)` }}>
            <div className="flex items-center"><span className="text-sm font-semibold text-[#1a2234]">{cat.label}</span></div>
            {comparing.map(p => {
              const s = getScore(p, cat.id);
              if (!s) return <div key={p.id} className="text-center text-slate-300">—</div>;
              const best = comparing.every(op => { const os = getScore(op, cat.id); return !os || s.score >= os.score; });
              return (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <span className={`text-xl font-bold ${best ? "text-[#10b981]" : "text-[#1a2234]"}`}>{s.score}<span className="text-xs text-slate-400">/10</span></span>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#10b981] opacity-60" style={{ width: `${(s.score / 10) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── CARDS VIEW ─── */
function CardsView({ comparing, winner }) {
  return (
    <div className={`grid gap-5 ${comparing.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
      {comparing.map(p => {
        const isWinner = p.id === winner?.id;
        return (
          <div key={p.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isWinner ? "border-[#10b981]" : "border-slate-100"}`}>
            <div className={`px-6 py-5 ${isWinner ? "bg-[#10b981]/5" : ""}`}>
              {isWinner && <div className="flex items-center gap-1 text-[#10b981] text-xs font-bold mb-1"><Trophy size={12} /> Top Pick</div>}
              <h3 className="font-bold text-[#1a2234]">{p.property_address?.split(",")[0]}</h3>
              <p className="text-slate-400 text-xs">{p.property_address?.split(",").slice(1).join(",").trim()}</p>
              <div className="flex items-end gap-2 mt-3">
                <span className="text-4xl font-bold" style={{ color: scoreColor(p.percentage) }}>{p.percentage}%</span>
                <span className="text-xs text-slate-400 mb-1">{p.weighted_total}/{p.max_possible} pts</span>
              </div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${p.percentage}%`, backgroundColor: scoreColor(p.percentage) }} />
              </div>
            </div>
            <div className="px-6 pb-6 pt-2 space-y-2">
              {(p.scores || []).map(cat => {
                const pts = cat.importance * cat.score;
                const max = cat.importance * 10;
                return (
                  <div key={cat.category_id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-xs text-slate-600">{cat.category_label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#10b981]" style={{ width: `${(cat.score / 10) * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold text-[#1a2234] w-8 text-right">{pts}/{max}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── TABLE VIEW ─── */
function TableView({ comparing, winner, allCategories, getScore }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wide w-48">Category</th>
            {comparing.map(p => {
              const isWinner = p.id === winner?.id;
              return (
                <th key={p.id} className={`px-5 py-4 text-center ${isWinner ? "bg-[#10b981]/5" : ""}`}>
                  {isWinner && <div className="flex items-center justify-center gap-1 text-[#10b981] text-[10px] font-bold mb-1"><Trophy size={10} />Top Pick</div>}
                  <div className="text-xs font-bold text-[#1a2234]">{p.property_address?.split(",")[0]}</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: scoreColor(p.percentage) }}>{p.percentage}%</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {allCategories.map((cat, i) => (
            <tr key={cat.id} className={`border-b border-slate-50 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
              <td className="px-5 py-3 font-medium text-[#1a2234] text-xs">{cat.label}</td>
              {comparing.map(p => {
                const s = getScore(p, cat.id);
                if (!s) return <td key={p.id} className="px-5 py-3 text-center text-slate-300 text-xs">—</td>;
                const best = comparing.every(op => { const os = getScore(op, cat.id); return !os || s.score >= os.score; });
                return (
                  <td key={p.id} className="px-5 py-3 text-center">
                    <span className={`text-sm font-bold ${best ? "text-[#10b981]" : "text-slate-600"}`}>{s.score}/10</span>
                    <div className="text-[10px] text-slate-400">wt {s.importance}</div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-[#1a2234]">
            <td className="px-5 py-4 text-xs font-bold text-white">TOTAL SCORE</td>
            {comparing.map(p => (
              <td key={p.id} className="px-5 py-4 text-center">
                <span className="text-lg font-bold" style={{ color: scoreColor(p.percentage) }}>{p.percentage}%</span>
                <div className="text-[10px] text-slate-400">{p.weighted_total}/{p.max_possible} pts</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}