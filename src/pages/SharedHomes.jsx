import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ExternalLink, Home, Inbox, Send } from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import RequireAuth from "@/components/RequireAuth";
import LoadingWithTimeout from "@/components/async/LoadingWithTimeout";
import FetchErrorState from "@/components/async/FetchErrorState";
import EmptyState from "@/components/EmptyState";
import { saveCurrentProperty } from "@/core/currentProperty";
import { usePlan } from "@/core/hooks/usePlan";
import {
  formatShareWhen,
  shareDisplayStatus,
  shareNeedsScoring,
  shareStatusBadgeClass,
} from "@/lib/shareStatus";
import LicenseVerifiedEmblem from "@/components/trust/LicenseVerifiedEmblem";
import { isLicenseVerified } from "@/lib/licenseVerification";

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
    if (!shareId) return;
    const pool = [...inbox, ...sent];
    const found = pool.find((x) => x.id === shareId);
    if (found) setActive(found);
  }, [params, inbox, sent]);

  const list = tab === "sent" ? sent : inbox;
  const pending = useMemo(
    () => inbox.filter((x) => shareNeedsScoring(x)).length,
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

  const openItem = async (item) => {
    setActive(item);
    // Recipient opening a share marks Viewed
    if (tab === "inbox" && shareNeedsScoring(item) && !item.viewed_at) {
      try {
        const updated = await api.shares.markViewed(item.id);
        setInbox((prev) => prev.map((x) => (x.id === item.id ? { ...x, ...updated } : x)));
        setActive((cur) => (cur?.id === item.id ? { ...cur, ...updated } : cur));
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#14192E] flex items-center gap-2">
            <Inbox size={22} className="text-[#106B49]" /> Shared homes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Homes sent for scoring — private between you and your contact.
          </p>
        </div>
        <Link to={createPageUrl("Contacts")} className="text-sm font-semibold text-[#106B49] hover:underline">
          Contacts →
        </Link>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setParams({})}
          className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${
            tab === "inbox"
              ? "border-[#106B49] text-[#0C4F37]"
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
                ? "border-[#106B49] text-[#0C4F37]"
                : "border-transparent text-slate-500"
            }`}
          >
            Sent{sent.length ? ` (${sent.length})` : ""}
          </button>
        )}
      </div>

      {error && <FetchErrorState compact message={error} onRetry={load} className="mb-2" />}

      {loading ? (
        <LoadingWithTimeout isLoading onRetry={load} label="Loading shared homes…" skeleton="list" skeletonRows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          compact
          icon={tab === "sent" ? Send : Inbox}
          title={tab === "sent" ? "No outbound shares yet" : "Nothing shared with you yet"}
          description={
            tab === "sent"
              ? "From Evaluate, use “Send to client for scoring”."
              : "When a realtor or contact shares a home, it will show up here."
          }
          actionLabel={tab === "sent" ? "Score an address" : "Browse homes"}
          actionTo={createPageUrl(tab === "sent" ? "Home" : "BrowseProperties")}
        />
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
            const label = shareDisplayStatus(item);
            const when =
              tab === "sent"
                ? formatShareWhen(item.created_at)
                : formatShareWhen(item.updated_at || item.created_at);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openItem(item)}
                  className="w-full text-left rounded-2xl border border-slate-100 bg-white p-4 hover:border-[#106B49]/30 transition flex gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#106B49]/10 flex items-center justify-center shrink-0">
                    <Home size={18} className="text-[#106B49]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[#14192E] text-sm truncate">{address}</p>
                      <span
                        className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${shareStatusBadgeClass(label)}`}
                      >
                        {label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
                      <span>{tab === "sent" ? "To" : "From"} {peer || "Contact"}</span>
                      {tab !== "sent" && isLicenseVerified(item.from_user) && (
                        <LicenseVerifiedEmblem profile={item.from_user} size={13} />
                      )}
                      {when ? <span>· {when}</span> : null}
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
          isSentTab={tab === "sent"}
          onClose={() => setActive(null)}
          onScore={() => openScore(active)}
          onRefresh={load}
        />
      )}
    </div>
  );
}

function ShareDetail({ item, isSentTab, onClose, onScore, onRefresh }) {
  const prop = item.property_payload || {};
  const address =
    prop.address || prop.formattedAddress || prop.property_address || "Property";
  const media = item.media_urls || [];
  const canScore = !isSentTab && shareNeedsScoring(item);
  const isReturned = shareDisplayStatus(item) === "Scored";
  const label = shareDisplayStatus(item);
  const peer = isSentTab
    ? item.to_user?.full_name || item.to_user?.email
    : item.from_user?.full_name || item.from_user?.email;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-bold text-[#14192E] text-sm truncate pr-4">{address}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 text-sm font-semibold">
            Close
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${shareStatusBadgeClass(label)}`}
            >
              {label}
            </span>
            <span className="inline-flex items-center gap-1">
              {isSentTab ? "To" : "From"} {peer || "Contact"}
              {!isSentTab && isLicenseVerified(item.from_user) && (
                <LicenseVerifiedEmblem profile={item.from_user} size={13} />
              )}
            </span>
            {item.created_at && <span>· Sent {formatShareWhen(item.created_at)}</span>}
            {item.viewed_at && <span>· Viewed {formatShareWhen(item.viewed_at)}</span>}
            {item.scored_at && <span>· Scored {formatShareWhen(item.scored_at)}</span>}
          </div>
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
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#106B49] hover:underline"
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
          {canScore && (
            <button
              type="button"
              onClick={onScore}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#106B49] py-3 text-sm font-bold text-white hover:bg-[#0C4F37]"
            >
              <Send size={16} /> Score this home
            </button>
          )}
          {isSentTab && shareNeedsScoring(item) && (
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
              Cancel share
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
