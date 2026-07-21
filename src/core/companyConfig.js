/**
 * Company-facing copy for legal, support, and trust surfaces.
 * Override via env where noted.
 */
import { APP_NAME } from '@/core/constants';

export const COMPANY_LEGAL_NAME = 'Property Pocket';
export const COMPANY_TAGLINE = 'Compare & score homes with confidence';
export const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL || 'support@proppocket.com';
export const SUPPORT_URL =
  import.meta.env.VITE_SUPPORT_URL || '/Support';

export const LEGAL_LAST_UPDATED = 'July 21, 2026';

export const PRODUCT_DISCLAIMER =
  `${APP_NAME} is a decision-support tool for home buyers and real estate professionals. Scores reflect your weights and inputs — not appraisals, inspections, or investment advice. Always verify facts independently and consult licensed professionals before making purchase decisions.`;

export const AI_DISCLAIMER =
  'AI-generated insights are informational only. They may be incomplete or outdated. Do not rely on them as the sole basis for a purchase, listing price, or legal/financial decision.';
