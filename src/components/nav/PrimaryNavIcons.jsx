/**
 * Primary nav icons — lucide-react only (stroke, consistent with app UI).
 */
import { Search, Bell, Heart, FolderKanban, Inbox } from "lucide-react";

const ICON_BY_ID = {
  search: Search,
  updates: Bell,
  favorites: Heart,
  plan: FolderKanban,
  inbox: Inbox,
};

export function PrimaryNavIcon({ id, size = 22, strokeWidth = 1.75, className }) {
  const Icon = ICON_BY_ID[id] || Search;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}

export function SearchNavIcon(props) {
  return <PrimaryNavIcon id="search" {...props} />;
}
export function UpdatesNavIcon(props) {
  return <PrimaryNavIcon id="updates" {...props} />;
}
export function FavoritesNavIcon(props) {
  return <PrimaryNavIcon id="favorites" {...props} />;
}
export function PlanNavIcon(props) {
  return <PrimaryNavIcon id="plan" {...props} />;
}
export function InboxNavIcon(props) {
  return <PrimaryNavIcon id="inbox" {...props} />;
}
