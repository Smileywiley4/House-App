import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  User,
  Save,
  BarChart3,
  Trophy,
  ChevronRight,
  Trash2,
  Check,
  Sparkles,
  Bookmark,
  Plus,
  UserPlus,
  LayoutDashboard,
  Shield,
  CreditCard,
  Activity,
  SlidersHorizontal,
  Cog,
  LogOut,
} from "lucide-react";
import { api } from "@/api";
import { usePlan } from "@/core/hooks/usePlan";
import { useAuth } from "@/lib/AuthContext";
import { getSharedSupabase } from "@/lib/supabase";
import { MANDATORY_CATEGORIES, OPTIONAL_CATEGORIES, NEIGHBORHOOD_CATEGORIES } from "@/components/evaluate/categories";
import RecommendationEngine from "@/components/profile/RecommendationEngine";
import ClientAssignmentsInbox from "@/components/realtor/ClientAssignmentsInbox";
import PresetFiltersForm from "@/components/presets/PresetFiltersForm";
import { PremiumGate } from "@/components/PremiumGate";
import RequireAuth from "@/components/RequireAuth";
import InviteFriendsPanel from "@/components/profile/InviteFriendsPanel";
import AppearanceSettings from "@/components/profile/AppearanceSettings";

const ALL_CATEGORIES = [...MANDATORY_CATEGORIES, ...NEIGHBORHOOD_CATEGORIES, ...OPTIONAL_CATEGORIES];
const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "profile", label: "Profile", icon: User },
  { id: "usage", label: "Usage", icon: Activity },
  { id: "settings", label: "Settings", icon: Cog },
  { id: "security", label: "Security", icon: Shield },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "preferences", label: "Score Preferences", icon: SlidersHorizontal },
  { id: "presets", label: "Presets", icon: Bookmark },
  { id: "foryou", label: "For You", icon: Sparkles },
  { id: "invite", label: "Invite & share", icon: UserPlus },
  { id: "history", label: "Saved Properties", icon: BarChart3 },
];

const VALID_PROFILE_TAB_IDS = new Set(TABS.map((t) => t.id));

export default function Profile() {
  return (
    <RequireAuth message="Sign in to manage your profile, preferences, and saved presets">
      <ProfileInner />
    </RequireAuth>
  );
}

function ProfileInner() {
  const { plan, isPremium } = usePlan();
  const { logout, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("overview");
  const [upgradeBanner, setUpgradeBanner] = useState(false);

  const selectTab = (id) => {
    setTab(id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", id);
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    const q = searchParams.get("tab");
    if (q && VALID_PROFILE_TAB_IDS.has(q)) setTab(q);
  }, [searchParams]);

  /** After Stripe checkout success — refresh plan (webhook may lag a few seconds). */
  useEffect(() => {
    if (searchParams.get("upgraded") !== "1") return;
    setUpgradeBanner(true);
    selectTab("billing");
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      if (cancelled) return;
      await refreshUser();
      attempts += 1;
      if (attempts < 5) setTimeout(poll, 2000);
    };
    poll();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("upgraded");
        next.set("tab", "billing");
        return next;
      },
      { replace: true }
    );
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on return from Stripe
  const [user, setUser] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [scores, setScores] = useState([]);
  const [loadingScores, setLoadingScores] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [realtorLicense, setRealtorLicense] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Weights: 0–10 per category
  const [weights, setWeights] = useState({});
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);

  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");
  const [presetFilters, setPresetFilters] = useState({});
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    api.auth.me().then(u => {
      setUser(u);
      setFullName(u.full_name || "");
      setEmail(u.email || "");
      setRealtorLicense(u.realtor_license || "");
      setBrokerage(u.brokerage || "");
      setStateVal(u.state || "");
      const savedW = u.default_weights || {};
      const initial = {};
      ALL_CATEGORIES.forEach(c => {
        initial[c.id] = savedW[c.id] !== undefined ? savedW[c.id] : 5;
      });
      setWeights(initial);
    });
    api.entities.PropertyScore.list("-created_date").then(data => {
      setScores(data);
      setLoadingScores(false);
    });
    api.entities.Preset.list(null).then(setPresets).catch(() => setPresets([]));
  }, []);

  const saveAccount = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.auth.updateMe({
        full_name: fullName,
        realtor_license: realtorLicense,
        brokerage,
        state: stateVal,
      });
      if (email && user?.email && email !== user.email) {
        await api.auth.updateEmail(email);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      // Let the UI remain usable; show error inline if possible
      console.error(err);
      alert(err?.message || "Could not save account changes.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setPasswordError("");
    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      await api.auth.updatePassword(newPassword);
      setPasswordSaved(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err) {
      console.error(err);
      setPasswordError(err?.message || "Could not update password. Try again.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const savePreferences = async () => {
    setSavingPrefs(true);
    await api.auth.updateMe({ default_weights: weights });
    setSavingPrefs(false);
    setSavedPrefs(true);
    setTimeout(() => setSavedPrefs(false), 2000);
  };

  const deleteScore = async (id) => {
    await api.entities.PropertyScore.delete(id);
    setScores(prev => prev.filter(s => s.id !== id));
  };

  const savePreset = async () => {
    if (!presetName.trim()) return;
    setSavingPreset(true);
    try {
      const created = await api.entities.Preset.create({
        name: presetName.trim(),
        weights: { ...weights },
        filters: presetFilters,
      });
      setPresets(prev => [created, ...prev]);
      setPresetName("");
      setPresetFilters({});
    } finally {
      setSavingPreset(false);
    }
  };

  const loadPreset = (p) => {
    const w = p.weights || {};
    const next = {};
    ALL_CATEGORIES.forEach(c => {
      next[c.id] = w[c.id] !== undefined ? w[c.id] : 5;
    });
    setWeights(next);
    setPresetFilters(p.filters || {});
  };

  const deletePreset = async (id) => {
    await api.entities.Preset.delete(id);
    setPresets(prev => prev.filter(x => x.id !== id));
  };

  const scoreColor = (pct) => pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";
  const sorted = [...scores].sort((a, b) => b.percentage - a.percentage);
  const winner = sorted[0];

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      {/* Header */}
      <div className="relative overflow-hidden bg-[#1a2234] px-6 py-8">
        <div className="absolute inset-0 bg-[#1a2234]/75" />
        <div className="relative max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#10b981]/20 flex items-center justify-center">
              <User size={26} className="text-[#10b981]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{user?.full_name || "My Profile"}</h1>
              <p className="text-slate-400 text-sm">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card/90 dark:bg-background/80 backdrop-blur-md border-b border-border sticky top-[112px] sm:top-14 z-20 overflow-x-auto">
        <div className="max-w-4xl mx-auto px-6 flex gap-1 min-w-max">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => selectTab(id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                tab === id
                  ? "border-[#10b981] text-[#10b981]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ─── OVERVIEW ─── */}
        {tab === "overview" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-bold text-foreground mb-1">Overview</h2>
              <p className="text-slate-400 text-sm">Your account at a glance and shortcuts to every section.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { id: "profile", title: "Profile", desc: "Personal & contact info", icon: User },
                { id: "usage", title: "Usage", desc: "Scores, presets, activity", icon: Activity },
                { id: "settings", title: "Settings", desc: "Appearance & this device", icon: Cog },
                { id: "security", title: "Security", desc: "Password & sign out", icon: Shield },
                { id: "billing", title: "Billing", desc: "Plan & payment methods", icon: CreditCard },
                { id: "preferences", title: "Score preferences", desc: "Category weights", icon: SlidersHorizontal },
                { id: "presets", title: "Presets", desc: "Saved filter sets", icon: Bookmark },
                { id: "history", title: "Saved properties", desc: "Scored listings", icon: BarChart3 },
                { id: "foryou", title: "For You", desc: "Recommendations", icon: Sparkles },
                { id: "invite", title: "Invite & share", desc: "Friends & links", icon: UserPlus },
              ].map(({ id, title, desc, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectTab(id)}
                  className="text-left bg-card rounded-2xl border border-border shadow-sm p-5 hover:border-[#10b981]/50 transition-colors"
                >
                  <Icon size={20} className="text-[#10b981] mb-2" />
                  <p className="font-bold text-foreground text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Shield size={18} className="text-[#10b981]" />
                Staying signed in
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your session is kept in this browser&apos;s storage for the whole visit and across reloads. When you switch back to this tab, we refresh your login automatically. To remain signed in, avoid clearing site data or blocking storage for this site. Use{" "}
                <button type="button" className="text-[#10b981] font-semibold hover:underline" onClick={() => selectTab("security")}>
                  Security
                </button>{" "}
                to sign out on this device only.
              </p>
            </div>
          </div>
        )}

        {/* ─── SETTINGS (appearance + device) ─── */}
        {tab === "settings" && (
          <div className="space-y-8 max-w-2xl">
            <div>
              <h2 className="text-lg font-bold text-foreground mb-1">Settings</h2>
              <p className="text-slate-400 text-sm">Display options and how this browser keeps you signed in.</p>
            </div>
            <AppearanceSettings />
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-2">This browser &amp; device</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                The web app can&apos;t change your phone or computer&apos;s system permissions, but you can help the session last by allowing cookies and site data for this origin in your browser settings (Safari: Settings → Privacy; Chrome: Site settings).
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Private/incognito windows usually discard storage when closed—use a normal window to stay signed in between sessions.
              </p>
            </div>
          </div>
        )}

        {/* ─── PROFILE (personal info only) ─── */}
        {tab === "profile" && (
          <div className="max-w-lg">
            <h2 className="text-lg font-bold text-foreground mb-1">Profile</h2>
            <p className="text-slate-400 text-sm mb-6">Personal information tied to your account.</p>

            <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-[#10b981] text-sm text-foreground transition"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-[#10b981] text-sm text-foreground transition"
                />
                <p className="text-xs text-slate-400 mt-1">Email changes may require confirmation depending on your Supabase settings.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">State</label>
                <input
                  type="text"
                  value={stateVal}
                  onChange={(e) => setStateVal(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-[#10b981] text-sm text-foreground transition"
                  placeholder="e.g. CA"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Realtor License (optional)</label>
                <input
                  type="text"
                  value={realtorLicense}
                  onChange={(e) => setRealtorLicense(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-[#10b981] text-sm text-foreground transition"
                  placeholder="License number"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Brokerage (optional)</label>
                <input
                  type="text"
                  value={brokerage}
                  onChange={(e) => setBrokerage(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-[#10b981] text-sm text-foreground transition"
                  placeholder="Brokerage name"
                />
              </div>

              <div className="pt-1">
                <button
                  onClick={saveAccount}
                  disabled={saving}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
                    saved ? "bg-[#10b981] text-white" : "bg-[#1a2234] hover:bg-[#243050] text-white"
                  } disabled:opacity-60`}
                >
                  {saved ? <><Check size={15} /> Saved!</> : saving ? "Saving..." : <><Save size={15} /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── USAGE ─── */}
        {tab === "usage" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-bold text-foreground mb-1">Usage</h2>
              <p className="text-slate-400 text-sm">How you&apos;re using Property Pocket.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Saved properties", value: scores.length },
                { label: "Presets", value: presets.length },
                { label: "Top score", value: winner ? `${winner.percentage}%` : "—" },
                { label: "Avg score", value: scores.length ? `${Math.round(scores.reduce((a, s) => a + s.percentage, 0) / scores.length)}%` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-card rounded-2xl border border-border shadow-sm p-5 text-center">
                  <div className="text-2xl font-bold text-[#10b981]">{value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => selectTab("history")}
                className="px-4 py-2 rounded-xl bg-[#1a2234] text-white text-sm font-semibold hover:bg-[#243050]"
              >
                View saved properties
              </button>
              <button
                type="button"
                onClick={() => selectTab("presets")}
                className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted/50"
              >
                Manage presets
              </button>
            </div>
          </div>
        )}

        {/* ─── SECURITY ─── */}
        {tab === "security" && (
          <div className="max-w-lg space-y-8">
            <div>
              <h2 className="text-lg font-bold text-foreground mb-1">Security</h2>
              <p className="text-slate-400 text-sm">Password and session for this browser.</p>
            </div>
            <SessionOnDeviceCard />
            <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
              <p className="text-sm font-semibold text-foreground">Change password</p>
              <div className="space-y-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-[#10b981] text-sm text-foreground transition"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-[#10b981] text-sm text-foreground transition"
                />
                {passwordError && <p className="text-xs text-red-600 font-semibold">{passwordError}</p>}
                <button
                  type="button"
                  onClick={changePassword}
                  disabled={passwordSaving}
                  className={`w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
                    passwordSaved ? "bg-[#10b981] text-white" : "bg-[#1a2234] hover:bg-[#243050] text-white"
                  } disabled:opacity-60`}
                >
                  {passwordSaving ? "Updating..." : passwordSaved ? "Password updated" : "Update password"}
                </button>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-destructive/30 p-6">
              <p className="text-sm font-semibold text-foreground mb-2">Sign out on this device</p>
              <p className="text-xs text-muted-foreground mb-4">
                Ends your session in this browser only. Other devices stay signed in until you sign out there too.
              </p>
              <button
                type="button"
                onClick={() => logout(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* ─── BILLING ─── */}
        {tab === "billing" && (
          <div className="max-w-lg space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground mb-1">Billing &amp; payment</h2>
              <p className="text-slate-400 text-sm">Your plan and Stripe customer portal.</p>
            </div>
            {upgradeBanner && (
              <div className="bg-[#10b981]/10 border border-[#10b981]/25 text-[#059669] text-sm rounded-xl px-4 py-3">
                {isPremium
                  ? "Thank you! Your subscription is active."
                  : "Payment received — your plan should update in a few seconds. Refresh if it still shows Free."}
              </div>
            )}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Current plan</label>
                <p className="text-lg capitalize text-foreground">{plan || "Free"}</p>
              </div>
              {isPremium ? (
                <>
                  {(plan || "").toLowerCase() === "premium" && (
                    <Link
                      to={`${createPageUrl("Pricing")}?plan=realtor`}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#1a2234] hover:bg-[#243049] text-white"
                    >
                      Upgrade to Realtor
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      setPortalLoading(true);
                      try {
                        const { url } = await api.subscription.getPortalUrl();
                        if (url) window.location.href = url;
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setPortalLoading(false);
                      }
                    }}
                    disabled={portalLoading}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#10b981] hover:bg-[#059669] text-white disabled:opacity-60"
                  >
                    {portalLoading ? "Opening…" : "Open billing portal"}
                  </button>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {(plan || "").toLowerCase() === "premium"
                      ? "Your Premium plan auto-renews until canceled. Upgrade to Realtor anytime from Pricing — we’ll prorate the difference. Use the billing portal to update payment methods, view invoices, or cancel."
                      : "Your plan auto-renews until canceled. In the Stripe portal you can update payment methods, view invoices, and cancel. If you cancel, charges stop after the current billing period ends."}
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You&apos;re on the free plan. Upgrade anytime for premium features ($3.99/mo or $39.99/yr; auto-renews until canceled).
                    See{' '}
                    <Link to={createPageUrl("Terms")} className="text-[#10b981] hover:underline">Terms</Link>
                    {' '}and{' '}
                    <Link to={createPageUrl("Privacy")} className="text-[#10b981] hover:underline">Privacy</Link>.
                  </p>
                  <Link
                    to={createPageUrl("Pricing")}
                    className="inline-flex items-center justify-center w-full px-5 py-3 rounded-xl font-bold text-sm bg-[#10b981] hover:bg-[#059669] text-white"
                  >
                    View plans &amp; upgrade
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── PREFERENCES TAB ─── */}
        {tab === "preferences" && (
          <div>
            <div className="flex items-start justify-between mb-6 gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground mb-1">Scoring Weights</h2>
                <p className="text-slate-400 text-sm">Set how much each category matters to you (0 = don't care, 10 = critical). These auto-fill when you score a property.</p>
              </div>
              <button
                onClick={savePreferences}
                disabled={savingPrefs}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition shrink-0 ${
                  savedPrefs ? "bg-[#10b981] text-white" : "bg-[#1a2234] hover:bg-[#243050] text-white"
                } disabled:opacity-60`}
              >
                {savedPrefs ? <><Check size={15} /> Saved!</> : savingPrefs ? "Saving..." : <><Save size={15} /> Save</>}
              </button>
            </div>

            <div className="space-y-6">
              <CategoryWeightGroup
                title="Mandatory"
                categories={MANDATORY_CATEGORIES}
                weights={weights}
                onChange={(id, v) => setWeights(w => ({ ...w, [id]: v }))}
                accent="#c9a84c"
              />
              <CategoryWeightGroup
                title="Neighborhood"
                categories={NEIGHBORHOOD_CATEGORIES}
                weights={weights}
                onChange={(id, v) => setWeights(w => ({ ...w, [id]: v }))}
                accent="#10b981"
              />
              <CategoryWeightGroup
                title="Property Features"
                categories={OPTIONAL_CATEGORIES}
                weights={weights}
                onChange={(id, v) => setWeights(w => ({ ...w, [id]: v }))}
                accent="#64748b"
              />
            </div>
          </div>
        )}

        {/* ─── PRESETS TAB ─── */}
        {tab === "presets" && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground mb-1">Saved Presets</h2>
              <p className="text-slate-400 text-sm">
                Save your scoring weights and search filters as presets to keep your multi-property search consistent.
              </p>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm p-6 mb-6">
              <h3 className="font-semibold text-foreground mb-4">Save current preferences as preset</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Preset name</label>
                  <input
                    type="text"
                    value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    placeholder="e.g. First Home Search"
                    className="w-full max-w-md px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">Search filters (optional)</label>
                  <PresetFiltersForm filters={presetFilters} onChange={setPresetFilters} compact />
                </div>
                <button
                  onClick={savePreset}
                  disabled={savingPreset || !presetName.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl text-sm disabled:opacity-60"
                >
                  <Plus size={15} /> Save preset
                </button>
              </div>
            </div>

            {presets.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Bookmark size={40} className="mx-auto mb-3 text-slate-200" />
                <p className="font-semibold text-foreground mb-1">No presets yet</p>
                <p className="text-sm">Save your preferences above to use them across properties and search.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {presets.map(p => (
                  <div key={p.id} className="bg-card rounded-2xl border border-border shadow-sm p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-foreground">{p.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {Object.keys(p.weights || {}).length} categories · {(p.filters && Object.keys(p.filters).length) ? "Filters set" : "No filters"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={createPageUrl("SearchByPreset")}
                        className="px-3 py-2 text-sm font-semibold text-[#10b981] hover:bg-[#10b981]/10 rounded-xl"
                      >
                        Search
                      </Link>
                      <button
                        onClick={() => loadPreset(p)}
                        className="px-3 py-2 text-sm font-semibold text-foreground hover:bg-slate-100 rounded-xl"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deletePreset(p.id)}
                        className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-red-500 text-slate-300 flex items-center justify-center"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── FOR YOU TAB ─── */}
        {tab === "foryou" && (
          <PremiumGate featureName="For You recommendations">
            <div className="space-y-8">
              <ClientAssignmentsInbox />
              <RecommendationEngine scores={scores} weights={weights} />
            </div>
          </PremiumGate>
        )}

        {/* ─── INVITE & SHARE TAB ─── */}
        {tab === "invite" && <InviteFriendsPanel />}

        {/* ─── HISTORY TAB ─── */}
        {tab === "history" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-foreground mb-1">Saved Properties</h2>
                <p className="text-slate-400 text-sm">{scores.length} propert{scores.length !== 1 ? "ies" : "y"} scored</p>
              </div>
              <Link
                to={createPageUrl("SavedProperties")}
                className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm transition"
              >
                Full Comparison <ChevronRight size={15} />
              </Link>
            </div>

            {loadingScores ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : scores.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <BarChart3 size={40} className="mx-auto mb-3 text-slate-200" />
                <p className="font-semibold text-foreground mb-1">No saved properties yet</p>
                <p className="text-sm">Score a property to see it here.</p>
                <Link to={createPageUrl("Home")} className="inline-flex mt-5 px-5 py-2.5 bg-[#1a2234] text-white font-bold rounded-xl text-sm">
                  Search Properties
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {sorted.map((s, i) => {
                  const isWinner = s.id === winner?.id;
                  const color = scoreColor(s.percentage);
                  return (
                    <div key={s.id} className={`bg-card rounded-2xl border shadow-sm p-5 flex items-center gap-5 ${isWinner ? "border-[#10b981]" : "border-border"}`}>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${isWinner ? "bg-[#10b981] text-white" : "bg-slate-100 text-slate-500"}`}>
                        {isWinner ? <Trophy size={18} /> : `#${i + 1}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-foreground text-sm truncate">{s.property_address}</p>
                          {isWinner && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>Top Pick ✦</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{s.scores?.length} categories · Scored out of 100</p>
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden w-full max-w-xs">
                          <div className="h-full rounded-full" style={{ width: `${s.percentage}%`, backgroundColor: color }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold" style={{ color }}>{s.percentage}</div>
                        <div className="text-xs text-slate-400">/ 100</div>
                      </div>
                      <button
                        onClick={() => deleteScore(s.id)}
                        className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-red-500 text-slate-300 flex items-center justify-center transition-colors shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionOnDeviceCard() {
  const [info, setInfo] = useState({ loading: true, email: null, expiresAt: null });
  useEffect(() => {
    const c = getSharedSupabase();
    if (!c) {
      setInfo({ loading: false, email: null, expiresAt: null });
      return;
    }
    c.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setInfo({ loading: false, email: null, expiresAt: null });
        return;
      }
      const exp = session.expires_at ? new Date(session.expires_at * 1000) : null;
      setInfo({
        loading: false,
        email: session.user?.email ?? null,
        expiresAt: exp,
      });
    });
  }, []);
  if (info.loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 text-sm text-muted-foreground">
        Loading session…
      </div>
    );
  }
  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-2">
      <h3 className="font-semibold text-foreground text-sm">Signed in on this browser</h3>
      {info.email && <p className="text-sm text-muted-foreground">Account: {info.email}</p>}
      {info.expiresAt && (
        <p className="text-xs text-muted-foreground">
          Tokens refresh automatically while you use the app; current access segment expires around{" "}
          {info.expiresAt.toLocaleString()}.
        </p>
      )}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Your login is kept in this browser&apos;s storage for the session. Don&apos;t clear site data for this site if you want to stay signed in.
      </p>
    </div>
  );
}

function CategoryWeightGroup({ title, categories, weights, onChange, accent }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: accent }}>{title}</p>
      <div className="grid md:grid-cols-2 gap-3">
        {categories.map(cat => (
          <WeightRow
            key={cat.id}
            cat={cat}
            value={weights[cat.id] ?? 5}
            onChange={v => onChange(cat.id, v)}
            accent={accent}
          />
        ))}
      </div>
    </div>
  );
}

function WeightRow({ cat, value, onChange, accent }) {
  const w = value ?? 5;
  const pct = w * 10;
  const label = w === 0 ? "Ignore" : w <= 3 ? "Low" : w <= 6 ? "Medium" : w <= 8 ? "High" : "Critical";
  const { resolvedTheme } = useTheme();
  const trackEnd = resolvedTheme === "dark" ? "#475569" : "#e2e8f0";

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-foreground">{cat.label}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: accent + "18", color: accent }}>
          {w}/10 · {label}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        value={w}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, ${accent} ${pct}%, ${trackEnd} ${pct}%)` }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>0 — Don't care</span>
        <span>10 — Critical</span>
      </div>
    </div>
  );
}