import { useState } from "react";
import { Sparkles, Loader2, Zap } from "lucide-react";
import { api } from "@/api";

/**
 * AIAutoScore - given property info, suggests scores for each active category.
 * Calls onApplyScores(scores: [{id, score}]) when user accepts.
 */
export default function AIAutoScore({ property, categories, onApplyScores }) {
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState(null);
  const [applied, setApplied] = useState(false);

  const addressStr = [property.address, property.city, property.state].filter(Boolean).join(", ");

  const generate = async () => {
    setLoading(true);
    setSuggested(null);
    setApplied(false);

    const categoryList = categories.map(c => `${c.id}: ${c.label}`).join("\n");

    const data = await api.integrations.invokeLLM({
      prompt: `You are a real estate expert evaluating a home for a buyer.

Property: ${addressStr}
Price: ${property.price ? "$" + Number(property.price).toLocaleString() : "unknown"}
Bedrooms: ${property.beds || property.bedrooms || "unknown"}
Bathrooms: ${property.baths || property.bathrooms || "unknown"}
Sq Ft: ${property.sqft || "unknown"}
Year Built: ${property.year || property.year_built || "unknown"}

Research this property and neighborhood using real data. Then score the following evaluation categories from 1-10, where 10 is excellent. Be realistic and data-driven.

Categories to score:
${categoryList}

For each category, provide:
- A score from 1-10
- A short 1-sentence rationale

Return results as a JSON array.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          scores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                score: { type: "number" },
                rationale: { type: "string" }
              }
            }
          }
        }
      }
    });

    setSuggested(data?.scores || []);
    setLoading(false);
  };

  const apply = () => {
    if (!suggested) return;
    onApplyScores(suggested);
    setApplied(true);
  };

  const scoreColor = (s) => {
    if (s >= 8) return "text-[#10b981]";
    if (s >= 5) return "text-[#c9a84c]";
    return "text-red-400";
  };

  return (
    <div className="bg-white border border-[#10b981]/20 rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-[#1a2234] to-[#243050] px-5 py-3.5 flex items-center gap-2">
        <Sparkles size={15} className="text-[#10b981]" />
        <span className="text-white font-semibold text-sm">AI Auto-Score</span>
        <span className="text-[10px] text-[#c9a84c] font-bold bg-[#c9a84c]/10 border border-[#c9a84c]/20 px-2 py-0.5 rounded-full ml-1">Beta</span>
      </div>

      <div className="p-5">
        {!suggested && !loading && (
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-slate-600 mb-3">
                Let AI research this property and auto-fill suggested scores for all your categories based on real neighborhood data.
              </p>
              <button onClick={generate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm transition">
                <Zap size={14} /> Auto-Score with AI
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-2">
            <Loader2 size={18} className="text-[#10b981] animate-spin shrink-0" />
            <span className="text-sm text-slate-500">Researching property data and scoring categories...</span>
          </div>
        )}

        {suggested && !applied && (
          <div>
            <p className="text-xs text-slate-400 mb-3">AI suggested scores — review and apply:</p>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
              {suggested.map(s => {
                const cat = categories.find(c => c.id === s.id);
                if (!cat) return null;
                return (
                  <div key={s.id} className="flex items-start gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                    <div className="shrink-0 w-8 text-center">
                      <span className={`text-base font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#1a2234]">{cat.label}</div>
                      <div className="text-xs text-slate-400">{s.rationale}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={apply}
                className="flex-1 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl text-sm transition">
                Apply All Scores
              </button>
              <button onClick={generate}
                className="px-4 py-2.5 border border-slate-200 text-slate-500 font-semibold rounded-xl text-sm hover:bg-slate-50 transition">
                Retry
              </button>
            </div>
          </div>
        )}

        {applied && (
          <div className="flex items-center gap-2 text-sm text-[#10b981] font-semibold py-1">
            <span>✓</span> Scores applied! Review and adjust as needed.
            <button onClick={() => { setSuggested(null); setApplied(false); }}
              className="ml-auto text-xs text-slate-400 hover:text-slate-600 font-normal">
              Re-run
            </button>
          </div>
        )}
      </div>
    </div>
  );
}