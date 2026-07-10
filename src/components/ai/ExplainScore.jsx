import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { api } from "@/api";
import AiDisclaimer from "@/components/trust/AiDisclaimer";

export default function ExplainScore({ propertyAddress, percentage, categories }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const explain = async () => {
    if (!api.preferences?.explainScore) {
      setError("Explain score requires the Python backend.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.preferences.explainScore({
        property_address: propertyAddress,
        percentage,
        categories: categories.map((c) => ({
          id: c.id,
          label: c.label,
          importance: c.importance,
          score: c.score,
        })),
      });
      setResult(data);
    } catch (e) {
      setError(e?.message || "Could not explain score.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#10b981]" />
          <span className="font-semibold text-sm text-[#1a2234]">Explain my score</span>
        </div>
        <button
          type="button"
          onClick={explain}
          disabled={loading}
          className="text-xs font-semibold text-[#10b981] hover:text-[#059669] disabled:opacity-50 flex items-center gap-1"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          {result ? "Refresh" : "Generate"}
        </button>
      </div>
      {!result && !loading && (
        <div className="px-5 py-4">
          <AiDisclaimer className="mb-0" />
        </div>
      )}
      {loading && (
        <p className="px-5 py-6 text-sm text-slate-500 text-center">Interpreting your weighted score…</p>
      )}
      {error && <p className="px-5 py-3 text-xs text-red-600">{error}</p>}
      {result && !loading && (
        <div className="px-5 py-4 space-y-4 text-sm">
          <p className="text-[#1a2234] leading-relaxed">{result.summary}</p>
          {result.strengths?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Strengths</p>
              <ul className="space-y-1">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-slate-600 flex gap-2"><span className="text-[#10b981]">+</span>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {result.tradeoffs?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Trade-offs</p>
              <ul className="space-y-1">
                {result.tradeoffs.map((s, i) => (
                  <li key={i} className="text-slate-600 flex gap-2"><span className="text-amber-500">−</span>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {result.compare_tip && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">{result.compare_tip}</p>
          )}
        </div>
      )}
    </div>
  );
}
