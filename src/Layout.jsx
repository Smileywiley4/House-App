import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, BarChart3, Columns, Zap, Building2, UserCircle, Search, LogIn, Camera, Settings, CreditCard, Shield, LogOut, Map, FolderKanban } from "lucide-react";
import { LayoutSeo } from "@/components/SeoHelmet";
import { useAuth } from "@/lib/AuthContext";
import SearchBarTop from "@/components/SearchBarTop";
import SiteFooter from "@/components/trust/SiteFooter";
import NotificationsBell from "@/components/NotificationsBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const t = {
  accent: "#10b981",
  accentHover: "#059669",
  accentLight: "rgba(16,185,129,0.12)",
  accentText: "#10b981",
  gold: "#c9a84c",
  label: "Prop Pocket",
};

export default function Layout({ children, currentPageName }) {
  const { user, isAuthenticated, isLoadingAuth, logout } = useAuth();

  /** Profile / account hub is opened from the header avatar only (upper right). */
  const allNavItems = [
    { name: "BrowseProperties", label: "Search Properties", icon: Map, public: true },
    { name: "Home", label: "Score address", icon: Home, public: true },
    { name: "SideBySide", label: "Compare", icon: Columns, public: true },
    { name: "SearchByPreset", label: "Find by Preset", icon: Search },
    { name: "Compare", label: "Properties", icon: BarChart3 },
    { name: "ProjectDetail", label: "Projects", icon: FolderKanban },
    { name: "RealtorPortal", label: "Realtors", icon: Building2 },
    { name: "Pricing", label: "Pricing", icon: Zap, public: true },
    { name: "PropertyVisits", label: "Visits", icon: Camera },
  ];

  const navItems = isAuthenticated
    ? allNavItems
    : allNavItems.filter(i => i.public);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors">
      <LayoutSeo currentPageName={currentPageName} />
      <style>{`
        :root {
          --accent: ${t.accent};
          --accent-hover: ${t.accentHover};
          --accent-light: ${t.accentLight};
        }
        input[type='range'] {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 9999px;
          outline: none;
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${t.accent};
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          transition: transform 0.15s;
        }
        input[type='range']::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        input[type='range']::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${t.accent};
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        }
        .gold-dot { color: ${t.gold}; }
        .accent-text { color: ${t.accent}; }
        .accent-bg { background-color: ${t.accent}; }
        .accent-border { border-color: ${t.accent}; }
      `}</style>

      {/* Top nav */}
      <header className="bg-[#1a2234] border-b border-white/5 px-4 sm:px-6 py-2 sticky top-0 z-40">
        <div className="flex items-center justify-between gap-4">
          <Link to={createPageUrl("Home")} className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: t.accent }}>
              <Home size={14} className="text-white" />
            </div>
            <span className="font-bold text-white tracking-tight text-base truncate">{t.label}</span>
            <span className="ml-0.5 text-[10px] font-bold shrink-0" style={{ color: t.gold }}>✦</span>
          </Link>

          <div className="flex items-center shrink-0 gap-2">
            {isLoadingAuth ? (
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5"
                aria-hidden
              >
                <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              </span>
            ) : isAuthenticated ? (
              <>
                <NotificationsBell />
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a2234]"
                    aria-label="Open account menu"
                  >
                    <UserCircle size={22} strokeWidth={1.75} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 z-[100]" sideOffset={8}>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-0.5">
                      <span className="text-sm font-semibold truncate">{user?.full_name || "My account"}</span>
                      {user?.email && (
                        <span className="text-xs font-normal text-muted-foreground truncate">{user.email}</span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("Profile")} className="cursor-pointer">
                      <UserCircle className="text-muted-foreground" />
                      Profile &amp; account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`${createPageUrl("Profile")}?tab=settings`} className="cursor-pointer">
                      <Settings className="text-muted-foreground" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`${createPageUrl("Profile")}?tab=billing`} className="cursor-pointer">
                      <CreditCard className="text-muted-foreground" />
                      Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`${createPageUrl("Profile")}?tab=security`} className="cursor-pointer">
                      <Shield className="text-muted-foreground" />
                      Security
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                    onClick={() => logout(true)}
                  >
                    <LogOut className="text-red-600" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-95"
                style={{ backgroundColor: t.accent, color: "white" }}
              >
                <LogIn size={16} />
                Sign In
              </Link>
            )}
          </div>
        </div>

        <nav className="mt-2 flex items-center gap-1 flex-nowrap overflow-x-auto whitespace-nowrap pb-1">
          {navItems.map(({ name, label, icon: Icon }) => {
            const active = currentPageName === name;
            return (
              <Link
                key={name}
                to={createPageUrl(name)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                style={active ? { backgroundColor: t.accent + "20", color: t.accent } : {}}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {currentPageName !== "Home" && (
          <div className="mt-2">
            <SearchBarTop />
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}