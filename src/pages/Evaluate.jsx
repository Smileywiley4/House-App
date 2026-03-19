import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Plus, X, Save, BarChart3, LogIn } from "lucide-react";
import { api } from "@/api";
import CategorySlider from "@/components/evaluate/CategorySlider.jsx";
import CategoryPicker, { MANDATORY_CATEGORIES } from "@/components/evaluate/CategoryPicker.jsx";
import AIAutoScore from "@/components/ai/AIAutoScore.jsx";
import { PremiumGate } from "@/components/PremiumGate";
import { NEIGHBORHOOD_CATEGORIES } from "@/components/evaluate/categories";
import PresetPicker from "@/components/presets/PresetPicker";
import { useAuth } from "@/lib/AuthContext";

export default function Evaluate() {
  const { isAuthenticated } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const property = {
    address: params.get("address") || "Unknown Address",
    city: params.get("city") || "",
    state: params.get("state") || "",
    price: params.get("price") || null,
    beds: params.get("beds") || null,
    baths: params.get("baths") || null,
    sqft: params.get("sqft") || null,
    year: params.get("year") || null,
  };

  const [activeCategories, setActiveCategories] = useState(() => {
    const mandatory = MANDATORY_CATEGORIES.map(c => ({ ...c, importance: 5, score: 5 }));
    const neighborhood = NEIGHBORHOOD_CATEGORIES.map(c => ({ ...c, importance: 5, score: 5 }));
    return [...mandatory, ...neighborhood];
  });
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.auth.me().then(u => {
      const saved = u?.default_weights || {};
      if (Object.keys(saved).length > 0) {
        setActiveCategories(prev => prev.map(c => ({
          ...c,
          importance: saved[c.id] !== undefined ? saved[c.id] : c.importance
        })));
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  const addCategory = (cat) => {
    if (activeCategories.find(c => c.id === cat.id)) return;
    setActiveCategories(prev => [...prev, { ...cat, importance: 5, score: 5 }]);
    setShowPicker(false);
  };

  const removeCategory = (id) => {
    const cat = activeCategories.find(c => c.id === id);
    if (cat?.mandatory) return;
    setActiveCategories(prev => prev.filter(c => c.id !== id));
  };

  const updateImportance = (id, val) => {
    setActiveCategories(prev => prev.map(c => c.id === id ? { ...c, importance: val } : c));
  };

  const updateScore = (id, val) => {
    setActiveCategories(prev => prev.map(c => c.id === id ? { ...c, score: val } : c));
  };

  const weightedTotal = activeCategories.reduce((sum, c) => sum + c.importance * c.score, 0);
  const maxPossible = activeCategories.reduce((sum, c) => sum + c.importance * 10, 0);
  const percentage = maxPossible > 0 ? Math.round((weightedTotal / maxPossible) * 100) : 0;

  const saveScore = async () => {
    setSaving(true);
    await api.entities.PropertyScore.create({
      property_address: `${property.address}, ${property.city}, ${property.state}`,
      scores: activeCategories.map(c => ({
        category_id: c.id,
        category_label: c.label,
        importance: c.importance,
        score: c.score
      })),
      weighted_total: weightedTotal,
      max_possible: maxPossible,
      percentage
    });
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      {/* Header */}
      <div className="bg-[#1a2234] px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <Link to={createPageUrl("Home")} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-4">
            <ChevronLeft size={16} /> Back to Search
          </Link>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{property.address}</h1>
              <p className="text-slate-400">{property.city}, {property.state}</p>
            </div>
            {property.price && (
              <div className="text-right">
                <div className="text-2xl font-bold text-[#c9a84c]">${Number(property.price).toLocaleString()}</div>
                <div className="text-xs text-slate-400">{property.beds}bd · {property.baths}ba · {Number(property.sqft).toLocaleString()} sqft · Built {property.year}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Score Summary */}
      <div className="bg-white border-b border-slate-100 px-6 py-5">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="text-center">
            <div className="text-4xl font-bold text-[#1a2234]">{percentage}<span className="text-xl text-slate-400"> / 100</span></div>
            <div className="text-xs text-slate-400 mt-1">Property Score</div>
            </div>
            <div className="h-12 w-px bg-slate-100" />
            <div className="text-sm text-slate-500">
            <span className="font-semibold text-[#1a2234]">{activeCategories.length}</span> categories
            <div className="text-xs mt-0.5 text-slate-400">Weighted by importance</div>
            </div>
            <div className="flex-1 max-w-xs">
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    background: percentage >= 70 ? "#22c55e" : percentage >= 40 ? "#c9a84c" : "#ef4444"
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {isAuthenticated && (
              <PresetPicker
                activeCategories={activeCategories}
                onLoadPreset={(next) => setActiveCategories(next)}
              />
            )}
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-[#1a2234] font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm border-[#10b981]/30"
            >
              <Plus size={15} /> Add Category
            </button>
            {isAuthenticated ? (
              saved ? (
                <Link
                  to={createPageUrl("Compare")}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-xl text-sm"
                >
                  <BarChart3 size={15} /> View Comparison
                </Link>
              ) : (
                <button
                  onClick={saveScore}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
                >
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
                  {saving ? "Saving..." : "Save Score"}
                </button>
              )
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-colors text-sm"
              >
                <LogIn size={15} /> Sign In to Save
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* AI Auto-Score (Premium) */}
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <PremiumGate featureName="AI Auto-Score">
          <AIAutoScore
            property={property}
            categories={activeCategories}
            onApplyScores={(scores) => {
              setActiveCategories(prev => prev.map(cat => {
                const s = scores.find(x => x.id === cat.id);
                return s ? { ...cat, score: Math.min(10, Math.max(1, Math.round(s.score))) } : cat;
              }));
            }}
          />
        </PremiumGate>
      </div>

      {/* Categories */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {/* Mandatory */}
        <div className="mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Mandatory Categories</span>
        </div>
        {activeCategories.filter(c => c.mandatory).map(cat => (
          <CategorySlider
            key={cat.id}
            category={cat}
            onImportanceChange={updateImportance}
            onScoreChange={updateScore}
            onRemove={removeCategory}
          />
        ))}

        {/* Neighborhood */}
        {activeCategories.filter(c => c.neighborhood).length > 0 && (
          <>
            <div className="mt-6 mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Neighborhood</span>
            </div>
            {activeCategories.filter(c => c.neighborhood).map(cat => (
              <CategorySlider
                key={cat.id}
                category={cat}
                onImportanceChange={updateImportance}
                onScoreChange={updateScore}
                onRemove={removeCategory}
              />
            ))}
          </>
        )}

        {/* Custom */}
        {activeCategories.filter(c => !c.mandatory && !c.neighborhood).length > 0 && (
          <>
            <div className="mt-6 mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Your Categories</span>
            </div>
            {activeCategories.filter(c => !c.mandatory && !c.neighborhood).map(cat => (
              <CategorySlider
                key={cat.id}
                category={cat}
                onImportanceChange={updateImportance}
                onScoreChange={updateScore}
                onRemove={removeCategory}
              />
            ))}
          </>
        )}

        <button
          onClick={() => setShowPicker(true)}
          className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors font-medium flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Add a Category
        </button>
      </div>

      {showPicker && (
        <CategoryPicker
          activeIds={activeCategories.map(c => c.id)}
          onAdd={addCategory}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}