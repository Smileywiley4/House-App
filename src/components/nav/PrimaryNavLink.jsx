import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { PrimaryNavIcon } from "@/components/nav/PrimaryNavIcons";
import { isNavActive, NAV_ACTIVE, NAV_MUTED } from "@/core/primaryNav";

export default function PrimaryNavLink({
  item,
  currentPageName,
  badge = 0,
  className = "",
  iconSize = 22,
}) {
  const active = isNavActive(item, currentPageName);
  const color = active ? NAV_ACTIVE : NAV_MUTED;

  return (
    <Link
      to={createPageUrl(item.name)}
      className={`relative flex flex-col items-center justify-center gap-0.5 min-w-0 px-2 py-1 rounded-md transition-colors hover:bg-black/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]/40 ${className}`}
      style={{ color }}
      aria-current={active ? "page" : undefined}
      aria-label={badge > 0 ? `${item.label}, ${badge} unread` : item.label}
    >
      <span className="relative inline-flex">
        <PrimaryNavIcon id={item.id} size={iconSize} strokeWidth={active ? 2.1 : 1.75} />
        {badge > 0 && (
          <span className="absolute -top-1 -right-2 min-w-[1rem] h-4 px-0.5 rounded-full bg-[#10b981] text-[9px] font-bold text-white flex items-center justify-center leading-none">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className={`text-[10px] font-medium tracking-tight truncate max-w-full ${active ? "font-semibold" : ""}`}>
        {item.label}
      </span>
    </Link>
  );
}
