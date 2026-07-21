/**
 * Subscription plan helpers. Use for paywall and feature gating (web + React Native).
 * Derives from auth user.plan: "free" | "premium" | "realtor" | "admin"
 */
import { useAuth } from '@/lib/AuthContext';

export const PLANS = {
  FREE: 'free',
  PREMIUM: 'premium',
  REALTOR: 'realtor',
  ADMIN: 'admin',
};

/** Free: 2 compare; Premium/Realtor/Admin: 4 */
export const FREE_MAX_COMPARE = 2;
export const PAID_MAX_COMPARE = 4;
/** Free: 2 projects; Premium/Realtor/Admin: 20 */
export const FREE_MAX_PROJECTS = 2;
export const PAID_MAX_PROJECTS = 20;

export function usePlan() {
  const { user } = useAuth();
  const plan = user?.plan ?? PLANS.FREE;

  const isFree = plan === PLANS.FREE;
  const isPremium = plan === PLANS.PREMIUM || plan === PLANS.REALTOR || plan === PLANS.ADMIN;
  const isRealtor = plan === PLANS.REALTOR || plan === PLANS.ADMIN;
  const isAdmin = plan === PLANS.ADMIN;

  /**
   * Guests (no plan → free) and free accounts see ads.
   * Premium / Pro / Realtor / Admin never see ads (`isPremium` includes those tiers).
   */
  const showAds = isFree;
  /** Can compare 3+ properties side-by-side */
  const canCompare3Plus = isPremium;
  /** Can use AI features (auto-score, insights, recommendations) */
  const canUseAIFeatures = isPremium;
  /** Can access Realtor portal (clients, private listings) */
  const canAccessRealtorPortal = isRealtor;
  /** Max properties in a compare session (browse checkboxes / Compare) */
  const maxCompareCount = isPremium ? PAID_MAX_COMPARE : FREE_MAX_COMPARE;
  /** Max scoring projects (folders) */
  const maxProjects = isPremium ? PAID_MAX_PROJECTS : FREE_MAX_PROJECTS;

  return {
    plan,
    isFree,
    isPremium,
    isRealtor,
    isAdmin,
    showAds,
    canCompare3Plus,
    canUseAIFeatures,
    canAccessRealtorPortal,
    maxCompareCount,
    maxProjects,
  };
}
