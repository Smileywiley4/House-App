import { useState } from "react";
import { Sparkles, MapPin, School, Heart, Car, ShoppingBag, Trees, TrendingUp, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/api";

export default function AIPropertyInsights({ property }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const addressStr = [property.address, property.city, property.state, property.zip]
    .filter(Boolean).join(", ");

  const generate = async () => {
    setLoading(true);
    const data = await api.integrations.invokeLLM({
      prompt: `You are a real estate intelligence assistant. Analyze the property at "${addressStr}" and provide detailed, buyer-focused insights.

Property details:
- Price: ${property.price ? "$" + Number(property.price).toLocaleString() : "unknown"}
- Bedrooms: ${property.bedrooms || property.beds || "unknown"}
- Bathrooms: ${property.bathrooms || property.baths || "unknown"}
- Sq Ft: ${property.sqft || "unknown"}
- Year Built: ${property.year_built || property.year || "unknown"}

Research this neighborhood using real data sources like NeighborhoodScout, WalkScore, GreatSchools, and local government data. Provide:

1. An engaging 3-4 sentence property description highlighting key lifestyle benefits, neighborhood character, and investment appeal for buyers.
2. Proximity scores and details for: hospitals, schools, highways, grocery stores, parks, restaurants.
3. Neighborhood quality scores (0-10) for: safety/crime, school quality, walkability, transit access, family friendliness, investment potential.
4. 3-5 buyer highlights (short bullet points about what makes this location great).
5. One honest "watch out" or consideration for buyers.

Be specific with real place names when possible. Write descriptions in second-person ("you'll love...") to engage buyers emotionally.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          description: { type: "string" },
          proximity: {
            type: "object",
            properties: {
              hospitals: { type: "string" },
              schools: { type: "string" },
              highways: { type: "string" },
              grocery: { type: "string" },
              parks: { type: "string" },
              restaurants: { type: "string" }
            }
          },
          neighborhood_scores: {
            type: "object",
            properties: {
              safety: { type: "number" },
              schools: { type: "number" },
              walkability: { type: "number" },
              transit: { type: "number" },
              family_friendly: { type: "number" },
              investment_potential: { type: "number" }
            }
          },
          buyer_highlights: { type: "array", items: { type: "string" } },
          watch_out: { type: "string" }
        }
      }
    });
    setInsights(data);
    setLoading(false);
  };

  const scoreColor = (s) => {
    if (s >= 8) return "text-[#10b981]";
    if (s >= 6) return "text-[#c9a84c]";
    return "text-red-400";
  };

  const scoreBg = (s) => {
    if (s >= 8) return "bg-[#10b981]";
    if (s >= 6) return "bg-[#c9a84c]";
    return "bg-red-400";
  };

  const PROXIMITY_ICONS = {
    hospitals: "🏥",
    schools: "🎓",
    highways: "🛣️",
    grocery: "🛒",
    parks: "🌳",
    restaurants: "🍽️"
  };

  const SCORE_LABELS = {
    safety: "Safety",
    schools: "Schools",
    walkability: "Walkability",
    transit: "Transit",
    family_friendly: "Family-Friendly",
    investment_potential: "Investment"
  };

  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden mt-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a2234] to-[#243050] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#10b981]" />
          <span className="text-white font-semibold text-sm">AI Property Insights</span>
          <span className="text-[10px] text-[#c9a84c] font-bold bg-[#c9a84c]/10 border border-[#c9a84c]/20 px-2 py-0.5 rounded-full">Powered by AI</span>
        </div>
        {insights && (
          <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-white transition">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {/* Generate button */}
      {!insights && !loading && (
        <div className="bg-white px-5 py-6 text-center">
          <p className="text-slate-500 text-sm mb-4">
            Get AI-powered neighborhood analysis, proximity scores, and an engaging buyer description for this property.
          </p>
          <button onClick={generate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm transition">
            <Sparkles size={15} /> Generate AI Insights
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white px-5 py-8 flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-[#10b981] animate-spin" />
          <p className="text-slate-500 text-sm">Researching neighborhood data, schools, amenities...</p>
        </div>
      )}

      {/* Results */}
      {insights && expanded && (
        <div className="bg-white divide-y divide-slate-50">
          {/* Description */}
          <div className="px-5 py-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">AI-Generated Description</h3>
            <p className="text-[#1a2234] text-sm leading-relaxed">{insights.description}</p>
          </div>

          {/* Buyer Highlights */}
          {insights.buyer_highlights?.length > 0 && (
            <div className="px-5 py-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Why Buyers Love This Location</h3>
              <ul className="space-y-2">
                {insights.buyer_highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="text-[#10b981] mt-0.5 shrink-0">✓</span> {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Neighborhood Scores */}
          {insights.neighborhood_scores && (
            <div className="px-5 py-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Neighborhood Scores</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(insights.neighborhood_scores).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500">{SCORE_LABELS[key] || key}</span>
                      <span className={`text-sm font-bold ${scoreColor(val)}`}>{val}/10</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${scoreBg(val)} transition-all`} style={{ width: `${val * 10}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proximity */}
          {insights.proximity && (
            <div className="px-5 py-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Nearby Amenities</h3>
              <div className="grid md:grid-cols-2 gap-2">
                {Object.entries(insights.proximity).map(([key, val]) => (
                  <div key={key} className="flex items-start gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5">
                    <span className="text-base">{PROXIMITY_ICONS[key] || "📍"}</span>
                    <div>
                      <div className="text-xs font-semibold text-slate-400 capitalize">{key.replace("_", " ")}</div>
                      <div className="text-xs text-[#1a2234] font-medium">{val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Watch Out */}
          {insights.watch_out && (
            <div className="px-5 py-4 bg-amber-50/50">
              <div className="flex items-start gap-2">
                <span className="text-amber-500 text-sm shrink-0">⚠️</span>
                <div>
                  <span className="text-xs font-bold text-amber-700 block mb-0.5">Buyer's Note</span>
                  <span className="text-xs text-amber-700">{insights.watch_out}</span>
                </div>
              </div>
            </div>
          )}

          {/* Regenerate */}
          <div className="px-5 py-3">
            <button onClick={generate} className="text-xs text-slate-400 hover:text-[#10b981] transition flex items-center gap-1">
              <Sparkles size={11} /> Regenerate insights
            </button>
          </div>
        </div>
      )}
    </div>
  );
}