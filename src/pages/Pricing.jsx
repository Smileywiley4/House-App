import { useState, useEffect, useRef } from "react";
import { Check, Zap, Lock, Star, Users, Map, Building2, Loader2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api";
import { useAuth } from "@/lib/AuthContext";
import { usePlan } from "@/core/hooks/usePlan";
import { APP_NAME } from "@/core/constants";
import { SUPPORT_EMAIL } from "@/core/companyConfig";
import FetchErrorState from "@/components/async/FetchErrorState";

const PLAN_RANK = { free: 0, premium: 1, realtor: 2, admin: 3 };

async function startPlanChange({ planId, interval, onSetError, refreshUser }) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const result = await api.subscription.createCheckoutSession({
    planId,
    interval,
    successUrl: `${base}/Profile?upgraded=1&tab=billing`,
    cancelUrl: `${base}/Pricing`,
  });
  if (result?.upgraded || result?.already_on_plan) {
    try {
      await refreshUser?.();
    } catch {
      /* webhook / profile refresh best-effort */
    }
  }
  if (result?.url) {
    window.location.href = result.url;
    return;
  }
  onSetError?.(result?.message || "Checkout is unavailable. Billing may not be configured on the server.");
}

function planCtaLabel(planId, currentPlan) {
  const current = (currentPlan || "free").toLowerCase();
  if (planId === "free") return "Get Started Free";
  if (current === "admin" || current === planId) return "Current plan";
  if (PLAN_RANK[planId] > (PLAN_RANK[current] ?? 0)) {
    return planId === "realtor" ? "Upgrade to Realtor" : "Upgrade to Premium";
  }
  return planId === "premium" ? "Switch to Premium" : "Switch plan";
}

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
      "Save and reuse scoring presets",
      "Save & revisit property scorecards",
      "Mobile-friendly for walk-throughs",
      "Supported by advertising",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    monthly: 3.99,
    annual: 39.99,
    tagline: "For serious buyers who want every advantage.",
    badge: "✦ POPULAR",
    accent: true,
    cta: "Upgrade to Premium",
    features: [
      "Everything in Free",
      "Ad-free web experience",
      "Compare 3+ properties at once",
      "Gamified live walk-through mode",
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
      "Realtor profile (license & brokerage — self-reported until verified)",
      "Client comparison reports",
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
  const { isAuthenticated, refreshUser } = useAuth();
  const { plan: currentPlan } = usePlan();
  const [checkoutError, setCheckoutError] = useState("");
  const [searchParams] = useSearchParams();
  const [highlightPlan, setHighlightPlan] = useState(null);
  const planRefs = useRef({});

  const interval = annual ? "annual" : "monthly";

  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (planParam !== "premium" && planParam !== "realtor") return;
    setHighlightPlan(planParam);
    const el = planRefs.current[planParam];
    if (el) {
      const timer = setTimeout(
        () => el.scrollIntoView({ behavior: "smooth", block: "center" }),
        150
      );
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      {/* Header */}
      <div className="relative overflow-hidden bg-[#14192E] px-6 py-16 text-center">
        <div className="absolute inset-0 bg-[#14192E]/70" />
        <div className="relative max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#106B49]/15 text-[#106B49] text-xs font-bold px-4 py-2 rounded-full mb-6 border border-[#106B49]/20">
            <Zap size={12} /> Simple, transparent pricing
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Score smarter.<br />
            <span className="text-[#106B49]">Compare with confidence.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-8">Start free. Upgrade when you're ready for more.</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-white/10 rounded-xl p-1 gap-1">
            <button onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${!annual ? "bg-white text-[#14192E]" : "text-slate-400 hover:text-white"}`}>
              Monthly
            </button>
            <button onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${annual ? "bg-white text-[#14192E]" : "text-slate-400 hover:text-white"}`}>
              Annual
              <span className="text-[10px] bg-[#106B49] text-white font-bold px-2 py-0.5 rounded-full">Save ~15%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        {checkoutError && (
          <FetchErrorState
            compact
            message={checkoutError}
            onRetry={() => setCheckoutError("")}
            className="max-w-3xl mx-auto mb-8"
          />
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              annual={annual}
              interval={interval}
              isAuthenticated={isAuthenticated}
              currentPlan={currentPlan}
              refreshUser={refreshUser}
              onSetError={setCheckoutError}
              highlighted={highlightPlan === plan.id}
              cardRef={(el) => { planRefs.current[plan.id] = el; }}
            />
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8 max-w-2xl mx-auto leading-relaxed">
          <strong className="text-slate-500 font-semibold">Subscription disclosure:</strong> Paid plans use secure
          Stripe checkout. Prices are as shown (e.g. Premium $3.99/mo or $39.99/yr; Realtor as listed). Subscriptions{" "}
          <strong className="text-slate-500 font-semibold">auto-renew</strong> each billing period until you cancel.
          Cancel anytime via Profile → Billing → Manage subscription / Cancel (Stripe customer portal). Deleting your account cancels web billing
          immediately so you are not charged at the next period. Review our{" "}
          <Link to={createPageUrl("Terms")} className="text-[#106B49] hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link to={createPageUrl("Privacy")} className="text-[#106B49] hover:underline">Privacy Policy</Link>
          {" "}before purchase. At checkout you can also enter a promotion code if you have one.
        </p>

        <PricingAccessCode isAuthenticated={isAuthenticated} refreshUser={refreshUser} />

        {/* Coming Soon */}
        <div className="mt-16">
          <h2 className="text-center text-lg font-bold text-[#14192E] mb-2 flex items-center justify-center gap-2">
            <Star size={18} className="text-[#E8A33D]" /> Premium Features — Coming Soon
          </h2>
          <p className="text-center text-slate-400 text-sm mb-8">Included in Premium & Realtor plans once launched.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {COMING_SOON.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-3 right-3"><Lock size={12} className="text-slate-300" /></div>
                <div className="w-10 h-10 rounded-xl bg-[#E8A33D]/10 flex items-center justify-center mb-4">
                  <Icon size={18} className="text-[#E8A33D]" />
                </div>
                <h3 className="font-bold text-[#14192E] mb-2 text-sm">{title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                <div className="mt-4 text-xs font-semibold text-[#E8A33D] bg-[#E8A33D]/8 border border-[#E8A33D]/15 inline-block px-3 py-1 rounded-full">
                  Coming Soon
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Realtor CTA */}
        <div className="mt-12 bg-[#14192E] rounded-2xl p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#106B49] opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Building2 size={32} className="text-[#106B49] mx-auto mb-4" />
          <div className="text-[#106B49] text-xs font-bold uppercase tracking-widest mb-2">For Real Estate Professionals</div>
          <h3 className="text-2xl font-bold text-white mb-3">Use {APP_NAME} with your clients</h3>
          <p className="text-slate-400 max-w-xl mx-auto text-sm mb-6">
            Access private listing tools, manage client scorecards, and use {APP_NAME} as your professional edge — including with off-market and pre-MLS properties.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={createPageUrl("RealtorPortal")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#106B49] hover:bg-[#0C4F37] text-white font-bold rounded-xl text-sm transition">
              View Realtor Portal
            </Link>
            <button
              onClick={async () => {
                try {
                  setCheckoutError("");
                  if (!isAuthenticated) {
                    const base = typeof window !== "undefined" ? window.location.origin : "";
                    window.location.href = `${base}/login?redirect=${encodeURIComponent(`${base}/Pricing?plan=realtor`)}`;
                    return;
                  }
                  await startPlanChange({
                    planId: "realtor",
                    interval,
                    onSetError: setCheckoutError,
                    refreshUser,
                  });
                } catch (err) {
                  console.error(err);
                  setCheckoutError(err?.message || "Could not start checkout. Try again or contact support.");
                }
              }}
              disabled={(currentPlan || "").toLowerCase() === "realtor" || (currentPlan || "").toLowerCase() === "admin"}
              className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 text-white font-semibold rounded-xl text-sm hover:bg-white/5 transition disabled:opacity-50"
            >
              {(currentPlan || "").toLowerCase() === "realtor" || (currentPlan || "").toLowerCase() === "admin"
                ? "You're on Realtor"
                : `Upgrade to Realtor — $${annual ? "199.99/yr" : "19.99/mo"}`}
            </button>
          </div>
        </div>

        {/* FAQ note */}
        <p className="text-center text-xs text-slate-400 mt-10">
          Subscriptions auto-renew each billing period until canceled. Cancel anytime from Profile → Billing → Manage
          subscription / Cancel (self-serve Stripe portal; no support ticket required).
          Your payment method is charged at each renewal unless you cancel first. Questions?{" "}
          <Link to={createPageUrl("Support")} className="text-[#106B49] hover:underline">Contact support</Link>
          {" "}or email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#106B49] hover:underline">{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}

function PricingAccessCode({ isAuthenticated, refreshUser }) {
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [grantPlan, setGrantPlan] = useState("premium");
  const [applying, setApplying] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeSuccess, setCodeSuccess] = useState("");

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
    <div className="mt-10 max-w-md mx-auto text-center">
      {!showCode ? (
        <button
          type="button"
          onClick={() => setShowCode(true)}
          className="text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
        >
          Have an access code?
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm">
          <p className="text-xs text-slate-500">Enter an access or promo code</p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            autoComplete="off"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold tracking-wide text-[#14192E] focus:outline-none focus:border-[#106B49]"
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
          {codeSuccess && <p className="text-xs text-[#0C4F37] font-semibold">{codeSuccess}</p>}
          <button
            type="button"
            onClick={applyCode}
            disabled={applying}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {applying ? "Applying…" : "Apply code"}
          </button>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  annual,
  interval,
  isAuthenticated,
  currentPlan,
  refreshUser,
  onSetError,
  highlighted,
  cardRef,
}) {
  const [loading, setLoading] = useState(false);
  const price = annual && plan.annual > 0
    ? plan.annual
    : plan.monthly;
  const period = annual && plan.annual > 0 ? "/yr" : "/mo";
  const cta = planCtaLabel(plan.id, currentPlan);
  const isCurrent =
    plan.id !== "free" &&
    ((currentPlan || "").toLowerCase() === plan.id ||
      (currentPlan || "").toLowerCase() === "admin");

  const base = plan.dark
    ? "bg-[#14192E] border-[#106B49]/20 text-white"
    : plan.accent
    ? "bg-white border-[#106B49] shadow-lg"
    : "bg-white border-slate-200";

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl border p-7 shadow-sm relative overflow-hidden flex flex-col transition-shadow ${
        highlighted ? "ring-2 ring-[#106B49] ring-offset-2 shadow-lg" : ""
      } ${base}`}
    >
      {plan.accent && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#106B49] opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
      )}
      <div className="relative flex-1">
        <div className="flex items-center justify-between mb-1">
          <div className={`text-xs font-bold uppercase tracking-widest ${plan.accent ? "text-[#106B49]" : plan.dark ? "text-[#106B49]" : "text-slate-500"}`}>
            {plan.name}
          </div>
          {plan.badge && (
            <span className="text-[10px] font-bold text-[#E8A33D] bg-[#E8A33D]/10 border border-[#E8A33D]/20 px-2 py-0.5 rounded-full">
              {plan.badge}
            </span>
          )}
        </div>

        <div className="flex items-end gap-1 mb-1">
          <span className={`text-4xl font-bold ${plan.dark ? "text-white" : "text-[#14192E]"}`}>
            {plan.monthly === 0 ? "$0" : `$${price}`}
          </span>
          {plan.monthly > 0 && <span className={`mb-1 text-sm ${plan.dark ? "text-slate-400" : "text-slate-400"}`}>{period}</span>}
        </div>
        {annual && plan.annual > 0 && (
          <div className="text-[10px] text-[#106B49] font-semibold mb-1">
            (${(plan.annual / 12).toFixed(2)}/mo billed annually)
          </div>
        )}
        <p className={`text-xs mb-6 ${plan.dark ? "text-slate-400" : "text-slate-500"}`}>{plan.tagline}</p>

        <button
          onClick={async () => {
            if (plan.id === "free") { window.location.href = "/"; return; }
            if (isCurrent) return;
            onSetError?.("");
            if (!isAuthenticated) {
              const origin = typeof window !== "undefined" ? window.location.origin : "";
              window.location.href = `${origin}/login?redirect=${encodeURIComponent(`${origin}/Pricing?plan=${plan.id}`)}`;
              return;
            }
            setLoading(true);
            try {
              await startPlanChange({
                planId: plan.id,
                interval,
                onSetError,
                refreshUser,
              });
            } catch (err) {
              console.error(err);
              onSetError?.(err?.message || "Could not start checkout. Try again or contact support.");
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading || isCurrent}
          className={`w-full py-3 rounded-xl font-bold text-sm transition mb-7 flex items-center justify-center gap-2 ${
            isCurrent
              ? "bg-slate-100 text-slate-500 cursor-default"
              : plan.accent
              ? "bg-[#106B49] hover:bg-[#0C4F37] text-white"
              : plan.dark
              ? "bg-[#106B49] hover:bg-[#0C4F37] text-white"
              : "border-2 border-[#106B49] text-[#106B49] hover:bg-[#106B49]/5"
          } disabled:opacity-60`}
        >
          {loading ? <Loader2 size={18} className="animate-spin shrink-0" /> : null}
          {cta}
        </button>

        <ul className="space-y-2.5">
          {plan.features.map(f => (
            <li key={f} className="flex items-start gap-2.5 text-xs">
              <div className="w-4 h-4 rounded-full bg-[#106B49]/20 flex items-center justify-center shrink-0 mt-0.5">
                <Check size={10} className="text-[#106B49]" />
              </div>
              <span className={plan.dark ? "text-slate-300" : "text-slate-600"}>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
