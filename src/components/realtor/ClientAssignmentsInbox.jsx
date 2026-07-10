import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import GamifiedWalkthrough from "@/components/ai/GamifiedWalkthrough";

/** Homes a realtor sent — client starts gamified questionnaire here. */
export default function ClientAssignmentsInbox() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (!api.realtor?.clientInbox) {
      setLoading(false);
      return;
    }
    api.realtor.clientInbox()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-400 py-4">Loading from your realtor…</p>;
  }

  if (!api.realtor?.clientInbox) {
    return null;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-500">
        No properties from your realtor yet. When they send a home, it will appear here for a guided tour.
      </div>
    );
  }

  const active = items.find((x) => x.id === activeId);

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-[#1a2234]">From your realtor</h3>
      {!active && (
        <div className="grid gap-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveId(item.id);
                api.realtor.markAssignmentRead(item.id).catch(() => {});
              }}
              className="text-left rounded-2xl border border-slate-100 bg-white p-4 hover:border-[#10b981]/30 transition flex items-start gap-3 w-full"
            >
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center shrink-0">
                <Home size={18} className="text-[#10b981]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1a2234] text-sm truncate">{item.property_address}</p>
                {item.message && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.message}</p>}
                <span className="inline-flex items-center gap-1 text-xs text-[#10b981] font-semibold mt-2">
                  Start walk-through <ChevronRight size={12} />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      {active && (
        <div className="space-y-3">
          <button type="button" onClick={() => setActiveId(null)} className="text-xs text-slate-500 hover:text-[#1a2234]">
            ← Back to list
          </button>
          <GamifiedWalkthrough
            propertyAddress={active.property_address}
            assignmentId={active.id}
            onComplete={() => setActiveId(null)}
          />
          <Link
            to={createPageUrl("Evaluate") + `?address=${encodeURIComponent(active.property_address)}`}
            className="inline-flex text-sm text-[#10b981] font-semibold"
          >
            Full score sheet for this home →
          </Link>
        </div>
      )}
    </div>
  );
}
