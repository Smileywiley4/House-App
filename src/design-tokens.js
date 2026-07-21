/**
 * Propurty design tokens — single source of truth for brand hex.
 *
 * Canonical CSS vars also live in `propurty-brand/tokens/tokens.css` (imported
 * globally). This module mirrors those values for JS (THEME, runtime inject)
 * and keeps shadcn `--primary` HSL in sync.
 *
 * Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64
 */

/** @typedef {{ hex: string, hsl: string, rgb: string }} ColorToken */

export const brand = {
  /** Propurty green — primary actions, links, focus */
  primary: '#106B49',
  primaryHover: '#0C4F37',
  primaryDeep: '#0C4F37',
  /** Navy — headings, secondary CTAs, chrome */
  navy: '#14192E',
  navyHover: '#2A3150',
  /** Amber — accent only (sparingly) */
  gold: '#E8A33D',
  /** Neutrals */
  charcoal: '#3A3935',
  muted: '#6B6963',
  active: '#14192E',
  /** Semantic */
  success: '#106B49',
  warning: '#E8A33D',
  danger: '#C6493F',
};

/** HSL channels (no `hsl()`) for shadcn-style Tailwind opacity modifiers */
export const brandHsl = {
  primary: '158 74% 24%',
  primaryHover: '159 74% 18%',
  primaryDeep: '159 74% 18%',
  navy: '228 39% 13%',
  navyHover: '229 31% 24%',
  gold: '36 79% 57%',
  charcoal: '48 5% 22%',
  muted: '45 4% 40%',
  success: '158 74% 24%',
  warning: '36 79% 57%',
  danger: '4 54% 51%',
};

/** RGB channels for glow / rgba helpers */
export const brandRgb = {
  primary: '16 107 73',
  navy: '20 25 46',
  gold: '232 163 61',
};

export const radius = {
  card: '12px',
  control: '8px',
  pill: '999px',
};

export const shadow = {
  card: '0 1px 2px rgba(20, 25, 46, 0.06)',
  elev: '0 4px 12px rgba(20, 25, 46, 0.08)',
};

/** Shared motion — hover, expand, modal */
export const motion = {
  duration: '200ms',
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

export const fontFamily = {
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  display: "'Manrope', 'Plus Jakarta Sans', system-ui, sans-serif",
  heading: "'Manrope', 'Plus Jakarta Sans', system-ui, sans-serif",
  body: "'Inter', system-ui, -apple-system, sans-serif",
};

/** Type scale — use with `.text-h1` … `.text-caption` utilities */
export const typeScale = {
  h1: { size: '2.25rem', weight: '700', line: '1.2' },
  h2: { size: '1.875rem', weight: '700', line: '1.25' },
  h3: { size: '1.5rem', weight: '700', line: '1.3' },
  h4: { size: '1.25rem', weight: '600', line: '1.35' },
  h5: { size: '1.125rem', weight: '600', line: '1.4' },
  h6: { size: '1rem', weight: '600', line: '1.4' },
  body: { size: '0.875rem', weight: '400', line: '1.5' },
  bodyLg: { size: '1rem', weight: '400', line: '1.55' },
  caption: { size: '0.75rem', weight: '500', line: '1.4' },
  micro: { size: '0.625rem', weight: '600', line: '1.3' },
};

/**
 * CSS custom properties string injected at startup.
 * Keeps `--brand-*` aliases aligned with Propurty tokens for existing UI.
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
  --font-heading: ${fontFamily.heading};
  --font-body: ${fontFamily.body};

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
  accentLight: `rgba(${brandRgb.primary.replace(/ /g, ',')},0.12)`,
  accentText: brand.primary,
  gold: brand.gold,
  navy: brand.navy,
  navyLight: brand.navyHover,
};
