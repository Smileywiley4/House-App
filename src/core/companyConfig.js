/**
 * Company-facing copy for legal, support, and trust surfaces.
 * Override via env where noted.
 */
import { APP_NAME } from '@/core/constants';

export const COMPANY_LEGAL_NAME = 'WileyWorx LLC';
export const COMPANY_TAGLINE = 'Compare & score homes with confidence';
export const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL || 'support@proppocket.com';
export const SUPPORT_URL =
  import.meta.env.VITE_SUPPORT_URL || '/Support';
/** Governing law placeholder for Terms — confirm with counsel before launch. */
export const GOVERNING_LAW_STATE = 'Texas';

export const LEGAL_LAST_UPDATED = 'July 21, 2026';

export const PRODUCT_DISCLAIMER =
  `${APP_NAME} is a decision-support tool for home buyers and real estate professionals. Scores reflect your weights and inputs — not appraisals, inspections, or investment advice. Always verify facts independently and consult licensed professionals before making purchase decisions.`;

/** Inline near Property Score (Evaluate) — complements PropertyOverview verify-facts copy. */
export const PROPERTY_SCORE_DISCLAIMER =
  'This score reflects your own stated preferences and publicly available data — it is not an appraisal and should not be the sole basis for a purchase decision.';

/** Inline near off-market / estimated values (BrowseProperties). */
export const OFF_MARKET_ESTIMATE_DISCLAIMER =
  'Off-market estimates are not appraisals and should not be the sole basis for a purchase decision.';

export const AI_DISCLAIMER =
  'AI-generated insights are informational only. They may be incomplete or outdated. Do not rely on them as the sole basis for a purchase, listing price, or legal/financial decision.';
