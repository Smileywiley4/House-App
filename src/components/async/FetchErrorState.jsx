import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Clear fetch/error message with optional Retry.
 */
export default function FetchErrorState({
  message = "Something went wrong",
  title = "Couldn’t load",
  onRetry,
  fullPage = false,
  compact = false,
  className,
}) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2",
          className,
        )}
        role="alert"
      >
        <p className="text-sm text-red-700 min-w-0">{message}</p>
        {typeof onRetry === "function" && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-xs font-semibold text-red-800 underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        fullPage ? "min-h-screen bg-[#F8F7F4] px-4" : "py-10 px-4",
        className,
      )}
      role="alert"
    >
      <div className="max-w-sm w-full">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" aria-hidden />
        {title ? <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2> : null}
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        {typeof onRetry === "function" && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#106B49] text-white font-semibold hover:bg-[#0C4F37] transition-colors"
          >
            <RefreshCw size={16} aria-hidden />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
