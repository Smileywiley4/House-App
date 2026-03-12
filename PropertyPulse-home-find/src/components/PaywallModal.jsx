import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Lock, X, Zap } from "lucide-react";

/**
 * Modal shown when a free user hits a premium feature.
 * Use with PremiumGate or open via state when user tries locked action.
 */
export default function PaywallModal({ open, onClose, featureName = "this feature", planId = "premium" }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-8 border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="w-12 h-12 rounded-xl bg-[#c9a84c]/10 flex items-center justify-center mb-5">
          <Lock size={24} className="text-[#c9a84c]" />
        </div>
        <h2 className="text-xl font-bold text-[#1a2234] mb-2">Premium feature</h2>
        <p className="text-slate-600 text-sm mb-6">
          {featureName} is available on Premium and Realtor plans. Upgrade to unlock ad-free experience, 3+ property comparison, AI insights, and more.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            to={createPageUrl("Pricing") + (planId ? `?plan=${planId}` : "")}
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl text-sm transition"
          >
            <Zap size={16} />
            View plans & upgrade
          </Link>
          <button
            onClick={onClose}
            className="w-full py-2.5 text-slate-500 font-semibold text-sm hover:text-slate-700"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
