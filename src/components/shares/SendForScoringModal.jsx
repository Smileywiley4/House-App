import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Send, Users } from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { usePlan } from "@/core/hooks/usePlan";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Realtor (+ admin): pick accepted contacts and send property for scoring.
 * Optional private listing URL stays between realtor and recipient only.
 * // future: gamify mobile share/score loop
 */
export default function SendForScoringModal({ open, onClose, property, onSent }) {
  const { isAuthenticated } = useAuth();
  const { isRealtor } = usePlan();
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("");
  const [privateUrl, setPrivateUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !isAuthenticated || !isRealtor) return;
    setLoading(true);
    setError("");
    api.contacts
      .list()
      .then((data) => setContacts(data?.accepted || []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [open, isAuthenticated, isRealtor]);

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const send = async () => {
    if (!selected.length) {
      setError("Pick at least one contact");
      return;
    }
    setSending(true);
    setError("");
    try {
      await api.shares.send({
        to_user_ids: selected,
        property: property || {},
        message: message.trim() || undefined,
        private_listing_url: privateUrl.trim() || undefined,
      });
      onSent?.();
      onClose?.();
      setSelected([]);
      setMessage("");
      setPrivateUrl("");
    } catch (e) {
      setError(e?.message || "Could not send");
    } finally {
      setSending(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in required</DialogTitle>
            <DialogDescription>Log in to send homes to your contacts.</DialogDescription>
          </DialogHeader>
          <Link
            to="/login"
            className="inline-flex justify-center rounded-xl bg-[#10b981] py-2.5 text-sm font-bold text-white"
          >
            Sign in
          </Link>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isRealtor) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Realtor plan</DialogTitle>
            <DialogDescription>
              “Send to client for scoring” is available on the Realtor plan.
            </DialogDescription>
          </DialogHeader>
          <Link
            to={createPageUrl("Pricing")}
            className="inline-flex justify-center rounded-xl bg-[#1a2234] py-2.5 text-sm font-bold text-white"
          >
            View pricing
          </Link>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send size={18} className="text-[#10b981]" /> Send to client for scoring
          </DialogTitle>
          <DialogDescription>
            Creates a private inbox item for your contact. Optional off-market listing link stays
            between you two only.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8 text-slate-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center space-y-3 py-4">
            <Users className="mx-auto text-slate-300" size={28} />
            <p className="text-sm text-slate-500">Add a contact first, then send homes here.</p>
            <Link
              to={createPageUrl("Contacts")}
              className="inline-flex text-sm font-semibold text-[#10b981] hover:underline"
            >
              Open contacts →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
              {contacts.map((c) => {
                const id = c.contact_user_id;
                const label =
                  c.contact?.full_name || c.label || c.contact?.email || "Contact";
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selected.includes(id)}
                        onChange={() => toggle(id)}
                        className="rounded border-slate-300 text-[#10b981] focus:ring-[#10b981]"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[#1a2234] truncate">
                          {label}
                        </span>
                        <span className="block text-[11px] text-slate-500 truncate">
                          {[c.contact_role, c.contact?.email].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Note for your client (optional)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#10b981]/30"
            />
            <input
              value={privateUrl}
              onChange={(e) => setPrivateUrl(e.target.value)}
              type="url"
              placeholder="Private listing / channel URL (optional)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#10b981]/30"
            />
            <p className="text-[11px] text-slate-400">
              We only store and show this link to you and the recipient — never public browse or SEO.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              disabled={sending || !selected.length}
              onClick={send}
              className="w-full rounded-xl bg-[#10b981] py-2.5 text-sm font-bold text-white hover:bg-[#059669] disabled:opacity-40"
            >
              {sending ? "Sending…" : `Send to ${selected.length || ""} contact${selected.length === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
