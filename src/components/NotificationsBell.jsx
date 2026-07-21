/**
 * Header bell: unread badge + recent in-app notifications (listing matches,
 * shared homes, project activity). // future: FCM / web-push delivery
 */
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export default function NotificationsBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sharePending, setSharePending] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [c, list, shares] = await Promise.all([
        api.notifications.unreadCount().catch(() => ({ count: 0 })),
        api.notifications.list({ limit: 12 }).catch(() => []),
        api.shares?.pendingCount?.().catch(() => ({ count: 0 })) || Promise.resolve({ count: 0 }),
      ]);
      setCount(Number(c?.count) || 0);
      setItems(Array.isArray(list) ? list : []);
      setSharePending(Number(shares?.count) || 0);
    } catch {
      setCount(0);
      setItems([]);
      setSharePending(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 90_000);
    return () => clearInterval(t);
  }, [refresh]);

  const onOpen = async (open) => {
    if (!open) return;
    setLoading(true);
    await refresh();
    setLoading(false);
  };

  const markAll = async () => {
    try {
      await api.notifications.markAllRead();
      setCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    } catch {
      /* ignore */
    }
  };

  const markOne = async (id) => {
    try {
      await api.notifications.markRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n))
      );
      setCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  };

  const badge = count + sharePending;

  return (
    <DropdownMenu onOpenChange={onOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a2234]"
          aria-label={badge ? `${badge} unread notifications` : "Notifications"}
        >
          <Bell size={18} strokeWidth={1.75} />
          {badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-0.5 rounded-full bg-[#10b981] text-[10px] font-bold text-white flex items-center justify-center">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 z-[100]" sideOffset={8}>
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          {count > 0 && (
            <button
              type="button"
              onClick={markAll}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#059669] hover:underline"
            >
              <CheckCheck size={12} /> Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sharePending > 0 && (
          <>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to={createPageUrl("SharedHomes")} className="w-full text-sm font-semibold text-[#059669]">
                {sharePending} shared home{sharePending === 1 ? "" : "s"} awaiting score →
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {loading && !items.length ? (
          <div className="px-3 py-6 flex justify-center text-slate-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500">
            No notifications yet. Listing alerts and shared homes appear here.
          </div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={`flex flex-col items-start gap-0.5 cursor-pointer py-2.5 ${
                !n.read_at ? "bg-[#10b981]/5" : ""
              }`}
              onSelect={(e) => {
                e.preventDefault();
                markOne(n.id);
              }}
            >
              <Link
                to={hrefForNotification(n)}
                className="w-full space-y-0.5"
                onClick={() => markOne(n.id)}
              >
                <span className="text-sm font-semibold text-slate-800 line-clamp-2 block">{n.title}</span>
                {n.body && (
                  <span className="text-[11px] text-slate-500 line-clamp-2 whitespace-pre-wrap block">{n.body}</span>
                )}
                <span className="text-[10px] text-slate-400 block">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
