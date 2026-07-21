import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_LOADING_TIMEOUT_MS, useTimedLoading } from "@/hooks/useTimedLoading";

/**
 * Spinner while loading; after `timeoutMs` shows a slow-load message + Retry.
 */
export default function LoadingWithTimeout({
  isLoading = true,
  onRetry,
  timeoutMs = DEFAULT_LOADING_TIMEOUT_MS,
  label = "Loading…",
  timeoutMessage = "This is taking longer than expected",
  fullPage = false,
  className,
  size = 20,
}) {
  const { timedOut } = useTimedLoading(isLoading, { timeoutMs });

  if (!isLoading) return null;

  const shell = cn(
    "flex flex-col items-center justify-center text-center",
    fullPage ? "min-h-screen bg-[#fafaf8] px-4" : "py-12 px-4",
    className,
  );

  if (timedOut) {
    return (
      <div className={shell} role="status" aria-live="polite">
        <p className="text-sm font-medium text-slate-700 mb-1">{timeoutMessage}</p>
        <p className="text-xs text-slate-500 mb-4 max-w-xs">
          The request may still be running. You can wait or try again.
        </p>
        {typeof onRetry === "function" && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] text-white text-sm font-semibold hover:bg-[#059669] transition-colors"
          >
            <RefreshCw size={16} aria-hidden />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={shell} role="status" aria-live="polite" aria-busy="true">
      <Loader2
        className="animate-spin text-[#10b981]"
        size={size}
        aria-hidden
      />
      {label ? <p className="mt-3 text-sm text-slate-400">{label}</p> : null}
    </div>
  );
}
