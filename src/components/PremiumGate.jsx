import { useState } from "react";
import { usePlan } from "@/core/hooks/usePlan";
import PaywallModal from "@/components/PaywallModal";
import { Lock, Sparkles } from "lucide-react";
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
      <div className="rounded-2xl border border-[#E8A33D]/30 bg-[#E8A33D]/5 p-6 text-center">
        <Lock size={28} className="text-[#E8A33D] mx-auto mb-3" />
        <p className="text-[#14192E] font-semibold mb-1">{featureName} is a Premium feature</p>
        <p className="text-slate-500 text-sm mb-4">Upgrade to unlock AI insights, 3+ property comparison, and ad-free experience.</p>
        <button
          onClick={() => setShowPaywall(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#106B49] hover:bg-[#0C4F37] text-white font-semibold rounded-xl text-sm transition"
        >
          Upgrade to Premium
        </button>
        <p className="mt-3">
          <Link to={createPageUrl("Pricing")} className="text-xs text-slate-400 hover:text-[#106B49]">
            View pricing
          </Link>
        </p>
      </div>
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} featureName={featureName} planId={planId} />
    </>
  );
}

export function PremiumFeatureGroup({ children }) {
  const { canUseAIFeatures } = usePlan();
  const [showPaywall, setShowPaywall] = useState(false);

  if (canUseAIFeatures) return children;

  return (
    <>
      <div className="flex flex-col gap-4 rounded-xl border border-[#E8A33D]/25 bg-gradient-to-r from-[#14192E] to-[#2A3150] px-4 py-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8A33D]/15 text-[#E8A33D]">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Unlock your complete scoring toolkit</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              Guided walk-through, AI Auto-Score, personalized score explanations, larger comparisons, and no ads.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPaywall(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#106B49] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0C4F37]"
        >
          <Lock size={14} /> Unlock Premium
        </button>
      </div>
      <PaywallModal
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Premium scoring toolkit"
        planId="premium"
      />
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
        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#E8A33D] bg-[#E8A33D]/10 border border-[#E8A33D]/20 px-2 py-0.5 rounded-full"
      >
        <Lock size={10} /> {featureName}
      </button>
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} featureName={featureName} />
    </>
  );
}
