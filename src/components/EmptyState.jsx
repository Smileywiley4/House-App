import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Shared empty state: headline + one supporting line + optional clear action.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  className,
  compact = false,
}) {
  const actionClass =
    "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand-navy,#1a2234)] text-white text-sm font-semibold hover:bg-[var(--brand-navy-hover,#243050)] transition-[background-color,transform] duration-[var(--motion-duration)] ease-[var(--motion-ease)]";

  return (
    <div
      className={cn(
        "text-center",
        compact ? "py-10 px-4" : "py-16 px-4",
        "rounded-2xl border border-dashed border-slate-200 bg-white/60",
        className,
      )}
      role="status"
    >
      {Icon ? (
        <Icon
          size={compact ? 36 : 48}
          className="mx-auto text-slate-200 mb-4"
          aria-hidden
          strokeWidth={1.5}
        />
      ) : null}
      <h2 className={cn("font-bold text-[#1a2234]", compact ? "text-base mb-1" : "text-xl mb-2")}>
        {title}
      </h2>
      {description ? (
        <p className={cn("text-slate-500 max-w-md mx-auto", compact ? "text-sm mb-4" : "text-sm mb-6")}>
          {description}
        </p>
      ) : null}
      {actionLabel && actionTo ? (
        <Link to={actionTo} className={actionClass}>
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction && !actionTo ? (
        <button type="button" onClick={onAction} className={actionClass}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
