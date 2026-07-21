import { useEffect, useState } from "react";

/** Default wait before showing the “taking longer” fallback. */
export const DEFAULT_LOADING_TIMEOUT_MS = 12_000;

/**
 * Tracks whether a loading flag has stayed true past `timeoutMs`.
 * Resets whenever `isLoading` becomes false.
 *
 * @param {boolean} isLoading
 * @param {{ timeoutMs?: number }} [options]
 * @returns {{ timedOut: boolean }}
 */
export function useTimedLoading(isLoading, { timeoutMs = DEFAULT_LOADING_TIMEOUT_MS } = {}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return undefined;
    }
    setTimedOut(false);
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [isLoading, timeoutMs]);

  return { timedOut };
}
