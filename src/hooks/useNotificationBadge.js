import { useCallback, useEffect, useState } from "react";
import { api } from "@/api";
import { useAuth } from "@/lib/AuthContext";

export function useNotificationBadge({ pollMs = 90_000 } = {}) {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);
  const [sharePending, setSharePending] = useState(0);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCount(0);
      setSharePending(0);
      return;
    }
    try {
      const [c, shares] = await Promise.all([
        api.notifications.unreadCount().catch(() => ({ count: 0 })),
        api.shares?.pendingCount?.().catch(() => ({ count: 0 })) || Promise.resolve({ count: 0 }),
      ]);
      setCount(Number(c?.count) || 0);
      setSharePending(Number(shares?.count) || 0);
    } catch {
      setCount(0);
      setSharePending(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
    if (!isAuthenticated) return undefined;
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [refresh, isAuthenticated, pollMs]);

  return { unread: count, sharePending, badge: count + sharePending, refresh };
}
