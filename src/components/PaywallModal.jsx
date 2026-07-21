import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Lock, X, Zap } from "lucide-react";
import { api } from "@/api";
import { useAuth } from "@/lib/AuthContext";

/**
 * Modal shown when a free user hits a premium feature.
 * Includes a subtle promo-code redeem section.
 */
export default function PaywallModal({ open, onClose, featureName = "this feature", planId = "premium" }) {
  const { isAuthenticated, refreshUser } = useAuth();
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [grantPlan, setGrantPlan] = useState(planId === "realtor" ? "realtor" : "premium");
  const [applying, setApplying] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeSuccess, setCodeSuccess] = useState("");

  if (!open) return null;

  const applyCode = async () => {
    setCodeError("");
    setCodeSuccess("");
    const trimmed = code.trim();
    if (!trimmed) {
      setCodeError("Enter a code.");
      return;
    }
    if (!isAuthenticated) {
      setCodeError("Sign in to apply a code.");
      return;
    }
    setApplying(true);
    try {
      const result = await api.promo.redeem(trimmed, grantPlan);
      setCodeSuccess(result?.message || `Code applied. Plan is now ${result?.plan || "updated"}.`);
      try {
        await refreshUser?.();
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        onClose?.();
      }, 900);
    } catch (err) {
      let message = err?.message || "Could not apply that code.";
      try {
        const parsed = JSON.parse(message);
        if (typeof parsed?.detail === "string") message = parsed.detail;
      } catch {
        /* plain text */
      }
      setCodeError(message);
    } finally {
      setApplying(false);
    }
  };

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
        <p className="text-slate-600 text-sm mb-4">
          {featureName} is available on Premium and Realtor plans. Upgrade to unlock ad-free experience, 3+ property comparison, AI insights, and more.
        </p>
        <p className="text-slate-500 text-xs mb-6 leading-relaxed">
          Premium starts at $3.99/mo or $39.99/yr. Subscribes with auto-renewal; cancel anytime in Profile/billing.
          See{' '}
          <Link to={createPageUrl("Terms")} className="text-[#10b981] hover:underline" onClick={onClose}>
            Terms
          </Link>
          {' '}and{' '}
          <Link to={createPageUrl("Privacy")} className="text-[#10b981] hover:underline" onClick={onClose}>
            Privacy
          </Link>
          .
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

        <div className="mt-6 pt-4 border-t border-slate-100">
          {!showCode ? (
            <button
              type="button"
              onClick={() => setShowCode(true)}
              className="text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
            >
              Have an access code?
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Enter an access or promo code</p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                autoComplete="off"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold tracking-wide text-[#1a2234] focus:outline-none focus:border-[#10b981]"
              />
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-400 shrink-0">Unlock as</label>
                <select
                  value={grantPlan}
                  onChange={(e) => setGrantPlan(e.target.value)}
                  className="flex-1 text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-600"
                >
                  <option value="premium">Premium</option>
                  <option value="realtor">Realtor</option>
                </select>
              </div>
              {codeError && <p className="text-xs text-red-600 font-semibold">{codeError}</p>}
              {codeSuccess && <p className="text-xs text-[#059669] font-semibold">{codeSuccess}</p>}
              <button
                type="button"
                onClick={applyCode}
                disabled={applying}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {applying ? "Applying…" : "Apply code"}
              </button>
              {!isAuthenticated && (
                <p className="text-[11px] text-slate-400">
                  <Link to={createPageUrl("Login")} className="text-[#10b981] font-semibold hover:underline">
                    Sign in
                  </Link>{" "}
                  first, then apply your code.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
