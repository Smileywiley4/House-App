import { useState } from "react";
import { usePlan } from "@/core/hooks/usePlan";
import PaywallModal from "@/components/PaywallModal";
import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * Renders children if user has premium; otherwise shows lock message and can open paywall.
 * Use for AI features, 3+ compare, etc.
 */
export function PremiumGate({ children, featureName = "This feature", planId = "premium", showLockMessage = true }) {
  const { canUseAIFeatures } = usePlan();
  const [showPaywall, setShowPaywall] = useState(false);

  if (canUseAIFeatures) return children;

  if (!showLockMessage) return null;

  return (
    <>
      <div className="rounded-2xl border border-[#c9a84c]/30 bg-[#c9a84c]/5 p-6 text-center">
        <Lock size={28} className="text-[#c9a84c] mx-auto mb-3" />
        <p className="text-[#1a2234] font-semibold mb-1">{featureName} is a Premium feature</p>
        <p className="text-slate-500 text-sm mb-4">Upgrade to unlock AI insights, 3+ property comparison, and ad-free experience.</p>
        <button
          onClick={() => setShowPaywall(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm transition"
        >
          Upgrade to Premium
        </button>
        <p className="mt-3">
          <Link to={createPageUrl("Pricing")} className="text-xs text-slate-400 hover:text-[#10b981]">
            View pricing
          </Link>
        </p>
      </div>
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} featureName={featureName} planId={planId} />
    </>
  );
}

/**
 * Inline lock badge for small areas (e.g. "AI Auto-Score" section).
 */
export function PremiumBadge({ featureName = "Premium" }) {
  const { canUseAIFeatures } = usePlan();
  const [showPaywall, setShowPaywall] = useState(false);
  if (canUseAIFeatures) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setShowPaywall(true)}
        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/20 px-2 py-0.5 rounded-full"
      >
        <Lock size={10} /> {featureName}
      </button>
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} featureName={featureName} />
    </>
  );
}
