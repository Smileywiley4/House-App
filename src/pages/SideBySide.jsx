import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Trophy, LayoutGrid, Columns, Table, Lock } from "lucide-react";
import { api } from "@/api";
import { usePlan } from "@/core/hooks/usePlan";
import ShareComparison from "@/components/ShareComparison";
import RequireAuth from "@/components/RequireAuth";

// View mode toggle options
const VIEW_MODES = [
  { id: "columns", label: "Side by Side", icon: Columns },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "table", label: "Table", icon: Table },
];

export default function SideBySide() {
  return (
    <RequireAuth message="Sign in to compare properties side by side">
      <SideBySideInner />
    </RequireAuth>
  );
}

function SideBySideInner() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("columns");
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    api.entities.PropertyScore.list("-created_date").then(data => {
      setScores(data);
      setSelected(data.slice(0, 2).map(s => s.id));
      setLoading(false);
    });
  }, []);

  const comparing = scores.filter(s => selected.includes(s.id));
  const sorted = [...comparing].sort((a, b) => b.percentage - a.percentage);
  const winner = sorted[0];

  // Collect all unique category labels across compared properties
  const allCategories = [];
  const seen = new Set();
  comparing.forEach(p => {
    (p.scores || []).forEach(cat => {
      if (!seen.has(cat.category_id)) {
        seen.add(cat.category_id);
        allCategories.push({ id: cat.category_id, label: cat.category_label });
      }
    });
  });

  const { maxCompareCount } = usePlan();
  const getScore = (property, catId) => property.scores?.find(s => s.category_id === catId);
  const scoreColor = (pct) => pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      {/* Header */}
      <div className="relative overflow-hidden bg-[#1a2234] px-6 py-6 sticky top-[112px] sm:top-14 z-30">
        <div className="absolute inset-0">
          <img src="/banner-pricing.png" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#1a2234]/80" />
        </div>
        <div className="relative max-w-6xl mx-auto">
          <Link to={createPageUrl("Compare")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition">
            <ChevronLeft size={16} /> Back to Properties
          </Link>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-xl font-bold text-white">Side-by-Side Comparison</h1>

            <div className="flex items-center gap-2">
              <ShareComparison scores={comparing} />
              {/* View mode toggle */}
              <div className="flex bg-white/10 rounded-xl p-1 gap-1">
              {VIEW_MODES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    viewMode === id ? "bg-[#10b981] text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
              </div>
            </div>
          </div>

          {/* Property selector */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {scores.map(s => {
              const isSelected = selected.includes(s.id);
              const isDisabled = !isSelected && selected.length >= maxCompareCount;
              return (
                <button
                  key={s.id}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isSelected) setSelected(prev => prev.filter(id => id !== s.id));
                    else setSelected(prev => [...prev, s.id]);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isSelected
                      ? "bg-[#10b981] border-[#10b981] text-white"
                      : isDisabled
                      ? "border-white/10 text-slate-600 cursor-not-allowed"
                      : "border-white/20 text-slate-300 hover:border-[#10b981]/50"
                  }`}
                  title={isDisabled ? `Free plan: compare up to ${maxCompareCount} properties. Upgrade for more.` : ""}
                >
                  {s.property_address?.split(",")[0]}
                  {isDisabled && <Lock size={10} className="inline ml-1 opacity-50" />}
                </button>
              );
            })}
          </div>

          {maxCompareCount === 2 && selected.length >= 2 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-[#c9a84c]">
              <Lock size={12} />
              Comparing 3+ properties is a <Link to={createPageUrl("Pricing")} className="underline font-semibold">Premium feature</Link>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {comparing.length < 2 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-lg font-semibold text-[#1a2234] mb-2">Select at least 2 properties above</p>
            <p className="text-sm">Choose which homes to compare using the buttons in the header.</p>
          </div>
        ) : (
          <>
            {viewMode === "columns" && <ColumnsView comparing={sorted} winner={winner} allCategories={allCategories} getScore={getScore} scoreColor={scoreColor} />}
            {viewMode === "cards" && <CardsView comparing={sorted} winner={winner} allCategories={allCategories} getScore={getScore} scoreColor={scoreColor} />}
            {viewMode === "table" && <TableView comparing={sorted} winner={winner} allCategories={allCategories} getScore={getScore} scoreColor={scoreColor} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── COLUMNS VIEW (Nerdwallet-style) ─── */
function ColumnsView({ comparing, winner, allCategories, getScore, scoreColor }) {
  return (
    <div>
      {/* Header cards */}
      <div className={`grid gap-4 mb-6`} style={{ gridTemplateColumns: `200px repeat(${comparing.length}, 1fr)` }}>
        <div />
        {comparing.map(p => {
          const isWinner = p.id === winner?.id;
          return (
            <div key={p.id} className={`bg-white rounded-2xl border p-5 text-center shadow-sm ${isWinner ? "border-[#10b981]" : "border-slate-100"}`}>
              {isWinner && (
                <div className="flex items-center justify-center gap-1 text-[#10b981] text-xs font-bold mb-2">
                  <Trophy size={12} /> Top Pick <span className="text-[#c9a84c]">✦</span>
                </div>
              )}
              <div className="text-sm font-bold text-[#1a2234] leading-tight">{p.property_address?.split(",")[0]}</div>
              <div className="text-xs text-slate-400 mt-0.5">{p.property_address?.split(",").slice(1).join(",").trim()}</div>
              <div className="mt-3 text-3xl font-bold" style={{ color: scoreColor(p.percentage) }}>{p.percentage}%</div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${p.percentage}%`, backgroundColor: scoreColor(p.percentage) }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Category rows */}
      <div className="space-y-2">
        {allCategories.map((cat, i) => (
          <div key={cat.id} className={`grid gap-4 rounded-xl p-4 ${i % 2 === 0 ? "bg-white border border-slate-100" : "bg-slate-50"}`}
            style={{ gridTemplateColumns: `200px repeat(${comparing.length}, 1fr)` }}>
            {/* Label */}
            <div className="flex items-center">
              <span className="text-sm font-semibold text-[#1a2234]">{cat.label}</span>
            </div>
            {/* Scores per property */}
            {comparing.map(p => {
              const s = getScore(p, cat.id);
              if (!s) return <div key={p.id} className="text-center text-slate-300 text-sm">—</div>;
              const best = comparing.every(op => {
                const os = getScore(op, cat.id);
                if (!os) return true;
                return s.score >= os.score;
              });
              return (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <div className={`text-xl font-bold ${best ? "text-[#10b981]" : "text-[#1a2234]"}`}>
                    {s.score}<span className="text-xs text-slate-400">/10</span>
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
function CardsView({ comparing, winner, allCategories, getScore, scoreColor }) {
  return (
    <div className={`grid gap-5 ${comparing.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
      {comparing.map(p => {
        const isWinner = p.id === winner?.id;
        return (
          <div key={p.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isWinner ? "border-[#10b981]" : "border-slate-100"}`}>
            <div className={`px-6 py-5 ${isWinner ? "bg-[#10b981]/5" : ""}`}>
              {isWinner && (
                <div className="flex items-center gap-1 text-[#10b981] text-xs font-bold mb-1">
                  <Trophy size={12} /> Top Pick
                </div>
              )}
              <h3 className="font-bold text-[#1a2234] text-base">{p.property_address?.split(",")[0]}</h3>
              <p className="text-slate-400 text-xs">{p.property_address?.split(",").slice(1).join(",").trim()}</p>
              <div className="flex items-end gap-2 mt-3">
                <span className="text-4xl font-bold" style={{ color: scoreColor(p.percentage) }}>{p.percentage}%</span>
              </div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${p.percentage}%`, backgroundColor: scoreColor(p.percentage) }} />
              </div>
            </div>
            <div className="px-6 pb-6 pt-2 space-y-2">
              {(p.scores || []).map(cat => (
                  <div key={cat.category_id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-xs text-slate-600">{cat.category_label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#10b981]" style={{ width: `${(cat.score / 10) * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold text-[#1a2234] w-8 text-right">{cat.score}/10</span>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── TABLE VIEW ─── */
function TableView({ comparing, winner, allCategories, getScore, scoreColor }) {
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
                  <div className="text-xs font-bold text-[#1a2234] leading-tight">{p.property_address?.split(",")[0]}</div>
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
                const best = comparing.every(op => {
                  const os = getScore(op, cat.id);
                  return !os || s.score >= os.score;
                });
                return (
                  <td key={p.id} className="px-5 py-3 text-center">
                    <span className={`text-sm font-bold ${best ? "text-[#10b981]" : "text-slate-600"}`}>{s.score}/10</span>
                  </td>
                );
              })}
            </tr>
          ))}
          {/* Total row */}
          <tr className="bg-[#1a2234]">
            <td className="px-5 py-4 text-xs font-bold text-white">TOTAL SCORE</td>
            {comparing.map(p => (
              <td key={p.id} className="px-5 py-4 text-center">
                <span className="text-lg font-bold" style={{ color: scoreColor(p.percentage) }}>{p.percentage}%</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}