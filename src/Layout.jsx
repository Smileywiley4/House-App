import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, BarChart3, Columns, Zap, Building2, UserCircle, Search, LogIn, Camera } from "lucide-react";
import { AdSlot } from "@/components/AdSlot";
import { useAuth } from "@/lib/AuthContext";
import SearchBarTop from "@/components/SearchBarTop";

const t = {
  accent: "#10b981",
  accentHover: "#059669",
  accentLight: "rgba(16,185,129,0.12)",
  accentText: "#10b981",
  gold: "#c9a84c",
  label: "Property Pulse",
};

export default function Layout({ children, currentPageName }) {
  const { isAuthenticated } = useAuth();

  const allNavItems = [
    { name: "Home", label: "Search", icon: Home, public: true },
    { name: "QuickCompare", label: "Compare", icon: Columns, public: true },
    { name: "SearchByPreset", label: "Find by Preset", icon: Search },
    { name: "Compare", label: "Properties", icon: BarChart3 },
    { name: "SideBySide", label: "Side by Side", icon: Columns },
    { name: "RealtorPortal", label: "Realtors", icon: Building2 },
    { name: "Pricing", label: "Pricing", icon: Zap, public: true },
    { name: "Profile", label: "Profile", icon: UserCircle },
    { name: "PropertyVisits", label: "Visits", icon: Camera },
  ];

  const navItems = isAuthenticated
    ? allNavItems
    : allNavItems.filter(i => i.public);

  return (
    <div className="min-h-screen bg-[#fafaf8] flex flex-col">
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
          <Link to={createPageUrl("Home")} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: t.accent }}>
              <Home size={14} className="text-white" />
            </div>
            <span className="font-bold text-white tracking-tight text-base">{t.label}</span>
            <span className="ml-0.5 text-[10px] font-bold" style={{ color: t.gold }}>✦</span>
          </Link>
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

          {isAuthenticated ? (
            <Link
              to={createPageUrl("Profile")}
              className="flex items-center gap-1.5 ml-1 px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <UserCircle size={15} />
              Account
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 ml-1 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{ backgroundColor: t.accent, color: "white" }}
            >
              <LogIn size={15} />
              Sign In
            </Link>
          )}
        </nav>

        <div className="mt-2">
          <SearchBarTop />
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-[#1a2234] border-t border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto mb-4">
          <AdSlot format="leaderboard" className="min-h-[90px]" />
        </div>
        <p className="text-slate-500 text-xs text-center">
          Property Pulse — Compare properties with weighted scoring
        </p>
      </footer>
    </div>
  );
}