import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Home, Mail, Lock, Loader2, AlertCircle, Phone } from "lucide-react";
import { getSharedSupabase } from "@/lib/supabase";
import { api } from "@/api";
import { useAuth } from "@/lib/AuthContext";
import { SeoHelmet } from "@/components/SeoHelmet";
import { createPageUrl } from "@/utils";
import CaptchaField, { isCaptchaConfigured } from "@/components/CaptchaField";
import {
  bridgeSignIn,
  bridgeSignupStart,
  bridgeSignupConfirm,
  applyBridgeSession,
} from "@/lib/authBridge";
import {
  saveOAuthPending,
  readOAuthPending,
  clearOAuthPending,
  isOAuthReturnUrl,
  readOAuthErrorFromUrl,
} from "@/lib/oauthPending";

function getSupabase() {
  return getSharedSupabase();
}

/** Map opaque network/auth failures into actionable copy for the login UI. */
function formatAuthError(err, fallback = "Something went wrong") {
  const raw = (err?.message || err?.error_description || err?.code || fallback || "").trim();
  const lower = raw.toLowerCase();
  const code = String(err?.code || err?.error_code || "").toLowerCase();
  if (
    lower === "failed to fetch"
    || lower.includes("networkerror")
    || lower.includes("load failed")
    || lower.includes("network request failed")
  ) {
    return (
      "Can't reach the account service right now. This is usually a temporary outage — " +
      "please try again in a few minutes. If it keeps happening, the auth database may be down."
    );
  }
  if (
    code === "captcha_failed"
    || lower.includes("captcha")
    || lower.includes("turnstile")
  ) {
    return (
      "Human verification failed. Complete the checkbox again, then retry. " +
      "If it keeps failing, the Turnstile secret in Supabase may not match this site’s widget — " +
      "or temporarily disable CAPTCHA under Supabase → Authentication → Attack Protection."
    );
  }
  return raw || fallback;
}

/** Resolve only an in-app path; never redirect an authenticated user off-site. */
function resolveRedirectHref(redirect) {
  const path = resolveRedirectForRouter(redirect) || "/";
  return `${window.location.origin}${path}`;
}

/** Accept relative paths or an absolute URL for this origin only. */
function resolveRedirectForRouter(redirect) {
  const raw = (redirect || "/").trim();
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (u.origin === window.location.origin) {
        return `${u.pathname}${u.search}${u.hash}`;
      }
      return "/";
    } catch {
      return "/";
    }
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

async function acceptInviteToken(token, accessToken) {
  if (!token || import.meta.env.VITE_USE_PYTHON_BACKEND !== "true") return;
  const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (!base || !accessToken) return;
  await fetch(`${base}/api/invitations/accept`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  }).catch(() => {});
}

/** Signup plan ids: Free, Pro (stored as premium), Realtor. */
const SIGNUP_PLANS = [
  { id: "free", label: "Free", blurb: "Compare up to 2 homes · ads supported" },
  { id: "premium", label: "Pro", blurb: "Ad-free · compare 3+ · walk-through tools" },
  { id: "realtor", label: "Realtor", blurb: "Clients, private listings & sharing" },
];

function isPaidSignupPlan(planId) {
  return planId === "premium" || planId === "realtor";
}

function postSignupHref(planId, redirect) {
  // Always land on the app home when signed in so the header profile control confirms auth.
  // Paid plans keep intended_plan in metadata; checkout is available from Pricing.
  void planId;
  const path = resolveRedirectForRouter(redirect) || "/";
  // Prefer home after signup unless an explicit in-app deep link was requested.
  if (!redirect || redirect === "/" || redirect === "") {
    return `${window.location.origin}/`;
  }
  return `${window.location.origin}${path}`;
}

/** Don't let a slow/unreachable Python API block leaving the signup page. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
}

async function completePostAuth(session, inviteTokenFromUrl) {
  const pending = readOAuthPending();
  clearOAuthPending();

  if (import.meta.env.VITE_USE_PYTHON_BACKEND === "true") {
    const updates = {};
    if (pending?.marketing_opt_in) updates.marketing_opt_in = true;
    try {
      if (Object.keys(updates).length > 0) {
        await api.auth.updateMe(updates);
      } else {
        await api.auth.me();
      }
    } catch {
      /* profile sync is best-effort */
    }
  }

  const invite = inviteTokenFromUrl || pending?.inviteToken;
  if (invite && session?.access_token) {
    await acceptInviteToken(invite, session.access_token);
  }

  return pending?.intended_plan || "free";
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const inviteToken = searchParams.get("invite");
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  /** Required on signup: free | premium (Pro) | realtor */
  const [selectedPlan, setSelectedPlan] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [mode, setMode] = useState("signin"); // signin | signup
  /** signup form → email code confirmation */
  const [signupStep, setSignupStep] = useState("form"); // form | code
  const [challengeToken, setChallengeToken] = useState("");
  const [codeExpiresAt, setCodeExpiresAt] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const [codeTick, setCodeTick] = useState(0);
  const errorBannerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleCaptchaToken = useCallback((token) => {
    setCaptchaToken(token || "");
  }, []);

  const refreshCaptcha = useCallback(() => {
    setCaptchaToken("");
    setCaptchaResetKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!error) return;
    errorBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [error]);

  useEffect(() => {
    if (resendCooldownSec <= 0) return undefined;
    const id = window.setInterval(() => {
      setResendCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldownSec]);

  useEffect(() => {
    if (signupStep !== "code" || !codeExpiresAt) return undefined;
    const id = window.setInterval(() => setCodeTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [signupStep, codeExpiresAt]);

  const codeSecondsLeft = codeExpiresAt
    ? Math.max(0, Math.floor((new Date(codeExpiresAt).getTime() - Date.now()) / 1000))
    : 0;
  void codeTick; // keep countdown rendering

  const resetSignupCodeStep = useCallback(() => {
    setSignupStep("form");
    setChallengeToken("");
    setCodeExpiresAt(null);
    setOtpCode("");
    setResendCooldownSec(0);
  }, []);

  const requireCaptchaToken = () => {
    if (!isCaptchaConfigured()) {
      if (import.meta.env.PROD) {
        setError("Bot protection is not configured. Account actions are temporarily unavailable.");
        return null;
      }
      return "";
    }
    if (!captchaToken) {
      setError("Please complete the human verification challenge.");
      return null;
    }
    return captchaToken;
  };

  // Forgot password flow (sends a reset link email; never sends passwords)
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const supabase = getSupabase();
  const isSupabaseAuth = !!supabase;
  const { isAuthenticated, isLoadingAuth } = useAuth();

  /** Already signed in — leave login page (OAuth callback handled separately). */
  useEffect(() => {
    if (isLoadingAuth || oauthLoading) return;
    if (isOAuthReturnUrl()) return;
    if (!isAuthenticated) return;
    const h = typeof window !== "undefined" ? window.location.hash : "";
    if (h && (h.includes("access_token") || h.includes("refresh_token"))) return;
    const routerPath = resolveRedirectForRouter(redirect);
    if (routerPath === null) {
      window.location.replace(resolveRedirectHref(redirect));
      return;
    }
    navigate(routerPath, { replace: true });
  }, [isLoadingAuth, isAuthenticated, oauthLoading, redirect, navigate]);

  useEffect(() => {
    if (!inviteToken || import.meta.env.VITE_USE_PYTHON_BACKEND !== "true") return;
    const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
    if (!base) return;
    fetch(`${base}/api/invitations/validate?token=${encodeURIComponent(inviteToken)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid && d.invitee_email) setEmail(d.invitee_email);
      })
      .catch(() => {});
  }, [inviteToken]);

  useEffect(() => {
    if (!supabase) return undefined;

    const oauthErr = readOAuthErrorFromUrl();
    if (oauthErr) {
      setError(oauthErr);
      return undefined;
    }

    if (!isOAuthReturnUrl()) return undefined;

    let cancelled = false;
    setOauthLoading(true);

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            const msg = (exchangeErr.message || "").toLowerCase();
            const alreadyHandled =
              msg.includes("already") ||
              msg.includes("invalid flow state") ||
              msg.includes("code verifier");
            if (!alreadyHandled) throw exchangeErr;
          }
        }

        let session = null;
        for (let attempt = 0; attempt < 15; attempt += 1) {
          const { data, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) throw sessionErr;
          if (data.session) {
            session = data.session;
            break;
          }
          await new Promise((r) => setTimeout(r, 200));
        }

        if (!session) {
          throw new Error("Google sign-in could not be completed. Try again.");
        }

        if (cancelled) return;

        const intendedPlan = await completePostAuth(session, inviteToken);

        const dest = postSignupHref(intendedPlan, redirect);
        window.history.replaceState({}, document.title, "/login");
        window.location.replace(dest);
      } catch (err) {
        if (!cancelled) {
          setError(formatAuthError(err, "Google sign-in failed"));
          setOauthLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, redirect, inviteToken]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setLoading(true);
    try {
      // Prefer service-role bridge (bypasses broken Turnstile/CAPTCHA pairing).
      try {
        const sessionPayload = await bridgeSignIn({ email, password });
        await applyBridgeSession(supabase, sessionPayload);
      } catch (bridgeErr) {
        const token = requireCaptchaToken();
        if (token === null) {
          setLoading(false);
          return;
        }
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: token ? { captchaToken: token } : undefined,
        });
        if (err) throw bridgeErr?.message ? bridgeErr : err;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await acceptInviteToken(inviteToken, session.access_token);
      }
      window.location.href = resolveRedirectHref(redirect);
    } catch (err) {
      setError(formatAuthError(err, "Sign in failed"));
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!supabase) return;

    setForgotError("");
    setForgotSent(false);

    const targetEmail = (forgotEmail || "").trim();
    if (!targetEmail) {
      setForgotError("Please enter your email address.");
      return;
    }

    let token = "";
    if (isCaptchaConfigured()) {
      if (!captchaToken) {
        setForgotError("Please complete the human verification challenge.");
        return;
      }
      token = captchaToken;
    } else if (import.meta.env.PROD) {
      setForgotError("Bot protection is not configured. Password reset is temporarily unavailable.");
      return;
    }

    setForgotLoading(true);
    try {
      // After reset, Supabase will redirect back to this page.
      const redirectTo = `${window.location.origin}/login?redirect=${encodeURIComponent(redirect)}`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo,
        captchaToken: token || undefined,
      });
      if (err) throw err;
      setForgotSent(true);
      refreshCaptcha();
    } catch (err) {
      // Defensive UX: do not reveal whether an email exists (prevents account enumeration).
      setForgotError("");
      setForgotSent(true);
      refreshCaptcha();
    } finally {
      setForgotLoading(false);
    }
  };

  const finishSignupSession = async (session) => {
    if (!session) return false;
    if (import.meta.env.VITE_USE_PYTHON_BACKEND === "true") {
      await withTimeout(
        api.auth.updateMe({
          full_name: fullName.trim() || undefined,
          phone: phone.trim() || undefined,
          marketing_opt_in: marketingOptIn,
        }).catch(() => {}),
        2500,
      );
    }
    window.location.assign(postSignupHref(selectedPlan, redirect));
    return true;
  };

  const handleSignupStart = async () => {
    const started = await bridgeSignupStart({
      email,
      password,
      full_name: fullName.trim() || undefined,
      phone: phone.trim() || undefined,
      marketing_opt_in: marketingOptIn,
      terms_accepted: true,
      intended_plan: selectedPlan,
      challenge_token: challengeToken || undefined,
    });
    setChallengeToken(started.challenge_token || "");
    setCodeExpiresAt(started.expires_at || null);
    setOtpCode("");
    setSignupStep("code");
    setResendCooldownSec(60);
    setMessage(`We sent a confirmation code to ${email}. It expires in 15 minutes.`);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setMessage("");

    if (!acceptTerms) {
      setError("Please agree to the Terms of Service to create an account.");
      return;
    }
    if (!SIGNUP_PLANS.some((p) => p.id === selectedPlan)) {
      setError("Please choose a plan: Free, Pro, or Realtor.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please enter the same password twice.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await handleSignupStart();
    } catch (err) {
      setError(formatAuthError(err, "Could not send confirmation code"));
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignupCode = async (e) => {
    e?.preventDefault?.();
    if (!supabase) return;
    setError("");
    setMessage("");
    if (!/^\d{6,12}$/.test(otpCode)) {
      setError("Enter the confirmation code from your email.");
      return;
    }
    if (codeSecondsLeft <= 0) {
      setError("This confirmation code has expired. Please request a new one.");
      return;
    }
    setLoading(true);
    try {
      const sessionPayload = await bridgeSignupConfirm({
        email,
        password,
        code: otpCode,
        challenge_token: challengeToken,
      });
      await applyBridgeSession(supabase, sessionPayload);
      const session = (await supabase.auth.getSession()).data.session;
      await finishSignupSession(session);
    } catch (err) {
      setError(formatAuthError(err, "Confirmation failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleResendSignupCode = async () => {
    if (resendCooldownSec > 0 || loading) return;
    setError("");
    setLoading(true);
    try {
      await handleSignupStart();
    } catch (err) {
      setError(formatAuthError(err, "Could not resend confirmation code"));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    if (!supabase) return;
    setError("");
    setMessage("");
    if (mode === "signup" && !acceptTerms) {
      setError("Please agree to the Terms of Service to create an account.");
      return;
    }
    if (mode === "signup" && !SIGNUP_PLANS.some((p) => p.id === selectedPlan)) {
      setError("Please choose a plan: Free, Pro, or Realtor.");
      return;
    }
    if (mode === "signup") {
      const token = requireCaptchaToken();
      if (token === null) return;
    }
    setLoading(true);
    try {
      const oauthRedirect = "/";
      saveOAuthPending({
        marketing_opt_in: mode === "signup" && marketingOptIn,
        inviteToken: inviteToken || null,
        intended_plan: mode === "signup" ? selectedPlan : "free",
      });

      const returnParams = new URLSearchParams({ redirect: oauthRedirect });
      if (inviteToken) returnParams.set("invite", inviteToken);
      const redirectTo = `${window.location.origin}/login?${returnParams.toString()}`;
      const options = {
        redirectTo,
        queryParams: { prompt: "select_account" },
      };

      if (mode === "signup") {
        const meta = {};
        if (fullName.trim()) meta.full_name = fullName.trim();
        if (phone.trim()) meta.phone = phone.trim();
        if (marketingOptIn) meta.marketing_opt_in = true;
        meta.terms_accepted = true;
        meta.intended_plan = selectedPlan;
        if (Object.keys(meta).length > 0) {
          options.data = meta;
        }
      }

      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });
      if (err) throw err;
    } catch (err) {
      clearOAuthPending();
      setError(formatAuthError(err, "Google sign-in failed"));
      setLoading(false);
    }
  };

  if (oauthLoading) {
    return (
      <div className="min-h-screen bg-[#1a2234] flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="text-[#10b981] animate-spin mb-4" />
        <p className="text-white font-semibold">Signing you in...</p>
        <p className="text-slate-400 text-sm mt-1">Completing Google sign-in</p>
      </div>
    );
  }

  if (isSupabaseAuth && isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#1a2234] flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="text-[#10b981] animate-spin mb-4" />
        <p className="text-white font-semibold text-sm">Checking your session…</p>
      </div>
    );
  }

  if (isSupabaseAuth && isAuthenticated && !isOAuthReturnUrl() && !oauthLoading) {
    return (
      <div className="min-h-screen bg-[#1a2234] flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="text-[#10b981] animate-spin mb-4" />
        <p className="text-white font-semibold text-sm">Taking you to the app…</p>
      </div>
    );
  }

  if (isSupabaseAuth && isAuthenticated && isOAuthReturnUrl()) {
    return (
      <div className="min-h-screen bg-[#1a2234] flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="text-[#10b981] animate-spin mb-4" />
        <p className="text-white font-semibold">Signing you in...</p>
        <p className="text-slate-400 text-sm mt-1">Completing Google sign-in</p>
      </div>
    );
  }

  if (!isSupabaseAuth) {
    return (
      <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <p className="text-slate-600 mb-4">Login is not configured for this deployment (missing Supabase env).</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-[#10b981] text-white font-semibold rounded-xl"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SeoHelmet
        title="Sign in"
        description="Sign in to Property Pocket to save property scores, comparisons, and your subscription."
        noindex
      />
    <div className="min-h-screen bg-[#1a2234] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#1a2234]/80" />
      <div className="relative w-full max-w-md">
        <a href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8">
          <Home size={20} />
          <span className="font-semibold">Property Pocket</span>
        </a>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-xl font-bold text-[#1a2234] mb-2">
            {mode === "signup" && signupStep === "code"
              ? "Confirm your email"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </h1>
          <p className="text-slate-500 text-sm mb-2">
            {mode === "signup" && signupStep === "code"
              ? `Enter the confirmation code we sent to ${email}.`
              : mode === "signup"
                ? "Choose Free, Pro, or Realtor to create your account."
                : "Use your account to continue."}
          </p>
          <p className="text-slate-400 text-xs mb-6 leading-relaxed">
            You stay signed in on this browser until you sign out or clear site data for Property Pocket. Allow cookies / local storage for this site so your session persists across tabs and when you close and reopen the window.
          </p>

          {error && (
            <div
              ref={errorBannerRef}
              role="alert"
              className="flex items-start gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl p-3 mb-4"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="text-[#10b981] text-sm bg-[#10b981]/10 rounded-xl p-3 mb-4">
              {message}
            </div>
          )}

          {!forgotMode ? (
            <>
              <div className="flex gap-1 mb-5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                    setMessage("");
                    resetSignupCodeStep();
                    refreshCaptcha();
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${mode === "signin" ? "bg-white text-[#1a2234] shadow-sm" : "text-slate-500"}`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setMessage("");
                    resetSignupCodeStep();
                    refreshCaptcha();
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${mode === "signup" ? "bg-white text-[#1a2234] shadow-sm" : "text-slate-500"}`}
                >
                  Create account
                </button>
              </div>

              {mode === "signup" && signupStep === "code" ? (
                <form onSubmit={handleConfirmSignupCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">
                      Confirmation code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={12}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 12))}
                      placeholder="6-digit code"
                      disabled={loading}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm tracking-[0.35em] text-center font-semibold focus:outline-none focus:border-[#10b981]"
                      required
                    />
                    <p className="text-center text-xs text-slate-500 mt-3">
                      {codeSecondsLeft > 0
                        ? `Code expires in ${Math.floor(codeSecondsLeft / 60)}:${String(codeSecondsLeft % 60).padStart(2, "0")}`
                        : "Code expired — request a new one"}
                    </p>
                  </div>
                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl p-3"
                    >
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading || otpCode.length < 6 || codeSecondsLeft <= 0}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                    Verify and create account
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleResendSignupCode}
                      disabled={loading || resendCooldownSec > 0}
                      className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      {resendCooldownSec > 0 ? `Resend in ${resendCooldownSec}s` : "Resend code"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setMessage("");
                        resetSignupCodeStep();
                      }}
                      disabled={loading}
                      className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      Back
                    </button>
                  </div>
                </form>
              ) : (
              <form onSubmit={mode === "signup" ? handleSignUp : handleSignIn} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">
                      Plan <span className="text-slate-400 font-normal">(required)</span>
                    </label>
                    <div className="grid gap-2" role="radiogroup" aria-label="Choose a plan">
                      {SIGNUP_PLANS.map((plan) => {
                        const selected = selectedPlan === plan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setSelectedPlan(plan.id)}
                            className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                              selected
                                ? "border-[#10b981] bg-[#10b981]/10 ring-1 ring-[#10b981]/40"
                                : "border-slate-200 hover:border-slate-300 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-[#1a2234]">{plan.label}</span>
                              {plan.id === "premium" && (
                                <span className="text-[10px] font-bold uppercase tracking-wide text-[#10b981]">Popular</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{plan.blurb}</p>
                            {isPaidSignupPlan(plan.id) && (
                              <p className="text-[10px] text-slate-400 mt-1">You can upgrade anytime from Pricing after signup.</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Name (optional)</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981]"
                      autoComplete="name"
                    />
                  </div>
                )}
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone (optional)</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 000-0000"
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981]"
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981]"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981]"
                      required
                      minLength={mode === "signup" ? 8 : undefined}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    />
                  </div>
                </div>
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Confirm password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:outline-none ${
                          confirmPassword && confirmPassword !== password
                            ? "border-red-400 focus:border-red-500"
                            : "border-slate-200 focus:border-[#10b981]"
                        }`}
                        required
                        minLength={8}
                        autoComplete="new-password"
                      />
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <p className="mt-1.5 text-xs font-semibold text-red-600">Passwords do not match.</p>
                    )}
                    {confirmPassword && password && confirmPassword === password && (
                      <p className="mt-1.5 text-xs font-semibold text-[#059669]">Passwords match.</p>
                    )}
                  </div>
                )}
                {mode === "signup" && (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      required
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#10b981] focus:ring-[#10b981]"
                    />
                    <span className="text-xs text-slate-600 leading-relaxed">
                      By creating an account, I agree to the{" "}
                      <Link to={createPageUrl("Terms")} className="text-[#10b981] hover:underline" target="_blank" rel="noopener noreferrer">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link to={createPageUrl("Privacy")} className="text-[#10b981] hover:underline" target="_blank" rel="noopener noreferrer">
                        Privacy Policy
                      </Link>
                      . <span className="text-slate-400">(Required)</span>
                    </span>
                  </label>
                )}
                {mode === "signup" && (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(e) => setMarketingOptIn(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#10b981] focus:ring-[#10b981]"
                    />
                    <span className="text-xs text-slate-600 leading-relaxed">
                      Send me product updates, new features, and promotions. See our{" "}
                      <Link to={createPageUrl("Privacy")} className="text-[#10b981] hover:underline">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                )}
                <CaptchaField
                  onToken={handleCaptchaToken}
                  resetKey={captchaResetKey}
                  className="pt-1"
                />
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl p-3"
                  >
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={
                      loading
                      || (mode === "signup" && (!acceptTerms || !selectedPlan || !password || password !== confirmPassword))
                    }
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                    {mode === "signup" ? "Send confirmation code" : "Sign in"}
                  </button>
                </div>
              </form>
              )}

              {!(mode === "signup" && signupStep === "code") && (
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setForgotSent(false);
                    setForgotError("");
                    setForgotLoading(false);
                    setForgotEmail(email);
                    setError("");
                    setMessage("");
                    refreshCaptcha();
                  }}
                  className="text-xs font-semibold text-[#10b981] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              )}
            </>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981]"
                    required
                  />
                </div>
              </div>

              {!forgotSent && (
                <CaptchaField
                  onToken={handleCaptchaToken}
                  resetKey={captchaResetKey}
                />
              )}

              {forgotError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl p-3">
                  <AlertCircle size={16} />
                  {forgotError}
                </div>
              )}

              {forgotSent ? (
                <div className="text-[#10b981] text-sm bg-[#10b981]/10 rounded-xl p-3">
                  If an account exists for that email, we emailed you a password reset link. Check your inbox (and spam folder).
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={forgotLoading || (isCaptchaConfigured() && !captchaToken)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm disabled:opacity-60"
                >
                  {forgotLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                  Send reset link
                </button>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false);
                    refreshCaptcha();
                  }}
                  disabled={forgotLoading}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {!forgotMode && !(mode === "signup" && signupStep === "code") && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={
                loading
                || oauthLoading
                || (mode === "signup" && (!acceptTerms || !selectedPlan))
                || (mode === "signup" && isCaptchaConfigured() && !captchaToken)
              }
              className="w-full flex items-center justify-center gap-3 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              {oauthLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {oauthLoading ? "Signing in..." : mode === "signup" ? "Sign up with Google" : "Continue with Google"}
            </button>
            {mode === "signup" && (!acceptTerms || !selectedPlan) && (
              <p className="mt-2 text-center text-[11px] text-slate-400">
                {!selectedPlan
                  ? "Choose Free, Pro, or Realtor above to continue with Google."
                  : "Agree to the Terms of Service above to continue with Google."}
              </p>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
