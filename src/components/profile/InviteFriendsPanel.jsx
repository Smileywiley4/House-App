import { useState, useEffect } from "react";
import { Mail, UserPlus, Loader2, BookUser, Copy, Check } from "lucide-react";
import { api } from "@/api";
import { usePlan } from "@/core/hooks/usePlan";
import InviteContactsPanel from "@/components/InviteContactsPanel";

const usePython = import.meta.env.VITE_USE_PYTHON_BACKEND === "true";

/** Invite contacts (referral link) + optional email invites + peer share list. */
export default function InviteFriendsPanel() {
  const { isPremium } = usePlan();
  const [emails, setEmails] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(null);
  const [sentList, setSentList] = useState([]);
  const [outgoingShares, setOutgoingShares] = useState([]);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (!usePython) return;
    if (isPremium && api.invitations?.listSent) {
      api.invitations.listSent().then(setSentList).catch(() => setSentList([]));
    }
    if (api.library?.peerSharesOutgoing) {
      api.library.peerSharesOutgoing().then(setOutgoingShares).catch(() => setOutgoingShares([]));
    }
  }, [isPremium]);

  const pickContacts = async () => {
    if (!("contacts" in navigator) || !("ContactsManager" in window)) {
      alert("Contact picking isn’t available in this browser. Paste email addresses in the box below.");
      return;
    }
    try {
      const contacts = await navigator.contacts.select(["name", "email"], { multiple: true });
      const found = [];
      contacts.forEach((c) => {
        (c.email || []).forEach((e) => {
          if (e && e.includes("@")) found.push(e.trim());
        });
      });
      if (!found.length) {
        alert("No email addresses found on the selected contacts.");
        return;
      }
      const existing = emails
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      setEmails([...new Set([...existing, ...found])].join("\n"));
    } catch (e) {
      if (e?.name !== "AbortError") console.warn(e);
    }
  };

  const sendInvites = async () => {
    const arr = emails
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!arr.length) return;
    setLoading(true);
    setSent(null);
    try {
      const r = await api.invitations.send({ emails: arr, message: msg || undefined });
      setSent(r);
      setEmails("");
      api.invitations.listSent().then(setSentList).catch(() => {});
    } catch (e) {
      alert(e?.message || "Could not send invites");
    } finally {
      setLoading(false);
    }
  };

  if (!usePython) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-900">
        Invitations and contact-based sharing require the Python backend (<code className="text-xs">VITE_USE_PYTHON_BACKEND=true</code>).
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <InviteContactsPanel
        title="Invite contacts"
        subtitle="Share your personal link anytime. Free signups are welcome — Pro/Realtor referral credit applies when your invitee subscribes."
      />

      {isPremium && (
        <div>
          <h2 className="text-lg font-bold text-[#14192E] mb-1 flex items-center gap-2">
            <Mail size={20} className="text-[#106B49]" />
            Email invites
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Generate a tracked sign-in link for each email. On supported browsers you can pick contacts; otherwise paste
            addresses (one per line or comma-separated).
          </p>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={pickContacts}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#14192E] text-white text-sm font-semibold hover:bg-[#2A3150] transition"
              >
                <BookUser size={16} />
                Choose from contacts
              </button>
              <span className="text-xs text-slate-400 self-center">(Chrome / Edge on Android or desktop)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email addresses</label>
              <textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                rows={4}
                placeholder={"friend@email.com\nanother@email.com"}
                className="w-full px-4 py-3 rounded-xl border border-[#106B49]/50 bg-[#F8F7F4] text-sm font-mono text-[#14192E]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Optional message</label>
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={2}
                placeholder="Join me on Propurty…"
                className="w-full px-4 py-3 rounded-xl border border-[#106B49]/50 bg-[#F8F7F4] text-sm text-[#14192E] placeholder:text-[#6B6963] focus:outline-none focus:border-[#106B49]"
              />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={sendInvites}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#106B49] text-white font-bold text-sm disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              Send invite links
            </button>

            {sent?.invites?.length > 0 && (
              <div className="rounded-xl bg-propurty-green-tint border border-brand/20 p-4 text-sm">
                <p className="font-semibold text-brand-hover mb-2">Created {sent.invites.length} invite(s)</p>
                <ul className="space-y-2">
                  {sent.invites.map((inv) => (
                    <li key={inv.email} className="flex flex-col sm:flex-row sm:items-center gap-2 text-brand-hover">
                      <span>{inv.email}</span>
                      <button
                        type="button"
                        className="text-xs flex items-center gap-1 text-[#106B49] font-semibold"
                        onClick={() => {
                          navigator.clipboard.writeText(inv.invite_url);
                          setCopied(inv.email);
                          setTimeout(() => setCopied(null), 2000);
                        }}
                      >
                        {copied === inv.email ? <Check size={14} /> : <Copy size={14} />}
                        Copy link
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {sentList.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[#14192E] mb-2">Email invites you’ve sent</h3>
          <ul className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50 text-sm">
            {sentList.map((row) => (
              <li key={row.id} className="px-4 py-3 flex justify-between gap-2">
                <span>{row.invitee_email}</span>
                <span className="text-slate-400 capitalize">{row.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {outgoingShares.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[#14192E] mb-2">Folders & properties you’ve shared</h3>
          <ul className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50 text-sm">
            {outgoingShares.map((row) => (
              <li key={row.share_id} className="px-4 py-3">
                <div className="font-medium text-[#14192E]">
                  {row.kind === "folder" ? `Folder: ${row.folder_name}` : row.property_address}
                </div>
                <div className="text-xs text-slate-500">→ {row.recipient?.full_name || row.recipient?.email}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
