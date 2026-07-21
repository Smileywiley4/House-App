/**
 * Property Pocket design tokens — single source of truth for brand hex.
 *
 * To rebrand: change one hex here (e.g. `primary`), then rebuild.
 * CSS variables are injected from this file in `main.jsx` + mirrored in
 * `src/styles/tokens.css` for Tailwind / first paint.
 *
 * Spacing scale (prefer Tailwind defaults): 4, 8, 12, 16, 24, 32, 48
 * (p-1, p-2, p-3, p-4, p-6, p-8, p-12)
 */

/** @typedef {{ hex: string, hsl: string, rgb: string }} ColorToken */

export const brand = {
  /** Emerald — primary actions, links, focus */
  primary: "#10b981",
  primaryHover: "#059669",
  primaryDeep: "#047857",
  /** Navy — headings, secondary CTAs, chrome */
  navy: "#1a2234",
  navyHover: "#243050",
  /** Gold — premium / accent marks */
  gold: "#c9a84c",
  /** Neutrals */
  charcoal: "#2d3340",
  muted: "#6b7280",
  active: "#111827",
  /** Semantic */
  success: "#22c55e",
  warning: "#eab308",
  danger: "#ef4444",
};

/** HSL channels (no `hsl()`) for shadcn-style Tailwind opacity modifiers */
export const brandHsl = {
  primary: "160 84% 39%",
  primaryHover: "161 94% 30%",
  primaryDeep: "163 94% 24%",
  navy: "222 33% 15%",
  navyHover: "222 31% 23%",
  gold: "43 54% 54%",
  charcoal: "220 16% 22%",
  muted: "220 9% 46%",
  success: "142 71% 45%",
  warning: "45 93% 47%",
  danger: "0 84% 60%",
};

/** RGB channels for glow / rgba helpers */
export const brandRgb = {
  primary: "16 185 129",
  navy: "26 34 52",
  gold: "201 168 76",
};

export const radius = {
  card: "0.75rem",
  control: "0.5rem",
  pill: "9999px",
};

export const shadow = {
  card: "0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.08)",
  elev: "0 4px 14px -2px rgb(15 23 42 / 0.12), 0 2px 6px -2px rgb(15 23 42 / 0.08)",
};

/** Shared motion — hover, expand, modal */
export const motion = {
  duration: "160ms",
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
};

export const fontFamily = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  display: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

/** Type scale — use with `.text-h1` … `.text-caption` utilities */
export const typeScale = {
  h1: { size: "2.25rem", weight: "700", line: "1.2" },
  h2: { size: "1.875rem", weight: "700", line: "1.25" },
  h3: { size: "1.5rem", weight: "700", line: "1.3" },
  h4: { size: "1.25rem", weight: "600", line: "1.35" },
  h5: { size: "1.125rem", weight: "600", line: "1.4" },
  h6: { size: "1rem", weight: "600", line: "1.4" },
  body: { size: "0.875rem", weight: "400", line: "1.5" },
  bodyLg: { size: "1rem", weight: "400", line: "1.55" },
  caption: { size: "0.75rem", weight: "500", line: "1.4" },
  micro: { size: "0.625rem", weight: "600", line: "1.3" },
};

/**
 * CSS custom properties string injected at startup.
 * Edit `brand.*` hex above — this block follows automatically.
 */
export function brandTokensCss() {
  const b = brand;
  const h = brandHsl;
  const r = brandRgb;
  return `
:root {
  --brand-primary: ${b.primary};
  --brand-primary-hover: ${b.primaryHover};
  --brand-primary-deep: ${b.primaryDeep};
  --brand-navy: ${b.navy};
  --brand-navy-hover: ${b.navyHover};
  --brand-gold: ${b.gold};
  --brand-charcoal: ${b.charcoal};
  --brand-muted: ${b.muted};
  --brand-active: ${b.active};
  --brand-success: ${b.success};
  --brand-warning: ${b.warning};
  --brand-danger: ${b.danger};

  --brand-primary-hsl: ${h.primary};
  --brand-primary-hover-hsl: ${h.primaryHover};
  --brand-primary-deep-hsl: ${h.primaryDeep};
  --brand-navy-hsl: ${h.navy};
  --brand-navy-hover-hsl: ${h.navyHover};
  --brand-gold-hsl: ${h.gold};
  --brand-charcoal-hsl: ${h.charcoal};
  --brand-muted-hsl: ${h.muted};
  --brand-success-hsl: ${h.success};
  --brand-warning-hsl: ${h.warning};
  --brand-danger-hsl: ${h.danger};

  --brand-primary-rgb: ${r.primary};
  --brand-navy-rgb: ${r.navy};
  --brand-gold-rgb: ${r.gold};
  --pp-glow: ${r.primary};

  --radius-card: ${radius.card};
  --radius-control: ${radius.control};
  --radius-pill: ${radius.pill};
  --radius: ${radius.control};

  --shadow-card: ${shadow.card};
  --shadow-elev: ${shadow.elev};

  --motion-duration: ${motion.duration};
  --motion-ease: ${motion.ease};

  --font-sans: ${fontFamily.sans};
  --font-display: ${fontFamily.display};

  /* Map shadcn semantic tokens → brand */
  --primary: ${h.primary};
  --primary-foreground: 0 0% 100%;
  --ring: ${h.primary};
  --destructive: ${h.danger};
  --accent: ${h.primary};
  --accent-foreground: 0 0% 100%;
}
`.trim();
}

/** Legacy THEME shape used across the app */
export const THEME = {
  accent: brand.primary,
  accentHover: brand.primaryHover,
  accentLight: `rgba(${brandRgb.primary.replace(/ /g, ",")},0.12)`,
  accentText: brand.primary,
  gold: brand.gold,
  navy: brand.navy,
  navyLight: brand.navyHover,
};
