import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, Home as HomeIcon, Shield } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import { APP_NAME } from "@/core/constants";
import { SITE_NAME } from "@/core/seoConfig";

/**
 * Public opt-in preference pattern page. Token required; preferences only.
 */
export default function PreferenceCard() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("t") || "").trim();
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState(!token);
  const [card, setCard] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        if (!api.preferenceCards?.getPublic) {
          throw new Error("unavailable");
        }
        const data = await api.preferenceCards.getPublic(token);
        if (!cancelled) setCard(data);
      } catch {
        if (!cancelled) {
          setError(true);
          setCard(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const title = "Preference pattern";
  const description =
    card?.summary_line ||
    "A preferences-only home-scoring pattern shared from Property Pocket.";

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <Helmet>
          <title>{`Link unavailable | ${SITE_NAME}`}</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="text-center max-w-sm">
          <AlertCircle size={40} className="mx-auto text-slate-300 mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Link unavailable</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This preference card may have been revoked or the link is invalid.
          </p>
          <Link
            to={createPageUrl("Home")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#10b981] text-white font-bold rounded-xl text-sm"
          >
            <HomeIcon size={15} /> Go to {APP_NAME}
          </Link>
        </div>
      </div>
    );
  }

  const homes = Number(card.homes_scored) || 0;
  const priorities = (card.top_priorities || []).slice(0, 3);

  return (
    <div className="min-h-[70vh] bg-gradient-to-b from-slate-50 to-[#e8f5f1]">
      <Helmet>
        <title>{`${title} | ${SITE_NAME}`}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="noindex, follow" />
        <meta property="og:title" content={`${title} | ${SITE_NAME}`} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${title} | ${SITE_NAME}`} />
        <meta name="twitter:description" content={description} />
      </Helmet>

      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[#0f172a] via-[#132337] to-[#0d3d36] text-white p-8 shadow-lg">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#10b981]/10"
            aria-hidden
          />
          <p className="text-[#10b981] text-xs font-bold uppercase tracking-widest mb-3">
            {APP_NAME} · Preference pattern
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold leading-snug mb-2">
            {homes > 0
              ? `Based on ${homes} home${homes === 1 ? "" : "s"} scored`
              : "Scoring preferences"}
          </h1>
          <p className="text-slate-300 text-sm mb-6">
            Top {priorities.length} priorit{priorities.length === 1 ? "y" : "ies"}
            {card.display_name ? ` · ${card.display_name}` : ""}
          </p>
          <ol className="space-y-4">
            {priorities.map((p, i) => (
              <li key={`${p.label}-${i}`} className="flex items-baseline gap-3">
                <span className="text-[#10b981] font-bold w-6">{i + 1}.</span>
                <div>
                  <p className="font-semibold text-lg">{p.label}</p>
                  {p.avg_importance != null && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      avg importance {Number(p.avg_importance).toFixed(1)}/10
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-slate-300 leading-relaxed">{card.summary_line}</p>
          <p className="mt-6 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Shield size={12} /> Preferences only — no addresses, prices, or photos
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Curious how your own priorities stack up?{" "}
          <Link to={createPageUrl("Home")} className="text-[#10b981] font-semibold hover:underline">
            Try {APP_NAME}
          </Link>
        </p>
      </div>
    </div>
  );
}
