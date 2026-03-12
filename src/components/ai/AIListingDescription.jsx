import { useState } from "react";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { api } from "@/api";

/**
 * Generates an AI description for a private listing or scored property.
 */
export default function AIListingDescription({ listing }) {
  const [description, setDescription] = useState(listing.description || "");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const addressStr = [listing.address, listing.city, listing.state, listing.zip].filter(Boolean).join(", ");

  const generate = async () => {
    setLoading(true);
    const data = await api.integrations.invokeLLM({
      prompt: `Write an engaging, buyer-focused property description for a real estate listing.

Property details:
- Address: ${addressStr}
- Price: ${listing.price ? "$" + Number(listing.price).toLocaleString() : "not disclosed"}
- Bedrooms: ${listing.bedrooms || "unknown"}
- Bathrooms: ${listing.bathrooms || "unknown"}
- Square Feet: ${listing.sqft ? Number(listing.sqft).toLocaleString() : "unknown"}
- Year Built: ${listing.year_built || "unknown"}
- Status: ${listing.status || "available"}
- Notes: ${listing.notes || "none"}

Write a compelling 3-4 sentence description that:
1. Opens with an emotionally engaging hook
2. Highlights the best features and lifestyle benefits
3. Mentions the neighborhood's appeal based on the location
4. Ends with a call-to-action or sense of urgency

Keep it professional, vivid, and buyer-focused. Use "you'll" and second-person language to make it personal.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          description: { type: "string" }
        }
      }
    });
    setDescription(data?.description || "");
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 border border-[#10b981]/15 rounded-xl overflow-hidden">
      <div className="bg-[#1a2234]/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-[#10b981]" />
          <span className="text-xs font-bold text-[#1a2234]">AI Description</span>
        </div>
        <div className="flex items-center gap-2">
          {description && (
            <button onClick={copy} className="text-slate-400 hover:text-[#10b981] transition">
              {copied ? <Check size={13} className="text-[#10b981]" /> : <Copy size={13} />}
            </button>
          )}
          <button onClick={generate} disabled={loading}
            className="text-xs font-semibold text-[#10b981] hover:text-[#059669] transition disabled:opacity-50 flex items-center gap-1">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {loading ? "Generating..." : description ? "Regenerate" : "Generate"}
          </button>
        </div>
      </div>
      {description && (
        <div className="px-4 py-3 bg-white">
          <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
        </div>
      )}
    </div>
  );
}