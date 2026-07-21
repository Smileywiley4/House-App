import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ExternalLink, Home, Inbox, Loader2, Send } from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import RequireAuth from "@/components/RequireAuth";
import { saveCurrentProperty } from "@/core/currentProperty";
import { usePlan } from "@/core/hooks/usePlan";

export default function SharedHomes() {
  return (
    <RequireAuth message="Sign in to view shared homes">
      <SharedHomesInner />
    </RequireAuth>
  );
}

function SharedHomesInner() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "sent" ? "sent" : "inbox";
  const { isRealtor } = usePlan();
  const navigate = useNavigate();
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inb, s] = await Promise.all([
        api.shares.inbox().catch(() => []),
        isRealtor ? api.shares.sent().catch(() => []) : Promise.resolve([]),
      ]);
      setInbox(Array.isArray(inb) ? inb : []);
      setSent(Array.isArray(s) ? s : []);
    } catch (e) {
      setError(e?.message || "Could not load shared homes");
    } finally {
      setLoading(false);
    }
  }, [isRealtor]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const shareId = params.get("id");
    if (!shareId || !inbox.length) return;
    const found = inbox.find((x) => x.id === shareId);
    if (found) setActive(found);
  }, [params, inbox]);

  const list = tab === "sent" ? sent : inbox;
  const pending = useMemo(
    () => inbox.filter((x) => x.status === "pending_score").length,
    [inbox],
  );

  const openScore = (item) => {
    const prop = item.property_payload || {};
    const address =
      prop.address || prop.formattedAddress || prop.property_address || "Shared home";
    saveCurrentProperty({
      ...prop,
      address,
      _shareId: item.id,
      _privateListingUrl: item.private_listing_url || null,
      photos: item.media_urls?.length ? item.media_urls : prop.photos,
    });
    navigate(
      `${createPageUrl("Evaluate")}?address=${encodeURIComponent(address)}&shareId=${encodeURIComponent(item.id)}`,
    );
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2234] flex items-center gap-2">
            <Inbox size={22} className="text-[#10b981]" /> Shared homes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Homes sent for scoring — private between you and your contact.
          </p>
        </div>
        <Link to={createPageUrl("Contacts")} className="text-sm font-semibold text-[#10b981] hover:underline">
          Contacts →
        </Link>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setParams({})}
          className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${
            tab === "inbox"
              ? "border-[#10b981] text-[#059669]"
              : "border-transparent text-slate-500"
          }`}
        >
          Inbox{pending ? ` (${pending})` : ""}
        </button>
        {isRealtor && (
          <button
            type="button"
            onClick={() => setParams({ tab: "sent" })}
            className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === "sent"
                ? "border-[#10b981] text-[#059669]"
                : "border-transparent text-slate-500"
            }`}
          >
            Sent
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-2xl py-10 px-4">
          {tab === "sent"
            ? "No outbound shares yet. From Evaluate, use “Send to client for scoring”."
            : "Nothing shared with you yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((item) => {
            const prop = item.property_payload || {};
            const address =
              prop.address || prop.formattedAddress || prop.property_address || "Property";
            const peer =
              tab === "sent"
                ? item.to_user?.full_name || item.to_user?.email
                : item.from_user?.full_name || item.from_user?.email;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActive(item)}
                  className="w-full text-left rounded-2xl border border-slate-100 bg-white p-4 hover:border-[#10b981]/30 transition flex gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center shrink-0">
                    <Home size={18} className="text-[#10b981]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#1a2234] text-sm truncate">{address}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {peer || "Contact"} · {item.status?.replace("_", " ")}
                    </p>
                    {item.message && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.message}</p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {active && (
        <ShareDetail
          item={active}
          isRecipient={active.to_user_id && String(active.to_user_id)}
          onClose={() => setActive(null)}
          onScore={() => openScore(active)}
          onRefresh={load}
        />
      )}
    </div>
  );
}

function ShareDetail({ item, onClose, onScore, onRefresh }) {
  const prop = item.property_payload || {};
  const address =
    prop.address || prop.formattedAddress || prop.property_address || "Property";
  const media = item.media_urls || [];
  const isPending = item.status === "pending_score";
  const isReturned = item.status === "returned" || item.status === "scored";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-bold text-[#1a2234] text-sm truncate pr-4">{address}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 text-sm font-semibold">
            Close
          </button>
        </div>
        <div className="p-4 space-y-4">
          {media[0] && (
            <img
              src={media[0]}
              alt=""
              className="w-full h-40 object-cover rounded-xl bg-slate-100"
            />
          )}
          {item.message && (
            <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{item.message}</p>
          )}
          {item.private_listing_url && (
            <a
              href={item.private_listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#10b981] hover:underline"
            >
              <ExternalLink size={14} /> Open private listing link
            </a>
          )}
          {isReturned && item.scores && Object.keys(item.scores).length > 0 && (
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Returned scores</p>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(item.scores, null, 2)}
              </pre>
            </div>
          )}
          {isPending && (
            <button
              type="button"
              onClick={onScore}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#10b981] py-3 text-sm font-bold text-white hover:bg-[#059669]"
            >
              <Send size={16} /> Score this home
            </button>
          )}
          {item.status === "pending_score" && item.from_user_id && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.shares.cancel(item.id);
                  onClose();
                  onRefresh();
                } catch {
                  /* ignore if not sender */
                }
              }}
              className="w-full text-xs text-slate-400 hover:text-red-600"
            >
              Cancel share (sender)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
