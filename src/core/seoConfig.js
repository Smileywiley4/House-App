/**
 * Per-route SEO copy (titles + meta descriptions).
 * Canonical URLs and OG image use VITE_SITE_URL / VITE_OG_IMAGE_URL from env — see docs/GOOGLE_ADS_AND_SEO.md
 */
import { APP_NAME } from '@/core/constants';

export const DEFAULT_SITE_DESCRIPTION =
  'Search by address, score homes with custom categories, and compare properties side by side. Optional Premium AI insights and Realtor tools.';

/** @type {Record<string, { title: string; description: string; noindex?: boolean }>} */
export const SEO_BY_PAGE = {
  Home: {
    title: 'Search & score homes',
    description:
      'Compare properties with weighted scores. Enter an address, pick what matters—schools, commute, noise—and see clear side-by-side results.',
  },
  BrowseProperties: {
    title: 'Search properties on the map',
    description:
      'Browse live for-sale listings and off-market value estimates across the U.S. Filter by price, beds, baths, and more, then score homes to compare.',
  },
  QuickCompare: {
    title: 'Compare properties',
    description: 'Compare homes side by side with weighted scores and category breakdowns.',
    noindex: true,
  },
  SearchByPreset: {
    title: 'Find homes by preset',
    description: 'Search listings using saved preference presets—budget, beds, location, and custom score weights.',
  },
  Compare: {
    title: 'Compare properties',
    description: 'Compare multiple homes side by side with totals, category breakdowns, and plan-based slot limits.',
  },
  SideBySide: {
    title: 'Compare properties',
    description: 'Compare multiple homes side by side with totals, category breakdowns, and plan-based slot limits.',
    noindex: true,
  },
  SavedProperties: {
    title: 'Your scored properties',
    description: `View and manage properties you have scored in ${APP_NAME}.`,
  },
  Updates: {
    title: 'Updates',
    description: 'Notifications, shared project activity, and completed scores from your network.',
    noindex: true,
  },
  ProjectDetail: {
    title: 'Scoring projects',
    description: 'Organize homes into projects with custom scoring preferences and overall match scores.',
    noindex: true,
  },
  Evaluate: {
    title: 'Evaluate a property',
    description: 'Deep evaluation and scoring for a single property address.',
  },
  Pricing: {
    title: 'Pricing & plans',
    description: `Free compare and search; Premium unlocks more compares and AI. Realtor plan for client tools in ${APP_NAME}.`,
  },
  Profile: {
    title: 'Your profile',
    description: 'Account settings, default score weights, and subscription.',
    noindex: true,
  },
  RealtorPortal: {
    title: 'Realtor portal',
    description: 'Manage clients, private listings, and shared buyer visit scores.',
    noindex: true,
  },
  PropertyVisits: {
    title: 'Property visits',
    description: 'Save visit photos, notes, and scores; share with your Realtor when linked.',
    noindex: true,
  },
  SharedComparison: {
    title: 'Shared comparison',
    description: 'A comparison shared with you in Property Pocket.',
  },
  PreferenceCard: {
    title: 'Preference pattern',
    description: 'A preferences-only scoring pattern shared from Property Pocket — no addresses, prices, or photos.',
    noindex: true,
  },
  About: {
    title: 'About us',
    description: 'Learn how Property Pocket helps home buyers compare properties with transparent, weighted scoring.',
  },
  Privacy: {
    title: 'Privacy policy',
    description: 'How Property Pocket collects, uses, and protects your personal information.',
  },
  Terms: {
    title: 'Terms of service',
    description: 'Terms governing your use of Property Pocket and related subscriptions.',
  },
  Support: {
    title: 'Help & support',
    description: 'Contact Property Pocket for account, billing, and product help.',
  },
};

export const SITE_NAME = APP_NAME;
