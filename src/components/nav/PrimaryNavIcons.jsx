/**
 * Flat monochrome icons matching the primary nav mock.
 */
const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function SearchNavIcon({ size = 22, className, strokeWidth = 1.75 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps} strokeWidth={strokeWidth}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function UpdatesNavIcon({ size = 22, className, strokeWidth = 1.75 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps} strokeWidth={strokeWidth}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
      <path d="M11 13.2l-2.1-2.05a1.35 1.35 0 0 1 1.9-1.92L11 9.4l.2-.17a1.35 1.35 0 0 1 1.9 1.92L11 13.2z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FavoritesNavIcon({ size = 22, className, strokeWidth = 1.75 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps} strokeWidth={strokeWidth}>
      <path d="M12 20s-6.5-4.1-8.4-7.6C2.2 9.9 3.4 7 6.1 6.4c1.6-.3 3.1.4 3.9 1.7.8-1.3 2.3-2 3.9-1.7 2.7.6 3.9 3.5 2.5 5.9C18.5 15.9 12 20 12 20z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PlanNavIcon({ size = 22, className, strokeWidth = 1.75 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps} strokeWidth={strokeWidth}>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5z" />
      <path d="M9.2 13.2l1.8 1.8 3.8-3.8" />
    </svg>
  );
}

export function InboxNavIcon({ size = 22, className, strokeWidth = 1.75 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps} strokeWidth={strokeWidth}>
      <path d="M4 13h4l1.5 2.5h5L16 13h4v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6z" />
      <path d="M4 13l2.5-7.5A1 1 0 0 1 7.4 5h9.2a1 1 0 0 1 .9.5L20 13" />
    </svg>
  );
}

const ICON_BY_ID = {
  search: SearchNavIcon,
  updates: UpdatesNavIcon,
  favorites: FavoritesNavIcon,
  plan: PlanNavIcon,
  inbox: InboxNavIcon,
};

export function PrimaryNavIcon({ id, ...props }) {
  const Icon = ICON_BY_ID[id] || SearchNavIcon;
  return <Icon {...props} />;
}
