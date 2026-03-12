import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Trash2, Trophy, Home as HomeIcon, Plus } from "lucide-react";
import { api } from "@/api";
import ShareComparison from "@/components/ShareComparison";

export default function Compare() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScores();
  }, []);

  const loadScores = async () => {
    const data = await api.entities.PropertyScore.list("-created_date");
    setScores(data);
    setLoading(false);
  };

  const deleteScore = async (id) => {
    await api.entities.PropertyScore.delete(id);
    setScores(prev => prev.filter(s => s.id !== id));
  };

  const sorted = [...scores].sort((a, b) => b.percentage - a.percentage);
  const winner = sorted[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <div className="bg-[#1a2234] px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <Link to={createPageUrl("Home")} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-4">
            <ChevronLeft size={16} /> Back to Search
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Property Comparison</h1>
              <p className="text-slate-400 text-sm mt-1">{scores.length} propert{scores.length === 1 ? "y" : "ies"} saved</p>
            </div>
            <div className="flex items-center gap-2">
              <ShareComparison scores={sorted} />
              <Link
                to={createPageUrl("Home")}
                className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-colors text-sm"
              >
                <Plus size={15} /> Add Property
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {scores.length === 0 ? (
          <div className="text-center py-24">
            <HomeIcon className="mx-auto text-slate-200 mb-4" size={48} />
            <h2 className="text-xl font-bold text-[#1a2234] mb-2">No properties scored yet</h2>
            <p className="text-slate-400 mb-6">Search for a property and score it to start comparing.</p>
            <Link
              to={createPageUrl("Home")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a2234] text-white font-semibold rounded-xl hover:bg-[#243050] transition-colors"
            >
              Search Properties
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((property, index) => (
              <PropertyScoreCard
                key={property.id}
                property={property}
                rank={index + 1}
                isWinner={property.id === winner?.id}
                onDelete={deleteScore}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyScoreCard({ property, rank, isWinner, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const scoreColor = property.percentage >= 70 ? "#10b981" : property.percentage >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isWinner ? "border-[#10b981]" : "border-slate-100"}`}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${isWinner ? "bg-[#10b981] text-white" : "bg-slate-100 text-slate-500"}`}>
              {isWinner ? <Trophy size={22} /> : `#${rank}`}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#1a2234]">{property.property_address}</h3>
                {isWinner && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:"rgba(16,185,129,0.1)", color:"#10b981"}}>Top Pick <span style={{color:"#c9a84c"}}>✦</span></span>}
              </div>
              <p className="text-slate-400 text-sm">{property.scores?.length} categories scored</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: scoreColor }}>{property.percentage}%</div>
              <div className="text-xs text-slate-400">{property.weighted_total} / {property.max_possible} pts</div>
            </div>
            <button
              onClick={() => onDelete(property.id)}
              className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-red-500 text-slate-300 flex items-center justify-center transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${property.percentage}%`, backgroundColor: scoreColor }}
          />
        </div>

        {/* Expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-slate-400 hover:text-[#10b981] transition-colors font-medium"
        >
          {expanded ? "Hide breakdown ↑" : "Show breakdown ↓"}
        </button>

        {/* Category breakdown */}
        {expanded && property.scores?.length > 0 && (
          <div className="mt-4 grid md:grid-cols-2 gap-2">
            {property.scores.map(cat => {
              const pts = cat.importance * cat.score;
              const max = cat.importance * 10;
              const pct = max > 0 ? (pts / max) * 100 : 0;
              return (
                <div key={cat.category_id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#1a2234] truncate">{cat.category_label}</div>
                    <div className="text-[10px] text-slate-400">Importance: {cat.importance} · Score: {cat.score}</div>
                  </div>
                  <div className="text-xs font-bold text-slate-500 whitespace-nowrap">{pts}/{max}pts</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}