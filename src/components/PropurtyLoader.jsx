/**
 * Propurty-branded loading widget for auth / login pending states.
 * Tokens: green #106B49, navy #14192E, bg #F8F7F4.
 */
export default function PropurtyLoader({
  label = "Loading…",
  detail,
  /** fullscreen | page | inline */
  variant = "page",
  /** light cream bg vs navy (login oauth screens) */
  theme = "light",
  className = "",
  size = 56,
}) {
  const isDark = theme === "dark";
  const isFull = variant === "fullscreen";
  const isInline = variant === "inline";

  const shell = [
    isFull ? "fixed inset-0 z-50" : "",
    isInline ? "inline-flex" : "flex",
    "flex-col items-center justify-center",
    isInline ? "gap-2" : "gap-4 p-6",
    !isInline && !isFull ? "min-h-[60vh] w-full" : "",
    isFull || (!isInline && isDark) ? "min-h-screen w-full" : "",
    isDark ? "bg-[#14192E]" : isFull || variant === "page" ? "bg-[#F8F7F4]" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const ringSize = Math.round(size * 1.35);
  const labelColor = isDark ? "text-white" : "text-[#14192E]";
  const detailColor = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className={shell} role="status" aria-live="polite" aria-busy="true">
      <div
        className="relative flex items-center justify-center"
        style={{ width: ringSize, height: ringSize }}
      >
        {/* Soft orbit ring */}
        <span
          className="absolute inset-0 rounded-full border-2 border-[#106B49]/25 border-t-[#106B49] propurty-loader-spin"
          aria-hidden
        />
        {/* Brand mark with gentle pulse */}
        <img
          src="/logo/propurty-icon.svg"
          alt=""
          width={size}
          height={size}
          className="relative z-[1] propurty-loader-pulse select-none"
          draggable={false}
        />
      </div>

      {(label || detail) && (
        <div className={`text-center ${isInline ? "max-w-[12rem]" : "max-w-xs"}`}>
          {label ? (
            <p
              className={`font-heading font-semibold tracking-tight ${labelColor} ${
                isInline ? "text-sm" : "text-base"
              }`}
            >
              {label}
            </p>
          ) : null}
          {detail ? (
            <p className={`font-body mt-1 text-sm ${detailColor}`}>{detail}</p>
          ) : null}
        </div>
      )}

      <span className="sr-only">{label || "Loading"}</span>
    </div>
  );
}
