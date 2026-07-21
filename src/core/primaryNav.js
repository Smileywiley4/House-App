/**
 * Primary product nav: Search · Updates · Favorites · Plan · Inbox
 * Shared by desktop header and mobile bottom tabs.
 */
import {
  Home,
  Columns,
  Search,
  Building2,
  Zap,
  Camera,
  UserCircle,
  Users,
} from "lucide-react";

export const NAV_CHARCOAL = "#2d3340";
export const NAV_MUTED = "#6b7280";
export const NAV_ACTIVE = "#111827";

/** Five always-visible primary destinations (icon-above-label). */
export const PRIMARY_NAV = [
  { id: "search", name: "BrowseProperties", label: "Search", public: true, alsoActive: [] },
  { id: "updates", name: "Updates", label: "Updates", public: false, alsoActive: [], badge: "notifications" },
  { id: "favorites", name: "SavedProperties", label: "Favorites", public: false, alsoActive: [] },
  { id: "plan", name: "ProjectDetail", label: "Plan", public: false, alsoActive: [] },
  { id: "inbox", name: "SharedHomes", label: "Inbox", public: false, alsoActive: [] },
];

/** Secondary destinations — desktop “More” + mobile sheet. */
export const MORE_NAV = [
  { name: "Home", label: "Score address", icon: Home, public: true, alsoActive: ["Evaluate"] },
  { name: "Compare", label: "Compare", icon: Columns, public: true },
  { name: "SearchByPreset", label: "Find by Preset", icon: Search },
  { name: "Contacts", label: "Contacts", icon: Users },
  { name: "RealtorPortal", label: "Realtors", icon: Building2 },
  { name: "Pricing", label: "Pricing", icon: Zap, public: true },
  { name: "PropertyVisits", label: "Visits", icon: Camera },
  { name: "Profile", label: "Profile", icon: UserCircle },
];

export function isNavActive(item, currentPageName) {
  if (!item || !currentPageName) return false;
  if (currentPageName === item.name) return true;
  return Array.isArray(item.alsoActive) && item.alsoActive.includes(currentPageName);
}

export function filterNavForAuth(items, isAuthenticated) {
  if (isAuthenticated) return items;
  return items.filter((i) => i.public);
}
