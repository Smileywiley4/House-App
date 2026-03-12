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

export function usePlan() {
  const { user } = useAuth();
  const plan = user?.plan ?? PLANS.FREE;

  const isFree = plan === PLANS.FREE;
  const isPremium = plan === PLANS.PREMIUM || plan === PLANS.REALTOR || plan === PLANS.ADMIN;
  const isRealtor = plan === PLANS.REALTOR || plan === PLANS.ADMIN;
  const isAdmin = plan === PLANS.ADMIN;

  /** Free users see ads; premium/realtor do not */
  const showAds = isFree;
  /** Can compare 3+ properties side-by-side */
  const canCompare3Plus = isPremium;
  /** Can use AI features (auto-score, insights, recommendations) */
  const canUseAIFeatures = isPremium;
  /** Can access Realtor portal (clients, private listings) */
  const canAccessRealtorPortal = isRealtor;
  /** Max properties to compare in SideBySide */
  const maxCompareCount = canCompare3Plus ? 10 : 2;

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
  };
}
