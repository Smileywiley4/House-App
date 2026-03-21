import { useState, useEffect } from "react";
import { Mail, UserPlus, Loader2, BookUser, Copy, Check } from "lucide-react";
import { api } from "@/api";
import { usePlan } from "@/core/hooks/usePlan";

const usePython = import.meta.env.VITE_USE_PYTHON_BACKEND === "true";

/** Invite friends by email + optional contact picker (Chrome/Edge). */
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
    if (!usePython || !isPremium || !api.invitations?.listSent) return;
    api.invitations.listSent().then(setSentList).catch(() => setSentList([]));
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

  if (!isPremium) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
        <UserPlus className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-600 mb-2 font-medium">Premium or Realtor plan required</p>
        <p className="text-slate-400 text-sm">Upgrade to invite friends and share visit folders with other accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-[#1a2234] mb-1 flex items-center gap-2">
          <Mail size={20} className="text-[#10b981]" />
          Invite friends
        </h2>
        <p className="text-slate-400 text-sm mb-4">
          We’ll generate a sign-in link for each email. On supported browsers you can pick contacts; otherwise paste
          addresses (one per line or comma-separated).
        </p>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={pickContacts}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a2234] text-white text-sm font-semibold hover:bg-[#243050] transition"
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
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Optional message</label>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={2}
              placeholder="Join me on Property Pulse…"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={sendInvites}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#10b981] text-white font-bold text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            Send invite links
          </button>

          {sent?.invites?.length > 0 && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm">
              <p className="font-semibold text-emerald-900 mb-2">Created {sent.invites.length} invite(s)</p>
              <ul className="space-y-2">
                {sent.invites.map((inv) => (
                  <li key={inv.email} className="flex flex-col sm:flex-row sm:items-center gap-2 text-emerald-800">
                    <span>{inv.email}</span>
                    <button
                      type="button"
                      className="text-xs flex items-center gap-1 text-[#10b981] font-semibold"
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

      {sentList.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[#1a2234] mb-2">Invites you’ve sent</h3>
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
          <h3 className="text-sm font-bold text-[#1a2234] mb-2">Folders & properties you’ve shared</h3>
          <ul className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50 text-sm">
            {outgoingShares.map((row) => (
              <li key={row.share_id} className="px-4 py-3">
                <div className="font-medium text-[#1a2234]">
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
