import { useState } from "react";
import { Check, Zap, Lock, Star, Users, Map, Building2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api";
import { useAuth } from "@/lib/AuthContext";

const PLANS = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    annual: 0,
    tagline: "Perfect for home buyers comparing a few options.",
    accent: false,
    cta: "Get Started Free",
    ctaLink: true,
    features: [
      "Compare up to 2 properties side-by-side",
      "30+ weighted scoring categories",
      "Mandatory & custom category weights",
      "Save & revisit property scorecards",
      "Mobile-friendly for walk-throughs",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    monthly: 6.99,
    annual: 74.99,
    tagline: "For serious buyers who want every advantage.",
    badge: "✦ POPULAR",
    accent: true,
    cta: "Upgrade to Premium",
    features: [
      "Everything in Free",
      "Compare 3+ properties at once",
      "Gamified live walk-through mode",
      "Add fully custom categories",
      "Preset weight profiles (save & reuse)",
      "Folder organization for searches",
      "Priority support",
    ],
  },
  {
    id: "realtor",
    name: "Realtor",
    monthly: 19.99,
    annual: 199.99,
    tagline: "For real estate professionals and their clients.",
    accent: false,
    dark: true,
    cta: "Get Realtor Access",
    features: [
      "Everything in Premium",
      "Private listing database",
      "Client management tools",
      "Share scorecards with clients",
      "Score off-market properties",
      "Realtor profile & license verification",
      "Client comparison reports (soon)",
      "MLS integration (coming soon)",
    ],
  },
];

const COMING_SOON = [
  { icon: Zap, title: "Gamified Walk-Through", desc: "A quick, game-like survey during live home tours that auto-scores each category as you walk through." },
  { icon: Users, title: "Client Sharing", desc: "Send polished comparison reports directly to buyers. Let clients view and react to scored homes in real time." },
  { icon: Map, title: "Market Insights", desc: "Neighborhood trend data, school ratings, and investment potential scores powered by live data sources." },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const { isAuthenticated } = useAuth();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const interval = annual ? "annual" : "monthly";
  // Update this whenever you change the on-screen terms content.
  const termsVersion = "2026-02";

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      {/* Header */}
      <div className="relative overflow-hidden bg-[#1a2234] px-6 py-16 text-center">
        <div className="absolute inset-0">
          <img src="/banner-pricing.png" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#1a2234]/70" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#10b981]/15 text-[#10b981] text-xs font-bold px-4 py-2 rounded-full mb-6 border border-[#10b981]/20">
            <Zap size={12} /> Simple, transparent pricing
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Score smarter.<br />
            <span className="text-[#10b981]">Compare with confidence.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-8">Start free. Upgrade when you're ready for more.</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-white/10 rounded-xl p-1 gap-1">
            <button onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${!annual ? "bg-white text-[#1a2234]" : "text-slate-400 hover:text-white"}`}>
              Monthly
            </button>
            <button onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${annual ? "bg-white text-[#1a2234]" : "text-slate-400 hover:text-white"}`}>
              Annual
              <span className="text-[10px] bg-[#10b981] text-white font-bold px-2 py-0.5 rounded-full">Save ~15%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto mb-10">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => {
                  setCheckoutError("");
                  setTermsAccepted(e.target.checked);
                }}
                className="mt-1 h-4 w-4 accent-[#10b981]"
                aria-label="Accept Terms and Conditions"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1a2234]">
                  I agree to the Terms & Conditions and authorize recurring billing
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  By selecting <span className="font-semibold">{interval === "annual" ? "Annual" : "Monthly"}</span>{" "}
                  billing for your Premium/Realtor plan, you authorize PropertyPulse to charge the payment method you provide{" "}
                  on a {interval === "annual" ? "yearly" : "monthly"} basis. Your subscription automatically renews unless you cancel.
                  If you cancel, your billing stops after your current billing period ends.
                </p>
                <details className="mt-3">
                  <summary className="text-xs font-semibold text-[#1a2234] cursor-pointer">
                    Terms & Conditions (template)
                  </summary>
                  <div className="mt-3 text-[11px] text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3 max-h-52 overflow-y-auto">
                    <p className="mb-2">
                      1) Service. PropertyPulse provides subscription features for property scoring, comparison, and related tools.
                    </p>
                    <p className="mb-2">
                      2) Payment Authorization. You authorize recurring charges via Stripe for the selected plan and billing interval.
                      Charges may be processed by Stripe and shown on your statement under the merchant descriptor used by Stripe.
                    </p>
                    <p className="mb-2">
                      3) Auto-Renewal. Subscriptions renew automatically for the selected interval unless cancelled in your account.
                    </p>
                    <p className="mb-2">
                      4) Cancellation. If you cancel, you will keep access through the end of your current billing period; no further charges will be made after the period ends.
                    </p>
                    <p className="mb-2">
                      5) Refunds. Refunds (if any) are handled in accordance with our refund policy as described in the full Terms & Conditions.
                    </p>
                    <p className="mb-2">
                      6) Legal & Compliance. You agree to comply with applicable laws, and you consent to processing of your payment details by Stripe as required to complete billing.
                    </p>
                    <p className="mb-0">
                      Replace this template with your final Terms & Conditions drafted/approved by legal counsel. This UI is a technical implementation only.
                    </p>
                  </div>
                </details>
              </div>
            </div>
            {checkoutError && (
              <p className="text-xs text-red-600 mt-3 font-semibold bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {checkoutError}
              </p>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              annual={annual}
              interval={interval}
              acceptedTerms={termsAccepted}
              isAuthenticated={isAuthenticated}
              termsVersion={termsVersion}
              onSetError={setCheckoutError}
            />
          ))}
        </div>

        {/* Coming Soon */}
        <div className="mt-16">
          <h2 className="text-center text-lg font-bold text-[#1a2234] mb-2 flex items-center justify-center gap-2">
            <Star size={18} className="text-[#c9a84c]" /> Premium Features — Coming Soon
          </h2>
          <p className="text-center text-slate-400 text-sm mb-8">Included in Premium & Realtor plans once launched.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {COMING_SOON.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-3 right-3"><Lock size={12} className="text-slate-300" /></div>
                <div className="w-10 h-10 rounded-xl bg-[#c9a84c]/10 flex items-center justify-center mb-4">
                  <Icon size={18} className="text-[#c9a84c]" />
                </div>
                <h3 className="font-bold text-[#1a2234] mb-2 text-sm">{title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                <div className="mt-4 text-xs font-semibold text-[#c9a84c] bg-[#c9a84c]/8 border border-[#c9a84c]/15 inline-block px-3 py-1 rounded-full">
                  Coming Soon
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Realtor CTA */}
        <div className="mt-12 bg-[#1a2234] rounded-2xl p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#10b981] opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Building2 size={32} className="text-[#10b981] mx-auto mb-4" />
          <div className="text-[#10b981] text-xs font-bold uppercase tracking-widest mb-2">For Real Estate Professionals</div>
          <h3 className="text-2xl font-bold text-white mb-3">Use HomeScore with your clients</h3>
          <p className="text-slate-400 max-w-xl mx-auto text-sm mb-6">
            Access private listing tools, manage client scorecards, and use HomeScore as your professional edge — including with off-market and pre-MLS properties.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={createPageUrl("RealtorPortal")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl text-sm transition">
              View Realtor Portal
            </Link>
            <button
              onClick={async () => {
                try {
                  setCheckoutError("");
                  if (!isAuthenticated) {
                    const base = typeof window !== "undefined" ? window.location.origin : "";
                    window.location.href = `${base}/login?redirect=${encodeURIComponent(`${base}/Pricing`)}`;
                    return;
                  }
                  if (!termsAccepted) {
                    setCheckoutError("Please accept the Terms & Conditions to continue with checkout.");
                    return;
                  }
                  const base = typeof window !== "undefined" ? window.location.origin : "";
                  const { url } = await api.subscription.createCheckoutSession({
                    planId: "realtor",
                    interval,
                    terms_accepted: termsAccepted,
                    terms_version: termsVersion,
                    successUrl: `${base}/Profile?upgraded=1`,
                    cancelUrl: `${base}/Pricing`,
                  });
                  if (url) window.location.href = url;
                } catch (err) {
                  console.error(err);
                  setCheckoutError(err?.message || "Could not start checkout. Try again or contact support.");
                }
              }}
              disabled={!termsAccepted}
              className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 text-white font-semibold rounded-xl text-sm hover:bg-white/5 transition disabled:opacity-60">
              Upgrade to Realtor — ${annual ? "199.99/yr" : "19.99/mo"}
            </button>
          </div>
        </div>

        {/* FAQ note */}
        <p className="text-center text-xs text-slate-400 mt-10">
          All plans include a 14-day free trial. Cancel anytime. Questions? Contact us at hello@homescore.app
        </p>
      </div>
    </div>
  );
}

function PlanCard({ plan, annual, interval, acceptedTerms, isAuthenticated, termsVersion, onSetError }) {
  const [loading, setLoading] = useState(false);
  const price = annual && plan.annual > 0
    ? plan.annual
    : plan.monthly;
  const period = annual && plan.annual > 0 ? "/yr" : "/mo";

  const base = plan.dark
    ? "bg-[#1a2234] border-[#10b981]/20 text-white"
    : plan.accent
    ? "bg-white border-[#10b981] shadow-lg"
    : "bg-white border-slate-200";

  return (
    <div className={`rounded-2xl border p-7 shadow-sm relative overflow-hidden flex flex-col ${base}`}>
      {plan.accent && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#10b981] opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
      )}
      <div className="relative flex-1">
        <div className="flex items-center justify-between mb-1">
          <div className={`text-xs font-bold uppercase tracking-widest ${plan.accent ? "text-[#10b981]" : plan.dark ? "text-[#10b981]" : "text-slate-500"}`}>
            {plan.name}
          </div>
          {plan.badge && (
            <span className="text-[10px] font-bold text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/20 px-2 py-0.5 rounded-full">
              {plan.badge}
            </span>
          )}
        </div>

        <div className="flex items-end gap-1 mb-1">
          <span className={`text-4xl font-bold ${plan.dark ? "text-white" : "text-[#1a2234]"}`}>
            {plan.monthly === 0 ? "$0" : `$${price}`}
          </span>
          {plan.monthly > 0 && <span className={`mb-1 text-sm ${plan.dark ? "text-slate-400" : "text-slate-400"}`}>{period}</span>}
        </div>
        {annual && plan.annual > 0 && (
          <div className="text-[10px] text-[#10b981] font-semibold mb-1">
            (${(plan.annual / 12).toFixed(2)}/mo billed annually)
          </div>
        )}
        <p className={`text-xs mb-6 ${plan.dark ? "text-slate-400" : "text-slate-500"}`}>{plan.tagline}</p>

        <button
          onClick={async () => {
            if (plan.id === "free") { window.location.href = "/"; return; }
            onSetError?.("");
            if (!isAuthenticated) {
              const base = typeof window !== "undefined" ? window.location.origin : "";
              window.location.href = `${base}/login?redirect=${encodeURIComponent(`${base}/Pricing`)}`;
              return;
            }
            if (!acceptedTerms) {
              onSetError?.("Please accept the Terms & Conditions to continue with checkout.");
              return;
            }
            setLoading(true);
            try {
              const base = typeof window !== "undefined" ? window.location.origin : "";
              const { url } = await api.subscription.createCheckoutSession({
                planId: plan.id,
                interval,
                terms_accepted: acceptedTerms,
                terms_version: termsVersion,
                successUrl: `${base}/Profile?upgraded=1`,
                cancelUrl: `${base}/Pricing`,
              });
              if (url) window.location.href = url;
            } catch (err) {
              console.error(err);
              onSetError?.(err?.message || "Could not start checkout. Try again or contact support.");
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading || (!acceptedTerms && plan.id !== "free")}
          className={`w-full py-3 rounded-xl font-bold text-sm transition mb-7 flex items-center justify-center gap-2 ${
            plan.accent
              ? "bg-[#10b981] hover:bg-[#059669] text-white"
              : plan.dark
              ? "bg-[#10b981] hover:bg-[#059669] text-white"
              : "border-2 border-[#10b981] text-[#10b981] hover:bg-[#10b981]/5"
          } disabled:opacity-60`}
        >
          {loading ? <Loader2 size={18} className="animate-spin shrink-0" /> : null}
          {plan.cta}
        </button>

        <ul className="space-y-2.5">
          {plan.features.map(f => (
            <li key={f} className="flex items-start gap-2.5 text-xs">
              <div className="w-4 h-4 rounded-full bg-[#10b981]/20 flex items-center justify-center shrink-0 mt-0.5">
                <Check size={10} className="text-[#10b981]" />
              </div>
              <span className={plan.dark ? "text-slate-300" : "text-slate-600"}>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}