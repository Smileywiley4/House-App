import LoadingWithTimeout from "@/components/async/LoadingWithTimeout";
import FetchErrorState from "@/components/async/FetchErrorState";
import { DEFAULT_LOADING_TIMEOUT_MS } from "@/hooks/useTimedLoading";

/**
 * Renders error → loading (with timeout fallback) → children.
 * Display-only; does not own fetch logic.
 */
export default function AsyncState({
  isLoading = false,
  error = null,
  onRetry,
  children,
  fullPage = false,
  loadingLabel = "Loading…",
  errorTitle = "Couldn’t load",
  timeoutMs = DEFAULT_LOADING_TIMEOUT_MS,
  /** When true and error is set, still render children below a compact banner */
  errorInline = false,
  loadingClassName,
  errorClassName,
}) {
  const hasError = Boolean(error);

  if (hasError && !errorInline) {
    return (
      <FetchErrorState
        title={errorTitle}
        message={typeof error === "string" ? error : error?.message || "Something went wrong"}
        onRetry={onRetry}
        fullPage={fullPage}
        className={errorClassName}
      />
    );
  }

  if (isLoading) {
    return (
      <LoadingWithTimeout
        isLoading
        onRetry={onRetry}
        timeoutMs={timeoutMs}
        label={loadingLabel}
        fullPage={fullPage}
        className={loadingClassName}
      />
    );
  }

  return (
    <>
      {hasError && errorInline ? (
        <FetchErrorState
          compact
          message={typeof error === "string" ? error : error?.message || "Something went wrong"}
          onRetry={onRetry}
          className={errorClassName}
        />
      ) : null}
      {children}
    </>
  );
}

export { LoadingWithTimeout, FetchErrorState, DEFAULT_LOADING_TIMEOUT_MS };
