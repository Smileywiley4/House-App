import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Users, Home as HomeIcon, Plus, Lock, ChevronRight,
  Phone, Mail, DollarSign, FileText, Trash2, Building2, BadgeCheck, X, Bookmark, Search, Share2, BarChart3
} from "lucide-react";
import { api } from "@/api";
import AIPropertyInsights from "@/components/ai/AIPropertyInsights";
import AIListingDescription from "@/components/ai/AIListingDescription";
import RequireAuth from "@/components/RequireAuth";
import PresetFiltersForm from "@/components/presets/PresetFiltersForm";
import ClientComparisonReport from "@/components/realtor/ClientComparisonReport";
import LicenseVerifiedEmblem, { LicenseStatusBanner } from "@/components/trust/LicenseVerifiedEmblem";
import { US_STATE_OPTIONS, licenseLookupUrl, licenseVerificationStatus } from "@/lib/licenseVerification";
import {
  formatShareWhen,
  shareDisplayStatus,
  shareStatusBadgeClass,
} from "@/lib/shareStatus";
import LoadingWithTimeout from "@/components/async/LoadingWithTimeout";
import FetchErrorState from "@/components/async/FetchErrorState";
import EmptyState from "@/components/EmptyState";

const TABS = ["Profile", "Clients", "Private Listings", "Shared visits"];

export default function RealtorPortal() {
  return (
    <RequireAuth message="Sign in with a Realtor subscription to access the portal">
      <RealtorPortalInner />
    </RequireAuth>
  );
}

function RealtorPortalInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("Profile");
  const [clients, setClients] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [profile, setProfile] = useState({ license_number: "", license_state: "", brokerage_name: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [showClientForm, setShowClientForm] = useState(false);
  const [showListingForm, setShowListingForm] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [sentShares, setSentShares] = useState([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const reportClientId = searchParams.get("report") === "1" ? (searchParams.get("client") || "").trim() : "";

  const loadPortal = () => {
    setLoading(true);
    setLoadError(null);
    api.auth.me().then(u => {
      setUser(u);
      setProfile({
        license_number: u.license_number || u.realtor_license || "",
        license_state: u.license_state || "",
        brokerage_name: u.brokerage_name || u.brokerage || "",
      });
      setLoading(false);
    }).catch((e) => {
      setLoadError(e?.message || "Could not load portal");
      setLoading(false);
    });
    api.entities.Client.list("-created_date").then(setClients).catch(() => setClients([]));
    api.entities.PrivateListing.list("-created_date").then(setListings).catch(() => setListings([]));
  };

  useEffect(() => {
    loadPortal();
  }, []);

  const isRealtor = user?.role === "realtor" || user?.role === "admin" || user?.plan === "realtor" || user?.plan === "admin";
  const isPremiumOrRealtor = user?.plan === "premium" || isRealtor;

  useEffect(() => {
    if (reportClientId && isRealtor) setTab("Clients");
  }, [reportClientId, isRealtor]);

  useEffect(() => {
    if (!isRealtor) return;
    api.contacts
      .list()
      .then((rows) => {
        const accepted = (Array.isArray(rows) ? rows : []).filter((c) => c.status === "accepted");
        setContacts(accepted);
      })
      .catch(() => setContacts([]));
  }, [isRealtor]);

  useEffect(() => {
    if (!isRealtor) return;
    setSharesLoading(true);
    api.shares
      .sent()
      .then((rows) => setSentShares(Array.isArray(rows) ? rows : []))
      .catch(() => setSentShares([]))
      .finally(() => setSharesLoading(false));
  }, [isRealtor, tab]);

  useEffect(() => {
    if (tab !== "Shared visits" || !isRealtor) return;
    setInboxLoading(true);
    api.library
      .realtorInbox()
      .then((rows) => setInbox(Array.isArray(rows) ? rows : []))
      .catch(() => setInbox([]))
      .finally(() => setInboxLoading(false));
  }, [tab, isRealtor]);

  const sharesByClientEmail = useMemo(() => {
    const map = {};
    for (const s of sentShares) {
      const email = (s.to_user?.email || "").trim().toLowerCase();
      if (!email) continue;
      if (!map[email]) map[email] = [];
      map[email].push(s);
    }
    return map;
  }, [sentShares]);

  const sharesByContactUserId = useMemo(() => {
    const map = {};
    for (const s of sentShares) {
      const uid = s.to_user_id || s.to_user?.id;
      if (!uid) continue;
      if (!map[uid]) map[uid] = [];
      map[uid].push(s);
    }
    return map;
  }, [sentShares]);

  const reportableContacts = useMemo(() => {
    const sorted = [...contacts];
    sorted.sort((a, b) => {
      const roleRank = (c) => (c.contact_role === "client" ? 0 : 1);
      const name = (c) => (c.contact?.full_name || c.contact?.email || "").toLowerCase();
      return roleRank(a) - roleRank(b) || name(a).localeCompare(name(b));
    });
    return sorted;
  }, [contacts]);

  const openClientReport = (contactUserId) => {
    if (!contactUserId) return;
    setTab("Clients");
    setSearchParams({ client: contactUserId, report: "1" });
  };

  const closeClientReport = () => {
    setSearchParams({});
  };

  const saveProfile = async () => {
    setSaving(true); setVerifyMsg("");
    try {
      const updated = await api.auth.updateMe({
        license_number: profile.license_number, license_state: profile.license_state,
        brokerage_name: profile.brokerage_name, realtor_license: profile.license_number, brokerage: profile.brokerage_name,
      });
      setUser(updated); setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { setVerifyMsg(e?.message || "Could not save profile"); }
    finally { setSaving(false); }
  };

  const requestVerification = async () => {
    setVerifying(true); setVerifyMsg("");
    try {
      const updated = await (api.auth.requestLicenseVerification
        ? api.auth.requestLicenseVerification(profile)
        : api.licenseVerification?.request?.(profile));
      if (updated) setUser(updated);
      setVerifyMsg("Verification requested — status is pending until we confirm against the state board.");
    } catch (e) { setVerifyMsg(e?.message || "Could not request verification"); }
    finally { setVerifying(false); }
  };

  if (loading || loadError) {
    return loading ? (
      <LoadingWithTimeout
        isLoading
        onRetry={loadPortal}
        fullPage
        label="Loading portal…"
        size={32}
      />
    ) : (
      <FetchErrorState
        fullPage
        title="Couldn’t load portal"
        message={loadError}
        onRetry={loadPortal}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      {/* Header */}
      <div className="relative overflow-hidden bg-[#1a2234] px-6 py-8">
        <div className="absolute inset-0 bg-[#1a2234]/75" />
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#10b981]/20 flex items-center justify-center">
              <Building2 size={20} className="text-[#10b981]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">Realtor Portal</h1>
                <LicenseVerifiedEmblem profile={user} size={20} />
              </div>
              <p className="text-slate-400 text-sm flex items-center gap-1.5">
                {user?.full_name || "Your portal"}
                <LicenseVerifiedEmblem profile={user} size={14} showSelfReported />
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100 sticky top-[112px] sm:top-14 z-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-4 text-sm font-semibold border-b-2 transition-all ${
                  tab === t
                    ? "border-[#10b981] text-[#10b981]"
                    : "border-transparent text-slate-500 hover:text-[#1a2234]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── PROFILE TAB ── */}
        {tab === "Profile" && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl border border-slate-100 p-7 shadow-sm">
              <h2 className="font-bold text-[#1a2234] text-lg mb-1">Professional Information</h2>
              <p className="text-slate-400 text-sm mb-4">
                License and brokerage are <span className="font-semibold text-slate-600">self-reported</span> until verified.
                Portal access comes from your Realtor plan — not from typing a license number.
              </p>
              <LicenseStatusBanner profile={user} className="mb-5" />
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">Brokerage Name</label>
                  <input value={profile.brokerage_name} onChange={e => setProfile(p => ({ ...p, brokerage_name: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 transition"
                    placeholder="e.g. Keller Williams, Compass..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">License number</label>
                  <input value={profile.license_number} onChange={e => setProfile(p => ({ ...p, license_number: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 transition"
                    placeholder="License number" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">License state</label>
                  <select value={profile.license_state} onChange={e => setProfile(p => ({ ...p, license_state: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 transition bg-white">
                    <option value="">Select state…</option>
                    {US_STATE_OPTIONS.map((code) => (<option key={code} value={code}>{code}</option>))}
                  </select>
                  {licenseLookupUrl(profile.license_state) && (
                    <a href={licenseLookupUrl(profile.license_state)} target="_blank" rel="noopener noreferrer"
                      className="inline-block mt-1.5 text-xs font-semibold text-[#10b981] hover:underline">Look up your license on the official state site →</a>
                  )}
                </div>
                <button type="button" onClick={saveProfile} disabled={saving}
                  className="w-full py-3 bg-[#1a2234] hover:bg-[#243050] text-white font-bold rounded-xl text-sm transition disabled:opacity-60 mt-2">
                  {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Profile"}
                </button>
                <button type="button" onClick={requestVerification}
                  disabled={verifying || licenseVerificationStatus(user) === "verified"}
                  className="w-full py-3 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                  {licenseVerificationStatus(user) === "verified" ? "License verified" : verifying ? "Submitting…" : "Request verification"}
                </button>
                {verifyMsg && <p className="text-xs text-slate-500 leading-relaxed">{verifyMsg}</p>}
              </div>
            </div>

            {/* Account status */}
            <div className="space-y-4">
              <div className={`rounded-2xl p-6 border ${isRealtor ? "bg-[#10b981]/5 border-[#10b981]/20" : "bg-white border-slate-100"} shadow-sm`}>
                <div className="flex items-center gap-3 mb-3">
                  <BadgeCheck size={22} className={isRealtor ? "text-[#10b981]" : "text-slate-300"} />
                  <div>
                    <div className="font-bold text-[#1a2234] text-sm">Realtor Access</div>
                    <div className={`text-xs font-semibold ${isRealtor ? "text-[#10b981]" : "text-slate-400"}`}>
                      {isRealtor ? "Active" : "Not activated"}
                    </div>
                  </div>
                </div>
                {!isRealtor && (
                  <div>
                    <p className="text-slate-500 text-xs mb-4">Upgrade to Realtor to unlock private listings, client tools, and comparison sharing.</p>
                    <Link to={createPageUrl("Pricing")}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2234] text-white font-semibold rounded-xl text-xs hover:bg-[#243050] transition">
                      View Realtor Plans <ChevronRight size={14} />
                    </Link>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <h3 className="font-bold text-[#1a2234] text-sm mb-4">Realtor Tools</h3>
                <ul className="space-y-3">
                  {[
                    { label: "Private listing database", active: isRealtor },
                    { label: "Client management", active: isRealtor },
                    { label: "Share scorecards with clients", active: isRealtor },
                    { label: "Off-market property scoring", active: isRealtor },
                    { label: "Client comparison reports", active: isRealtor },
                    { label: "MLS integration (coming soon)", active: false, soon: true },
                  ].map(({ label, active, soon }) => (
                    <li key={label} className="flex items-center gap-3 text-sm">
                      {active ? (
                        <div className="w-4 h-4 rounded-full bg-[#10b981] flex items-center justify-center shrink-0">
                          <span className="text-white text-[9px] font-bold">✓</span>
                        </div>
                      ) : (
                        <Lock size={14} className="text-slate-300 shrink-0" />
                      )}
                      <span className={active ? "text-[#1a2234]" : "text-slate-400"}>{label}</span>
                      {soon && <span className="text-[10px] text-[#c9a84c] font-semibold bg-[#c9a84c]/10 px-2 py-0.5 rounded-full">Soon</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── CLIENTS TAB ── */}
        {tab === "Clients" && (
          <div>
            {!isRealtor ? (
              <UpgradeGate plan="realtor" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-bold text-[#1a2234] text-lg">Your Clients</h2>
                    <p className="text-slate-400 text-sm">{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button onClick={() => setShowClientForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#047857] hover:bg-[#065f46] text-white font-semibold rounded-xl text-sm transition">
                    <Plus size={15} /> Add Client
                  </button>
                </div>

                <div className="mb-8 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-[#10b981]/10 flex items-center justify-center shrink-0">
                      <BarChart3 size={16} className="text-[#10b981]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1a2234] text-sm">Client comparison reports</h3>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Select an in-app contact to see every property they scored for you — sorted by score.
                      </p>
                    </div>
                  </div>
                  {reportableContacts.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No accepted contacts yet.{" "}
                      <Link to={createPageUrl("Contacts")} className="text-[#10b981] font-semibold hover:underline">
                        Add contacts
                      </Link>{" "}
                      and share homes for scoring to unlock reports.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-50">
                      {reportableContacts.map((c) => {
                        const uid = c.contact_user_id || c.contact?.id;
                        const label =
                          c.label ||
                          c.contact?.full_name ||
                          c.contact?.email ||
                          c.contact?.username ||
                          "Contact";
                        const scoredCount = (sharesByContactUserId[uid] || []).filter(
                          (s) => s.status === "returned" || s.status === "scored",
                        ).length;
                        return (
                          <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#1a2234] truncate">{label}</div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {[c.contact_role, c.contact?.email, scoredCount ? `${scoredCount} scored` : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openClientReport(uid)}
                              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#10b981]/10 text-[#059669] hover:bg-[#10b981]/20 transition"
                            >
                              <BarChart3 size={12} /> Report
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {clients.length === 0 ? (
                  <EmptyState icon={Users} title="No clients yet" description="Add your first client to start managing their home search." actionLabel="Add client" onAction={() => setShowClientForm(true)} />
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {clients.map(c => (
                      <ClientCard
                        key={c.id}
                        client={c}
                        shares={sharesByClientEmail[(c.email || "").trim().toLowerCase()] || []}
                        contacts={reportableContacts}
                        onOpenReport={openClientReport}
                        onDelete={id => {
                          api.entities.Client.delete(id);
                          setClients(prev => prev.filter(x => x.id !== id));
                        }}
                        onPresetAdded={() => {}}
                      />
                    ))}
                  </div>
                )}

                {showClientForm && (
                  <ClientForm onSave={async data => {
                    const created = await api.entities.Client.create(data);
                    setClients(prev => [created, ...prev]);
                    setShowClientForm(false);
                  }} onClose={() => setShowClientForm(false)} />
                )}

                {reportClientId && (
                  <ClientComparisonReport
                    contactUserId={reportClientId}
                    onClose={closeClientReport}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* ── PRIVATE LISTINGS TAB ── */}
        {tab === "Private Listings" && (
          <div>
            {!isRealtor ? (
              <UpgradeGate plan="realtor" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-bold text-[#1a2234] text-lg">Private Listings</h2>
                    <p className="text-slate-400 text-sm">Off-market & private properties for your clients</p>
                  </div>
                  <button onClick={() => setShowListingForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#047857] hover:bg-[#065f46] text-white font-semibold rounded-xl text-sm transition">
                    <Plus size={15} /> Add Listing
                  </button>
                </div>

                {listings.length === 0 ? (
                  <EmptyState icon={HomeIcon} title="No private listings yet" description="Add off-market or private properties to score and share with clients." />
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {listings.map(l => <ListingCard key={l.id} listing={l} clients={clients} onDelete={id => {
                      api.entities.PrivateListing.delete(id);
                      setListings(prev => prev.filter(x => x.id !== id));
                    }} />)}
                  </div>
                )}

                {showListingForm && (
                  <ListingForm clients={clients} onSave={async data => {
                    const created = await api.entities.PrivateListing.create(data);
                    setListings(prev => [created, ...prev]);
                    setShowListingForm(false);
                  }} onClose={() => setShowListingForm(false)} />
                )}
              </>
            )}
          </div>
        )}

        {/* ── SHARED VISITS (property shares + visit library inbox) ── */}
        {tab === "Shared visits" && (
          <div>
            {!isRealtor ? (
              <UpgradeGate plan="realtor" />
            ) : (
              <div className="space-y-10">
                <section>
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                      <Share2 className="text-[#10b981]" size={22} />
                      <div>
                        <h2 className="font-bold text-[#1a2234] text-lg">Homes sent for scoring</h2>
                        <p className="text-slate-400 text-sm">
                          Status: Sent → Viewed → Scored. Same list as Shared homes → Sent.
                        </p>
                      </div>
                    </div>
                    <Link
                      to={createPageUrl("SharedHomes") + "?tab=sent"}
                      className="text-xs font-semibold text-[#10b981] hover:underline shrink-0"
                    >
                      Open Shared homes →
                    </Link>
                  </div>
                  {sharesLoading ? (
                    <LoadingWithTimeout
                      isLoading
                      onRetry={() => {
                        setSharesLoading(true);
                        api.shares
                          .sent()
                          .then((rows) => setSentShares(Array.isArray(rows) ? rows : []))
                          .catch(() => setSentShares([]))
                          .finally(() => setSharesLoading(false));
                      }}
                      label="Loading shares…"
                    />
                  ) : sentShares.length === 0 ? (
                    <EmptyState
                      icon={Share2}
                      title="No outbound shares yet"
                      description="From Evaluate, use “Send to client for scoring” to track Sent → Viewed → Scored here."
                      actionLabel="Score an address"
                      actionTo={createPageUrl("Home")}
                    />
                  ) : (
                    <div className="space-y-3">
                      {sentShares.map((item) => {
                        const prop = item.property_payload || {};
                        const address =
                          prop.address || prop.formattedAddress || prop.property_address || "Property";
                        const label = shareDisplayStatus(item);
                        const peer = item.to_user?.full_name || item.to_user?.email || "Client";
                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-wrap items-start justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-[#1a2234] text-sm truncate">{address}</div>
                              <p className="text-xs text-slate-500 mt-1">
                                To {peer}
                                {item.created_at ? ` · Sent ${formatShareWhen(item.created_at)}` : ""}
                              </p>
                              {(item.viewed_at || item.scored_at) && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                  {item.viewed_at ? `Viewed ${formatShareWhen(item.viewed_at)}` : ""}
                                  {item.viewed_at && item.scored_at ? " · " : ""}
                                  {item.scored_at ? `Scored ${formatShareWhen(item.scored_at)}` : ""}
                                </p>
                              )}
                            </div>
                            <span
                              className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${shareStatusBadgeClass(label)}`}
                            >
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <Share2 className="text-[#10b981]" size={22} />
                    <div>
                      <h2 className="font-bold text-[#1a2234] text-lg">Client visit shares</h2>
                      <p className="text-slate-400 text-sm">
                        Premium clients can share in-person photos and scores from Property Visits.
                      </p>
                    </div>
                  </div>
                  {inboxLoading ? (
                    <LoadingWithTimeout
                      isLoading
                      onRetry={() => {
                        setInboxLoading(true);
                        api.library
                          .realtorInbox()
                          .then((rows) => setInbox(Array.isArray(rows) ? rows : []))
                          .catch(() => setInbox([]))
                          .finally(() => setInboxLoading(false));
                      }}
                      label="Loading visit shares…"
                    />
                  ) : inbox.length === 0 ? (
                    <EmptyState
                      icon={Share2}
                      title="No shared visits yet"
                      description="When a client shares a property from Visits, it will appear here with their score and photos."
                    />
                  ) : (
                    <div className="space-y-6">
                      {inbox.map((item) => (
                        <div
                          key={item.share_id}
                          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
                        >
                          <div className="flex flex-wrap justify-between gap-2 mb-3">
                            <div>
                              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">From</div>
                              <div className="font-bold text-[#1a2234]">
                                {item.buyer?.full_name || item.buyer?.email || "Client"}
                              </div>
                            </div>
                            <div className="text-xs text-slate-400">
                              {item.shared_at ? new Date(item.shared_at).toLocaleString() : ""}
                            </div>
                          </div>
                          {item.message && (
                            <p className="text-sm text-slate-600 mb-4 border-l-2 border-[#10b981]/40 pl-3">{item.message}</p>
                          )}
                          <div className="font-semibold text-[#1a2234] mb-1">{item.property?.property_address}</div>
                          {item.property?.personal_score != null && (
                            <p className="text-sm text-slate-600 mb-3">
                              Visit score: <span className="font-bold text-[#10b981]">{item.property.personal_score}/10</span>
                            </p>
                          )}
                          {item.property?.visit_notes && (
                            <p className="text-sm text-slate-500 mb-4">{item.property.visit_notes}</p>
                          )}
                          {item.photos?.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {item.photos.map((ph) => (
                                <div key={ph.id} className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-100">
                                  {ph.signed_url ? (
                                    <img src={ph.signed_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Photo</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SUBCOMPONENTS ── */

function UpgradeGate({ plan }) {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 bg-[#c9a84c]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Lock size={28} className="text-[#c9a84c]" />
      </div>
      <h2 className="text-xl font-bold text-[#1a2234] mb-2">Realtor Feature</h2>
      <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
        This feature requires a Realtor account. Upgrade to access client management, private listings, and comparison sharing tools.
      </p>
      <Link to={createPageUrl("Pricing")}
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#047857] hover:bg-[#065f46] text-white font-bold rounded-xl text-sm transition">
        View Realtor Plans <ChevronRight size={15} />
      </Link>
    </div>
  );
}

function ClientCard({ client, shares = [], contacts = [], onOpenReport, onDelete, onPresetAdded }) {
  const [expanded, setExpanded] = useState(false);
  const [presets, setPresets] = useState([]);
  const [showPresetForm, setShowPresetForm] = useState(false);

  useEffect(() => {
    if (expanded) {
      api.entities.Preset.list(client.id)
        .then(setPresets)
        .catch(() => setPresets([]));
    }
  }, [expanded, client.id, showPresetForm]);

  const matchedContact = useMemo(() => {
    const email = (client.email || "").trim().toLowerCase();
    if (!email) return null;
    return (
      contacts.find((c) => (c.contact?.email || "").trim().toLowerCase() === email) || null
    );
  }, [client.email, contacts]);

  const statusColors = { active: "bg-[#10b981]/10 text-[#10b981]", under_contract: "bg-blue-50 text-blue-600", closed: "bg-slate-100 text-slate-500", inactive: "bg-red-50 text-red-400" };
  const recentShares = shares.slice(0, 3);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex gap-4">
        <div className="w-10 h-10 bg-[#10b981]/10 rounded-xl flex items-center justify-center shrink-0">
          <Users size={18} className="text-[#10b981]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-[#1a2234] text-sm">{client.name}</div>
              {client.status && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusColors[client.status] || "bg-slate-100 text-slate-500"}`}>{client.status?.replace("_", " ")}</span>}
            </div>
            <button onClick={() => onDelete(client.id)} className="text-slate-200 hover:text-red-400 transition"><Trash2 size={15} /></button>
          </div>
          <div className="mt-2 space-y-1">
            {client.email && <div className="flex items-center gap-2 text-xs text-slate-500"><Mail size={11} />{client.email}</div>}
            {client.phone && <div className="flex items-center gap-2 text-xs text-slate-500"><Phone size={11} />{client.phone}</div>}
            {(client.budget_min || client.budget_max) && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <DollarSign size={11} />
                {client.budget_min ? `$${Number(client.budget_min).toLocaleString()}` : "—"} – {client.budget_max ? `$${Number(client.budget_max).toLocaleString()}` : "—"}
              </div>
            )}
            {client.notes && <div className="flex items-start gap-2 text-xs text-slate-400 mt-1"><FileText size={11} className="mt-0.5 shrink-0" />{client.notes}</div>}
          </div>

          {recentShares.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Shared homes</div>
              {recentShares.map((s) => {
                const prop = s.property_payload || {};
                const addr =
                  prop.address || prop.formattedAddress || prop.property_address || "Property";
                const label = shareDisplayStatus(s);
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-600">{addr}</span>
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${shareStatusBadgeClass(label)}`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
              {shares.length > 3 && (
                <p className="text-[10px] text-slate-400">+{shares.length - 3} more</p>
              )}
            </div>
          )}

          {matchedContact && onOpenReport && (
            <button
              type="button"
              onClick={() => onOpenReport(matchedContact.contact_user_id || matchedContact.contact?.id)}
              className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#10b981] hover:underline"
            >
              <BarChart3 size={12} /> Comparison report
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#10b981] hover:underline"
          >
            <Bookmark size={12} />
            {expanded ? "Hide" : "Show"} client presets{expanded ? ` (${presets.length})` : ""}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Client presets</span>
            <button
              onClick={() => setShowPresetForm(true)}
              className="text-xs font-semibold text-[#10b981] hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> Add preset
            </button>
          </div>
          {presets.length === 0 ? (
            <p className="text-xs text-slate-400">No presets for this client. Add one to search your private listings by their preferences.</p>
          ) : (
            <div className="space-y-2">
              {presets.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-xl">
                  <span className="text-sm font-medium text-[#1a2234]">{p.name}</span>
                  <Link
                    to={createPageUrl("SearchByPreset") + `?client_id=${client.id}&preset_id=${p.id}&source=private`}
                    className="flex items-center gap-1 text-xs font-semibold text-[#10b981] hover:underline"
                  >
                    <Search size={11} /> Search private listings
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showPresetForm && (
        <ClientPresetForm
          client={client}
          onSave={async (data) => {
            const created = await api.entities.Preset.create({
              name: data.name,
              weights: data.weights || {},
              filters: data.filters || {},
              client_id: client.id,
            });
            setPresets(prev => [created, ...prev]);
            setShowPresetForm(false);
            onPresetAdded?.();
          }}
          onClose={() => setShowPresetForm(false)}
        />
      )}
    </div>
  );
}

function ClientPresetForm({ client, onSave, onClose }) {
  const [name, setName] = useState(`${client.name}'s search`);
  const [weights, setWeights] = useState({});
  const [filters, setFilters] = useState({
    budget_min: client.budget_min ?? "",
    budget_max: client.budget_max ?? "",
  });
  return (
    <div className="mt-4 p-4 bg-slate-50 rounded-xl">
      <h4 className="text-sm font-bold text-[#1a2234] mb-3">Add preset for {client.name}</h4>
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Preset name"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
        <PresetFiltersForm filters={filters} onChange={setFilters} compact />
        <div className="flex gap-2">
          <button
            onClick={() => onSave({ name, weights, filters })}
            className="px-4 py-2 bg-[#047857] hover:bg-[#065f46] text-white font-semibold rounded-xl text-sm"
          >
            Save preset
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-sm font-medium">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function SendToClientButton({ listing, client }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!api.realtor?.assignProperty) {
      setStatus("Requires Python backend.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      await api.realtor.assignProperty({
        client_id: client.id,
        client_email: client.email,
        property_address: listing.address,
        property_snapshot: listing,
        message: `Your realtor shared this home for a guided walk-through: ${listing.address}`,
      });
      setStatus("Sent — client will see it in Profile → For You.");
    } catch (e) {
      setStatus(e?.message || "Could not send. Client needs a linked app account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={send}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#1a2234] hover:bg-[#243050] px-3 py-2 rounded-lg disabled:opacity-60"
      >
        <Share2 size={12} />
        {loading ? "Sending…" : "Send to client for walk-through"}
      </button>
      {status && <p className="text-[10px] text-slate-500 mt-1">{status}</p>}
    </div>
  );
}

function ListingCard({ listing, clients, onDelete }) {
  const client = clients.find(c => c.id === listing.client_id);
  const statusColors = { off_market: "bg-purple-50 text-purple-600", coming_soon: "bg-yellow-50 text-yellow-600", active: "bg-[#10b981]/10 text-[#10b981]", pending: "bg-blue-50 text-blue-600", sold: "bg-slate-100 text-slate-500" };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-bold text-[#1a2234] text-sm">{listing.address}</div>
          <div className="text-xs text-slate-400">{listing.city}, {listing.state} {listing.zip}</div>
        </div>
        <button onClick={() => onDelete(listing.id)} className="text-slate-200 hover:text-red-400 transition shrink-0"><Trash2 size={15} /></button>
      </div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {listing.status && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusColors[listing.status] || "bg-slate-100"}`}>{listing.status?.replace("_", " ")}</span>}
        {listing.price && <span className="text-sm font-bold text-[#10b981]">${Number(listing.price).toLocaleString()}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[["Beds", listing.bedrooms], ["Baths", listing.bathrooms], ["Sq Ft", listing.sqft?.toLocaleString()]].map(([l, v]) => v ? (
          <div key={l} className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-[#1a2234]">{v}</div>
            <div className="text-[10px] text-slate-400">{l}</div>
          </div>
        ) : null)}
      </div>
      {client && <div className="text-xs text-slate-400 flex items-center gap-1 mb-1"><Users size={11} /> For: <span className="font-semibold text-[#1a2234]">{client.name}</span></div>}
      {client && (
        <SendToClientButton listing={listing} client={client} />
      )}
      <AIListingDescription listing={listing} />
      <AIPropertyInsights property={listing} />
      <Link to={createPageUrl("Evaluate") + `?address=${encodeURIComponent(listing.address)}&city=${encodeURIComponent(listing.city || "")}&state=${encodeURIComponent(listing.state || "")}&price=${listing.price || ""}`}
        className="mt-3 flex items-center gap-1 text-xs text-[#10b981] font-semibold hover:underline">
        Score this property <ChevronRight size={12} />
      </Link>
    </div>
  );
}

function ClientForm({ onSave, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", budget_min: "", budget_max: "", notes: "", status: "active" });
  const set = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  return (
    <Modal title="Add Client" onClose={onClose}>
      <div className="space-y-4">
        {[["name", "Full Name", "Jane Smith"], ["email", "Email", "jane@email.com"], ["phone", "Phone", "(555) 000-0000"]].map(([name, label, placeholder]) => (
          <div key={name}>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">{label}</label>
            <input name={name} value={form[name]} onChange={set} placeholder={placeholder}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          {[["budget_min", "Budget Min ($)"], ["budget_max", "Budget Max ($)"]].map(([name, label]) => (
            <div key={name}>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">{label}</label>
              <input name={name} type="number" value={form[name]} onChange={set}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20" />
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1.5">Status</label>
          <select name="status" value={form.status} onChange={set}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981]">
            {["active", "under_contract", "closed", "inactive"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1.5">Notes</label>
          <textarea name="notes" value={form.notes} onChange={set} rows={3} placeholder="Preferences, requirements, notes..."
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 resize-none" />
        </div>
        <button onClick={() => onSave(form)} className="w-full py-3 bg-[#047857] hover:bg-[#065f46] text-white font-bold rounded-xl text-sm transition">Add Client</button>
      </div>
    </Modal>
  );
}

function ListingForm({ clients, onSave, onClose }) {
  const [form, setForm] = useState({ address: "", city: "", state: "", zip: "", price: "", bedrooms: "", bathrooms: "", sqft: "", year_built: "", status: "off_market", client_id: "", notes: "" });
  const set = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  return (
    <Modal title="Add Private Listing" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1.5">Street Address</label>
          <input name="address" value={form.address} onChange={set} placeholder="123 Main St"
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[["city", "City"], ["state", "State"], ["zip", "ZIP"]].map(([name, label]) => (
            <div key={name}>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">{label}</label>
              <input name={name} value={form[name]} onChange={set}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[["price", "Price ($)"], ["sqft", "Sq Ft"], ["bedrooms", "Beds"], ["bathrooms", "Baths"]].map(([name, label]) => (
            <div key={name}>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">{label}</label>
              <input name={name} type="number" value={form[name]} onChange={set}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Status</label>
            <select name="status" value={form.status} onChange={set}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981]">
              {["off_market", "coming_soon", "active", "pending", "sold"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Assign to Client</label>
            <select name="client_id" value={form.client_id} onChange={set}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981]">
              <option value="">— No client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1.5">Notes</label>
          <textarea name="notes" value={form.notes} onChange={set} rows={2}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 resize-none" />
        </div>
        <button onClick={() => onSave(form)} className="w-full py-3 bg-[#047857] hover:bg-[#065f46] text-white font-bold rounded-xl text-sm transition">Add Listing</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-[#1a2234] text-base">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition">
            <X size={15} />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}