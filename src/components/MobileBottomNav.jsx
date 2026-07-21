import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { MoreHorizontal, LogIn } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import PrimaryNavLink from "@/components/nav/PrimaryNavLink";
import {
  PRIMARY_NAV,
  MORE_NAV,
  filterNavForAuth,
  isNavActive,
  runMoreNavAction,
  NAV_ACTIVE,
  NAV_MUTED,
} from "@/core/primaryNav";

export default function MobileBottomNav({
  currentPageName,
  isAuthenticated,
  isLoadingAuth,
  updatesBadge = 0,
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  const moreItems = filterNavForAuth(
    MORE_NAV.filter((i) => !PRIMARY_NAV.some((p) => p.name === i.name)),
    isAuthenticated
  );
  const moreActive = moreItems.some((item) => isNavActive(item, currentPageName));

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white pb-[max(0.25rem,env(safe-area-inset-bottom))]"
        aria-label="Primary"
      >
        <div className="flex items-stretch justify-around px-0.5 pt-1 pb-1">
          {PRIMARY_NAV.map((item) => (
            <PrimaryNavLink
              key={item.id}
              item={item}
              currentPageName={currentPageName}
              badge={item.badge === "notifications" ? updatesBadge : 0}
              iconSize={22}
              className="flex-1 py-1.5"
            />
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 py-1.5 px-1 rounded-md text-micro transition-colors hover:bg-black/[0.04]"
            style={{ color: moreActive || moreOpen ? NAV_ACTIVE : NAV_MUTED }}
            aria-label="More navigation"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal size={22} strokeWidth={moreActive || moreOpen ? 2.1 : 1.75} />
            <span className={moreActive || moreOpen ? "font-semibold" : "font-medium"}>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-slate-200 bg-white text-charcoal px-4 pt-6 max-h-[85vh] overflow-y-auto md:hidden pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="text-left mb-4 pr-8">
            <SheetTitle className="text-navy">More</SheetTitle>
            <SheetDescription className="text-slate-500">Additional pages and tools</SheetDescription>
          </SheetHeader>

          <ul className="grid gap-1">
            {moreItems.map((item) => {
              const { name, label, icon: Icon, alsoActive, action, id } = item;
              if (action) {
                return (
                  <li key={id || action}>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        runMoreNavAction(action);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-slate-50 text-left"
                      style={{ color: NAV_MUTED }}
                    >
                      <Icon size={18} />
                      {label}
                    </button>
                  </li>
                );
              }
              const active = isNavActive({ name, alsoActive }, currentPageName);
              return (
                <li key={name}>
                  <Link
                    to={createPageUrl(name)}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
                    style={active ? { color: NAV_ACTIVE } : { color: NAV_MUTED }}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                </li>
              );
            })}

            {!isLoadingAuth && !isAuthenticated && (
              <li>
                <Link to="/login" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white bg-[#0C4F37]">
                  <LogIn size={18} />
                  Sign In
                </Link>
              </li>
            )}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
