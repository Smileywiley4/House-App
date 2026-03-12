import { useState, useEffect } from "react";
import { api } from "@/api";
import { Sparkles, RefreshCw, Star, TrendingUp, MapPin } from "lucide-react";

/**
 * Analyzes scored properties, identifies what the user values most,
 * then uses AI to find matching properties from the user's saved pool
 * and surface smart recommendations with reasoning.
 */
export default function RecommendationEngine({ scores, weights }) {
  const [recs, setRecs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const topScores = [...scores]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  const generateRecs = async () => {
    if (scores.length === 0) return;
    setLoading(true);
    setError(null);
    setRecs(null);

    // Build a profile summary from top-scored properties + weights
    const weightSummary = Object.entries(weights || {})
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}/10`)
      .join(", ");

    const propSummary = topScores.map(s => {
      const topCats = (s.scores || [])
        .sort((a, b) => (b.score * b.importance) - (a.score * a.importance))
        .slice(0, 4)
        .map(c => `${c.category_label} (${c.score}/10, weight ${c.importance})`)
        .join(", ");
      return `"${s.property_address}" scored ${s.percentage}% — top factors: ${topCats}`;
    }).join("\n");

    const allProps = scores.map(s => ({
      address: s.property_address,
      score: s.percentage,
      topCategories: (s.scores || [])
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(c => c.category_label),
    }));

    try {
      const result = await api.integrations.invokeLLM({
        prompt: `You are a real estate recommendation assistant. Based on a user's scoring history and preferences, identify which of their saved properties are the best match and explain why.

USER'S TOP IMPORTANCE WEIGHTS (0-10 scale):
${weightSummary || "Not set yet"}

USER'S TOP-SCORED PROPERTIES:
${propSummary}

ALL SAVED PROPERTIES (${allProps.length} total):
${JSON.stringify(allProps, null, 2)}

Analyze the patterns: what types of properties score highest for this user? What categories matter most?
Then return 3 recommended properties from the saved list (can include or exclude top scored ones if reasoning is strong).
For each recommendation, give a short compelling reason (1-2 sentences max) — do NOT mention scores, percentages, or math formulas. Focus on what makes the property a great match for this person's lifestyle and priorities.
Also include a brief "What you value most" insight summary (2-3 sentences) about this user's preferences.`,
        response_json_schema: {
          type: "object",
          properties: {
            insight: { type: "string" },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  address: { type: "string" },
                  reason: { type: "string" },
                  match_label: { type: "string" }
                }
              }
            }
          }
        }
      });
      setRecs(result);
    } catch (e) {
      setError("Could not generate recommendations. Please try again.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (scores.length >= 2) generateRecs();
  }, []);

  const scoreColor = (pct) => pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";

  if (scores.length < 2) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <Sparkles size={32} className="mx-auto mb-3 text-slate-200" />
        <p className="font-semibold text-[#1a2234] mb-1">Not enough data yet</p>
        <p className="text-sm text-slate-400">Score at least 2 properties to get personalized recommendations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1a2234]">For You</h2>
          <p className="text-slate-400 text-sm">AI-powered picks based on your scoring patterns</p>
        </div>
        <button
          onClick={generateRecs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Analyzing..." : "Refresh"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
          <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Analyzing your preferences and scoring history…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-sm text-red-500">{error}</div>
      )}

      {/* Results */}
      {recs && !loading && (
        <>
          {/* Insight card */}
          <div className="bg-gradient-to-br from-[#1a2234] to-[#243050] rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#10b981]/20 flex items-center justify-center shrink-0">
                <TrendingUp size={16} className="text-[#10b981]" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-1">Your Buyer Profile</p>
                <p className="text-slate-300 text-sm leading-relaxed">{recs.insight}</p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="grid gap-3">
            {recs.recommendations?.map((rec, i) => {
              const match = scores.find(s => s.property_address === rec.address);
              const pct = match?.percentage;
              return (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: i === 0 ? "rgba(16,185,129,0.12)" : "rgba(26,34,52,0.07)" }}>
                    <Star size={16} style={{ color: i === 0 ? "#10b981" : "#94a3b8" }} fill={i === 0 ? "#10b981" : "none"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-bold text-[#1a2234] text-sm">{rec.address}</p>
                        {rec.match_label && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                            style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                            {rec.match_label}
                          </span>
                        )}
                      </div>
                      {pct !== undefined && (
                        <span className="text-sm font-bold shrink-0" style={{ color: scoreColor(pct) }}>{pct}%</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed flex items-start gap-1.5">
                      <MapPin size={11} className="mt-0.5 shrink-0 text-slate-300" />
                      {rec.reason}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}