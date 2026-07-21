import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { storeBrowseCompareSelection } from "@/lib/browseCompare";

/**
 * Legacy /QuickCompare route — redirects to SideBySide (canonical compare).
 * Migrates old sessionStorage / ?address= handoffs into browse compare selection.
 */
export default function QuickCompare() {
  const [params] = useSearchParams();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("compareProperty");
      if (raw) {
        const incoming = JSON.parse(raw);
        sessionStorage.removeItem("compareProperty");
        const prop = incoming?.property || incoming;
        if (prop && typeof prop === "object") {
          const cats = Array.isArray(incoming?.categories) ? incoming.categories : [];
          const auto = {};
          for (const c of cats) {
            if (c?.id != null) auto[c.id] = Number(c.score) || 0;
          }
          let overall = null;
          if (cats.length) {
            const total = cats.reduce((s, c) => s + (Number(c.importance) || 5) * (Number(c.score) || 0), 0);
            const max = cats.reduce((s, c) => s + (Number(c.importance) || 5) * 10, 0);
            overall = max > 0 ? Math.round((total / max) * 100) : 0;
          }
          storeBrowseCompareSelection([
            {
              ...prop,
              formatted_address:
                prop.formatted_address ||
                [prop.address, prop.city, prop.state, prop.zip].filter(Boolean).join(", "),
              ...(Object.keys(auto).length ? { auto_scores: auto } : {}),
              ...(overall != null ? { overall_percentage: overall } : {}),
            },
          ]);
        }
      } else {
        const address = (params.get("address") || "").trim();
        if (address) {
          storeBrowseCompareSelection([{ address, formatted_address: address }]);
        }
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [params]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <Navigate to={createPageUrl("SideBySide")} replace />;
}
