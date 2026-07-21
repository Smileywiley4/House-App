import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_LOADING_TIMEOUT_MS, useTimedLoading } from "@/hooks/useTimedLoading";
import {
  BrowseListSkeleton,
  ListSkeleton,
  ScoreCardSkeleton,
} from "@/components/ui/skeleton";

/**
 * Loading UI with optional skeleton; after `timeoutMs` shows slow-load + Retry.
 * @param {"spinner"|"list"|"cards"|"browse"|null} skeleton
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
  skeleton = null,
  skeletonRows = 4,
}) {
  const { timedOut } = useTimedLoading(isLoading, { timeoutMs });

  if (!isLoading) return null;

  const shell = cn(
    "flex flex-col items-center justify-center text-center",
    fullPage ? "min-h-screen bg-[#F8F7F4] px-4" : "py-12 px-4",
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#106B49] text-white text-sm font-semibold hover:bg-[#0C4F37] transition-colors duration-[var(--motion-duration)] ease-[var(--motion-ease)]"
          >
            <RefreshCw size={16} aria-hidden />
            Retry
          </button>
        )}
      </div>
    );
  }

  if (skeleton === "browse") {
    return (
      <div className={cn(fullPage && "min-h-screen bg-[#F8F7F4] px-4 py-8", className)} role="status" aria-busy="true" aria-label={label}>
        <BrowseListSkeleton rows={skeletonRows} />
      </div>
    );
  }

  if (skeleton === "cards") {
    return (
      <div
        className={cn(
          "space-y-4",
          fullPage && "min-h-screen bg-[#F8F7F4] px-6 py-8 max-w-5xl mx-auto",
          className,
        )}
        role="status"
        aria-busy="true"
        aria-label={label}
      >
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <ScoreCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (skeleton === "list") {
    return (
      <div
        className={cn(fullPage && "min-h-screen bg-[#F8F7F4] px-6 py-8 max-w-5xl mx-auto", className)}
        role="status"
        aria-busy="true"
        aria-label={label}
      >
        <ListSkeleton rows={skeletonRows} />
      </div>
    );
  }

  return (
    <div className={shell} role="status" aria-live="polite" aria-busy="true">
      <Loader2
        className="animate-spin text-[#106B49]"
        size={size}
        aria-hidden
      />
      {label ? <p className="mt-3 text-sm text-slate-400">{label}</p> : null}
    </div>
  );
}
