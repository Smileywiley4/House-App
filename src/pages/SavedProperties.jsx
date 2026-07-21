import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Trash2, Trophy, Home as HomeIcon, Plus } from "lucide-react";
import { api } from "@/api";
import ShareComparison from "@/components/ShareComparison";
import RequireAuth from "@/components/RequireAuth";
import LoadingWithTimeout from "@/components/async/LoadingWithTimeout";
import FetchErrorState from "@/components/async/FetchErrorState";
import EmptyState from "@/components/EmptyState";

export default function SavedProperties() {
  return (
    <RequireAuth message="Sign in to view and manage your saved properties">
      <SavedPropertiesInner />
    </RequireAuth>
  );
}

function SavedPropertiesInner() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadScores();
  }, []);

  const loadScores = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.entities.PropertyScore.list("-created_date");
      setScores(data);
    } catch (e) {
      setError(e?.message || "Could not load saved properties");
      setScores([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteScore = async (id) => {
    await api.entities.PropertyScore.delete(id);
    setScores(prev => prev.filter(s => s.id !== id));
  };

  const sorted = [...scores].sort((a, b) => b.percentage - a.percentage);
  const winner = sorted[0];

  if (loading || (error && scores.length === 0)) {
    return loading ? (
      <LoadingWithTimeout
        isLoading
        onRetry={loadScores}
        fullPage
        label="Loading saved properties…"
        skeleton="cards"
        skeletonRows={4}
      />
    ) : (
      <FetchErrorState
        fullPage
        title="Couldn’t load properties"
        message={error}
        onRetry={loadScores}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="relative overflow-hidden bg-[#14192E] px-6 py-8">
        <div className="absolute inset-0 bg-[#14192E]/75" />
        <div className="relative max-w-5xl mx-auto">
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
                className="flex items-center gap-2 px-4 py-2 bg-[#106B49] hover:bg-[#0C4F37] text-white font-semibold rounded-xl transition-colors text-sm"
              >
                <Plus size={15} /> Add Property
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {scores.length === 0 ? (
          <EmptyState
            icon={HomeIcon}
            title="No properties scored yet"
            description="Search for a property and score it to start comparing."
            actionLabel="Search properties"
            actionTo={createPageUrl("Home")}
          />
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
  const scoreColor = property.percentage >= 70 ? "#106B49" : property.percentage >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow duration-[var(--motion-duration)] ease-[var(--motion-ease)] hover:shadow-md ${isWinner ? "border-[#106B49]" : "border-slate-100"}`}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${isWinner ? "bg-[#106B49] text-white" : "bg-slate-100 text-slate-500"}`}>
              {isWinner ? <Trophy size={22} /> : `#${rank}`}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#14192E]">{property.property_address}</h3>
                {isWinner && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:"rgba(16,185,129,0.1)", color:"#106B49"}}>Top Pick <span style={{color:"#E8A33D"}}>✦</span></span>}
              </div>
              <p className="text-slate-400 text-sm">{property.scores?.length} categories scored</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: scoreColor }}>{property.percentage}%</div>
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
      </div>
    </div>
  );
}