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
  Sparkles,
} from "lucide-react";

import { brand } from "../design-tokens.js";

export const NAV_CHARCOAL = brand.charcoal;
export const NAV_MUTED = brand.muted;
export const NAV_ACTIVE = brand.active;

/** Five always-visible primary destinations (icon-above-label). */
export const PRIMARY_NAV = [
  { id: "search", name: "BrowseProperties", label: "Search", public: true, alsoActive: [] },
  { id: "updates", name: "Updates", label: "Updates", public: false, alsoActive: [], badge: "notifications" },
  { id: "favorites", name: "SavedProperties", label: "Favorites", public: false, alsoActive: [] },
  { id: "plan", name: "ProjectDetail", label: "Plan", public: false, alsoActive: [] },
  { id: "inbox", name: "SharedHomes", label: "Inbox", public: false, alsoActive: [] },
];

/**
 * Secondary destinations — desktop “More” + mobile sheet.
 * Items with `action` (no `name`) are in-app actions, not routes.
 */
export const MORE_NAV = [
  { name: "Home", label: "Score address", icon: Home, public: true, alsoActive: ["Evaluate"] },
  { name: "Compare", label: "Compare", icon: Columns, public: true },
  {
    id: "priority-quiz",
    action: "priority-quiz",
    label: "Retake quiz",
    icon: Sparkles,
    authOnly: true,
  },
  { name: "SearchByPreset", label: "Find by Preset", icon: Search },
  { name: "Contacts", label: "Contacts", icon: Users },
  { name: "RealtorPortal", label: "Realtors", icon: Building2 },
  { name: "Pricing", label: "Pricing", icon: Zap, public: true },
  { name: "PropertyVisits", label: "Visits", icon: Camera },
  { name: "Profile", label: "Profile", icon: UserCircle },
];

export function isNavActive(item, currentPageName) {
  if (!item || !currentPageName) return false;
  if (item.action) return false;
  if (currentPageName === item.name) return true;
  return Array.isArray(item.alsoActive) && item.alsoActive.includes(currentPageName);
}

export function filterNavForAuth(items, isAuthenticated) {
  if (isAuthenticated) return items;
  return items.filter((i) => i.public && !i.authOnly && !i.action);
}

/** Open the global priority quiz. Guests get the signup-style flow (local weights). */
export function runMoreNavAction(action) {
  if (action === "priority-quiz") {
    import("@/lib/importanceQuiz").then(({ requestPriorityQuiz }) => {
      requestPriorityQuiz({ trigger: "retake", force: true });
    });
  }
}
