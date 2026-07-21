import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  UserCircle,
  Search,
  LogIn,
  Settings,
  CreditCard,
  Shield,
  LogOut,
  MoreHorizontal,
  X,
} from "lucide-react";
import { LayoutSeo } from "@/components/SeoHelmet";
import { useAuth } from "@/lib/AuthContext";
import SearchBarTop from "@/components/SearchBarTop";
import SiteFooter from "@/components/trust/SiteFooter";
import MobileBottomNav from "@/components/MobileBottomNav";
import OnboardingQuizHost from "@/components/onboarding/OnboardingQuizHost";
import FeedbackWidget from "@/components/FeedbackWidget";
import PrimaryNavLink from "@/components/nav/PrimaryNavLink";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PRIMARY_NAV,
  MORE_NAV,
  filterNavForAuth,
  isNavActive,
  NAV_MUTED,
  NAV_ACTIVE,
} from "@/core/primaryNav";
import { useNotificationBadge } from "@/hooks/useNotificationBadge";
import { THEME } from "@/core/constants";
import { brand } from "@/design-tokens";

const t = {
  accent: THEME.accent,
  accentHover: THEME.accentHover,
  accentSolid: brand.primaryDeep,
  accentLight: THEME.accentLight,
  gold: THEME.gold,
  label: "Propurty",
};

export default function Layout({ children, currentPageName }) {
  const { user, isAuthenticated, isLoadingAuth, logout } = useAuth();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { badge: updatesBadge } = useNotificationBadge();

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [currentPageName]);

  const moreItems = filterNavForAuth(
    MORE_NAV.filter((i) => !PRIMARY_NAV.some((p) => p.name === i.name)),
    isAuthenticated
  );
  const moreActive = moreItems.some((item) => isNavActive(item, currentPageName));
  const leftPrimary = PRIMARY_NAV.slice(0, 3);
  const rightPrimary = PRIMARY_NAV.slice(3);
  const showHeaderSearch = currentPageName !== "Home";
  const showMobileSearchPanel = showHeaderSearch && mobileSearchOpen;

  const logoBlock = (
    <Link to={createPageUrl("Home")} className="flex items-center gap-2 min-w-0 shrink-0" aria-label={t.label}>
      <img
        src="/logo/propurty-logotype-horizontal.svg"
        alt={t.label}
        className="h-8 sm:h-9 w-auto max-w-[160px] sm:max-w-[200px] object-contain object-left"
        width={200}
        height={36}
        decoding="async"
      />
    </Link>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors">
      <LayoutSeo currentPageName={currentPageName} />
      <style>{`
        input[type='range'] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: var(--radius-pill); outline: none; }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--brand-primary-deep); cursor: pointer; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
        input[type='range']::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--brand-primary-deep); cursor: pointer; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
      `}</style>

      <header className="bg-white border-b border-slate-200/90 px-3 sm:px-5 py-2 sticky top-0 z-40">
        <div className="md:hidden relative flex items-center justify-between gap-2 min-h-11">
          <div className="flex items-center gap-1.5 w-11 shrink-0">
            {showHeaderSearch && (
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-charcoal transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-label={mobileSearchOpen ? "Close address search" : "Open address search"}
                aria-expanded={mobileSearchOpen}
                onClick={() => setMobileSearchOpen((open) => !open)}
              >
                {mobileSearchOpen ? <X size={18} strokeWidth={1.75} /> : <Search size={18} strokeWidth={1.75} />}
              </button>
            )}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{logoBlock}</div>
          <div className="flex items-center justify-end gap-1.5 shrink-0 min-w-[2.75rem]">
            <AccountCluster isLoadingAuth={isLoadingAuth} isAuthenticated={isAuthenticated} user={user} logout={logout} compact />
          </div>
        </div>

        <div className="hidden md:grid grid-cols-[1fr_auto_1fr] items-center gap-3 min-h-14">
          <nav className="flex items-center justify-end gap-0.5 lg:gap-1" aria-label="Primary left">
            {leftPrimary.map((item) => (
              <PrimaryNavLink key={item.id} item={item} currentPageName={currentPageName} badge={item.badge === "notifications" ? updatesBadge : 0} iconSize={22} className="px-2.5 py-1.5" />
            ))}
          </nav>
          <div className="justify-self-center px-2">{logoBlock}</div>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <nav className="flex items-center gap-0.5 lg:gap-1" aria-label="Primary right">
              {rightPrimary.map((item) => (
                <PrimaryNavLink key={item.id} item={item} currentPageName={currentPageName} badge={item.badge === "notifications" ? updatesBadge : 0} iconSize={22} className="px-2.5 py-1.5" />
              ))}
            </nav>
            <div className="flex items-center gap-1.5 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-md transition-colors hover:bg-black/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40" style={{ color: moreActive ? NAV_ACTIVE : NAV_MUTED }} aria-label="More navigation">
                    <MoreHorizontal size={22} strokeWidth={moreActive ? 2.1 : 1.75} />
                    <span className={`text-[10px] tracking-tight ${moreActive ? "font-semibold" : "font-medium"}`}>More</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 z-[100]" sideOffset={8}>
                  <DropdownMenuLabel>More</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {moreItems.map(({ name, label, icon: Icon, alsoActive }) => (
                    <DropdownMenuItem key={name} asChild>
                      <Link to={createPageUrl(name)} className="cursor-pointer" aria-current={isNavActive({ name, alsoActive }, currentPageName) ? "page" : undefined}>
                        <Icon className="text-muted-foreground" />
                        {label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <AccountCluster isLoadingAuth={isLoadingAuth} isAuthenticated={isAuthenticated} user={user} logout={logout} />
            </div>
          </div>
        </div>

        {showHeaderSearch && (
          <div className={`mt-2 ${showMobileSearchPanel ? "block" : "hidden"} md:block`}>
            <SearchBarTop />
          </div>
        )}
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <div className="pb-20 md:pb-0"><SiteFooter /></div>
      <MobileBottomNav currentPageName={currentPageName} isAuthenticated={isAuthenticated} isLoadingAuth={isLoadingAuth} updatesBadge={updatesBadge} />
      <OnboardingQuizHost />
      <FeedbackWidget />
    </div>
  );
}

function AccountCluster({ isLoadingAuth, isAuthenticated, user, logout, compact = false }) {
  const btnClass = "flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-charcoal transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand overflow-hidden";
  if (isLoadingAuth) {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50" aria-hidden>
        <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
      </span>
    );
  }
  if (!isAuthenticated) {
    return (
      <Link to="/login" className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-95" style={{ backgroundColor: t.accentSolid }} aria-label="Sign in">
        <LogIn size={16} />
        {!compact && <span>Sign In</span>}
      </Link>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={btnClass} aria-label="Open account menu">
          {user?.avatar_url ? (
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar_url} alt="" className="object-cover" />
              <AvatarFallback className="bg-transparent text-charcoal"><UserCircle size={22} strokeWidth={1.75} /></AvatarFallback>
            </Avatar>
          ) : (
            <UserCircle size={22} strokeWidth={1.75} />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 z-[100]" sideOffset={8}>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-0.5">
            <span className="text-sm font-semibold truncate">{user?.full_name || "My account"}</span>
            {user?.email && <span className="text-xs font-normal text-muted-foreground truncate">{user.email}</span>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to={createPageUrl("Profile")} className="cursor-pointer"><UserCircle className="text-muted-foreground" />Profile &amp; account</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to={`${createPageUrl("Profile")}?tab=settings`} className="cursor-pointer"><Settings className="text-muted-foreground" />Settings</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to={`${createPageUrl("Profile")}?tab=billing`} className="cursor-pointer"><CreditCard className="text-muted-foreground" />Billing</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to={`${createPageUrl("Profile")}?tab=security`} className="cursor-pointer"><Shield className="text-muted-foreground" />Security</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30" onClick={() => logout(true)}>
          <LogOut className="text-red-600" />Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
