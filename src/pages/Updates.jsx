/**
 * Updates — activity feed: in-app notifications + pending shared homes.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import RequireAuth from "@/components/RequireAuth";
import { useNotificationBadge } from "@/hooks/useNotificationBadge";

function hrefForNotification(n) {
  const path = n?.payload?.path;
  if (typeof path === "string" && path.startsWith("/")) return path;
  const kind = n?.kind || "";
  if (kind.startsWith("property_share")) return createPageUrl("SharedHomes");
  if (kind.startsWith("project_")) {
    const id = n?.payload?.project_id;
    return id
      ? `${createPageUrl("ProjectDetail")}?id=${encodeURIComponent(id)}`
      : createPageUrl("ProjectDetail");
  }
  if (kind.startsWith("contact_")) return createPageUrl("Contacts");
  return createPageUrl("BrowseProperties");
}

export default function Updates() {
  return (
    <RequireAuth message="Sign in to see updates from shared projects and notifications">
      <UpdatesInner />
    </RequireAuth>
  );
}

function UpdatesInner() {
  const { refresh: refreshBadge } = useNotificationBadge({ pollMs: 120_000 });
  const [items, setItems] = useState([]);
  const [sharePending, setSharePending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, c, shares] = await Promise.all([
        api.notifications.list({ limit: 40 }).catch(() => []),
        api.notifications.unreadCount().catch(() => ({ count: 0 })),
        api.shares?.pendingCount?.().catch(() => ({ count: 0 })) || Promise.resolve({ count: 0 }),
      ]);
      setItems(Array.isArray(list) ? list : []);
      setUnread(Number(c?.count) || 0);
      setSharePending(Number(shares?.count) || 0);
      refreshBadge();
    } catch {
      setItems([]);
      setUnread(0);
      setSharePending(0);
    } finally {
      setLoading(false);
    }
  }, [refreshBadge]);

  useEffect(() => { load(); }, [load]);

  const markAll = async () => {
    try {
      await api.notifications.markAllRead();
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      refreshBadge();
    } catch { /* ignore */ }
  };

  const markOne = async (id) => {
    try {
      await api.notifications.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n)));
      setUnread((c) => Math.max(0, c - 1));
      refreshBadge();
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Updates</h1>
          <p className="text-sm text-slate-500 mt-1">Shared project activity, completed scores, and listing alerts.</p>
        </div>
        {unread > 0 && (
          <button type="button" onClick={markAll} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0C4F37] hover:underline shrink-0">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {sharePending > 0 && (
        <Link to={createPageUrl("SharedHomes")} className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#106B49]/25 bg-[#106B49]/8 px-4 py-3 text-sm font-semibold text-[#0C4F37] hover:bg-[#106B49]/12 transition-colors">
          <span>{sharePending} shared home{sharePending === 1 ? "" : "s"} awaiting score</span>
          <span aria-hidden>→</span>
        </Link>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 px-6 py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 text-slate-400"><Bell size={22} /></div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No updates yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Listing alerts, shared homes, and project activity from others will show up here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link to={hrefForNotification(n)} onClick={() => markOne(n.id)} className={`block rounded-xl border px-4 py-3 transition-colors hover:border-[#106B49]/40 ${!n.read_at ? "border-[#106B49]/30 bg-[#106B49]/5" : "border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40"}`}>
                <span className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 block">{n.title}</span>
                {n.body && <span className="text-xs text-slate-500 mt-0.5 line-clamp-2 whitespace-pre-wrap block">{n.body}</span>}
                <span className="text-[10px] text-slate-400 mt-1.5 block">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
