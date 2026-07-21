import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Map,
  Home,
  Columns,
  Inbox,
  MoreHorizontal,
  Search,
  BarChart3,
  FolderKanban,
  Users,
  Building2,
  Zap,
  Camera,
  UserCircle,
  LogIn,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const ACCENT = "#10b981";

const PRIMARY_TABS = [
  { name: "BrowseProperties", label: "Search", icon: Map, public: true },
  { name: "Home", label: "Score", icon: Home, public: true, alsoActive: ["Evaluate"] },
  { name: "Compare", label: "Compare", icon: Columns, public: true },
  { name: "SharedHomes", label: "Shared", icon: Inbox },
];

const MORE_ITEMS = [
  { name: "SearchByPreset", label: "Find by Preset", icon: Search },
  { name: "SavedProperties", label: "Properties", icon: BarChart3 },
  { name: "ProjectDetail", label: "Projects", icon: FolderKanban },
  { name: "Contacts", label: "Contacts", icon: Users },
  { name: "RealtorPortal", label: "Realtors", icon: Building2 },
  { name: "Pricing", label: "Pricing", icon: Zap, public: true },
  { name: "PropertyVisits", label: "Visits", icon: Camera },
  { name: "Profile", label: "Profile", icon: UserCircle },
];

function isTabActive(tab, currentPageName) {
  if (currentPageName === tab.name) return true;
  return Array.isArray(tab.alsoActive) && tab.alsoActive.includes(currentPageName);
}

/**
 * App-style bottom tabs for &lt;md. Primary destinations + More sheet for the rest.
 */
export default function MobileBottomNav({
  currentPageName,
  isAuthenticated,
  isLoadingAuth,
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  const tabs = isAuthenticated
    ? PRIMARY_TABS
    : PRIMARY_TABS.filter((t) => t.public);

  const moreItems = isAuthenticated
    ? MORE_ITEMS
    : MORE_ITEMS.filter((t) => t.public);

  const moreActive = moreItems.some((item) => item.name === currentPageName);

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#1a2234]/
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Primary"
      >
        <div className="flex items-stretch justify-around px-1 pt-1 pb-1">
          {tabs.map(({ name, label, icon: Icon, alsoActive }) => {
            const active = isTabActive({ name, alsoActive }, currentPageName);
            return (
              <Link
                key={name}
                to={createPageUrl(name)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 py-2 px-1 rounded-lg text-[10px] font-semibold transition-colors ${
                  active ? "text-white" : "text-slate-400"
                }`}
                style={active ? { color: ACCENT } : undefined}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
                <span className="truncate max-w-full">{label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 py-2 px-1 rounded-lg text-[10px] font-semibold transition-colors ${
              moreActive || moreOpen ? "text-white" : "text-slate-400"
            }`}
            style={moreActive || moreOpen ? { color: ACCENT } : undefined}
            aria-label="More navigation"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal size={20} strokeWidth={moreActive || moreOpen ? 2.25 : 1.75} />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-white/10 bg-[#1a2234] text-white px-4 pb-8 pt-6 max-h-[85vh] overflow-y-auto md:hidden"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <SheetHeader className="text-left mb-4 pr-8">
            <SheetTitle className="text-white">More</SheetTitle>
            <SheetDescription className="text-slate-400">
              Additional pages and tools
            </SheetDescription>
          </SheetHeader>

          <ul className="grid gap-1">
            {moreItems.map(({ name, label, icon: Icon }) => {
              const active = currentPageName === name;
              return (
                <li key={name}>
                  <Link
                    to={createPageUrl(name)}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                      active ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                    style={active ? { color: ACCENT } : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={18} className={active ? "" : "text-slate-400"} />
                    {label}
                  </Link>
                </li>
              );
            })}

            {!isLoadingAuth && !isAuthenticated && (
              <li>
                <Link
                  to="/login"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: ACCENT }}
                >
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
