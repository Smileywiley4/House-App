import { useState } from "react";
import { Share2, Link, Check, X, Copy } from "lucide-react";

/**
 * Encodes the comparison data into the URL so it can be shared without an account.
 * The share link navigates to SharedComparison page with base64-encoded data in the query string.
 */
export default function ShareComparison({ scores }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!scores || scores.length === 0) return null;

  const generateLink = () => {
    const payload = JSON.stringify(scores.map(s => ({
      id: s.id,
      property_address: s.property_address,
      scores: s.scores,
      weighted_total: s.weighted_total,
      max_possible: s.max_possible,
      percentage: s.percentage,
    })));
    const encoded = btoa(unescape(encodeURIComponent(payload)));
    return `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "/")}#/SharedComparison?data=${encoded}`;
  };

  const link = generateLink();

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-white/20 text-white font-semibold rounded-xl text-sm hover:bg-white/10 transition"
      >
        <Share2 size={15} /> Share
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#1a2234] px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 size={16} className="text-[#10b981]" />
                <span className="text-white font-bold">Share Comparison</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4">
                Anyone with this link can view your property comparison — no account needed.
              </p>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 mb-4">
                <Link size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs text-slate-500 truncate flex-1">{link}</span>
              </div>

              <button
                onClick={copy}
                className={`w-full py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
                  copied
                    ? "bg-[#10b981] text-white"
                    : "bg-[#1a2234] hover:bg-[#243050] text-white"
                }`}
              >
                {copied ? <><Check size={15} /> Link Copied!</> : <><Copy size={15} /> Copy Link</>}
              </button>

              <p className="text-xs text-slate-400 text-center mt-3">
                Comparing {scores.length} propert{scores.length === 1 ? "y" : "ies"} · View-only snapshot
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}