import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Home, Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import { getSharedSupabase } from "@/lib/supabase";

function getSupabase() {
  return getSharedSupabase();
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);

  // Forgot password flow (sends a reset link email; never sends passwords)
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const supabase = getSupabase();
  const isSupabaseAuth = !!supabase;

  useEffect(() => {
    if (!supabase) return;
    const hash = window.location.hash;
    if (hash && (hash.includes("access_token") || hash.includes("refresh_token"))) {
      setOauthLoading(true);
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          window.location.href = redirect;
        } else {
          setOauthLoading(false);
        }
      });
    }
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      window.location.href = redirect;
    } catch (err) {
      setError(err.message || "Sign in failed");
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

    setForgotLoading(true);
    try {
      // After reset, Supabase will redirect back to this page.
      const redirectTo = `${window.location.origin}/login?redirect=${encodeURIComponent(redirect)}`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(targetEmail, { redirectTo });
      if (err) throw err;
      setForgotSent(true);
    } catch (err) {
      // Defensive UX: do not reveal whether an email exists (prevents account enumeration).
      setForgotError("");
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) throw err;
      setMessage("Check your email to confirm your account, then sign in.");
    } catch (err) {
      setError(err.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    if (!supabase) return;
    setError("");
    setLoading(true);
    try {
      const redirectTo = window.location.origin + "/login?redirect=" + encodeURIComponent(redirect);
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (err) throw err;
    } catch (err) {
      setError(err.message || "OAuth failed");
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
    <div className="min-h-screen bg-[#1a2234] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0">
        <img src="/banner-login.png" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#1a2234]/80" />
      </div>
      <div className="relative w-full max-w-md">
        <a href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8">
          <Home size={20} />
          <span className="font-semibold">Property Pulse</span>
        </a>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-xl font-bold text-[#1a2234] mb-2">Sign in</h1>
          <p className="text-slate-500 text-sm mb-6">Use your account to continue.</p>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl p-3 mb-4">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {message && (
            <div className="text-[#10b981] text-sm bg-[#10b981]/10 rounded-xl p-3 mb-4">
              {message}
            </div>
          )}

          {!forgotMode ? (
            <>
              <form onSubmit={handleSignIn} className="space-y-4">
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
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={handleSignUp}
                    disabled={loading}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    Sign up
                  </button>
                </div>
              </form>

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
                  }}
                  className="text-xs font-semibold text-[#10b981] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
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
                  disabled={forgotLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm disabled:opacity-60"
                >
                  {forgotLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                  Send reset link
                </button>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForgotMode(false)}
                  disabled={forgotLoading}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={loading || oauthLoading}
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
              {oauthLoading ? "Signing in..." : "Continue with Google"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
