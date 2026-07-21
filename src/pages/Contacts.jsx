import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, Search, UserPlus, Users, X } from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import RequireAuth from "@/components/RequireAuth";
import LoadingWithTimeout from "@/components/async/LoadingWithTimeout";
import FetchErrorState from "@/components/async/FetchErrorState";

const ROLES = [
  { id: "client", label: "Client" },
  { id: "realtor", label: "Realtor" },
  { id: "other", label: "Other" },
];

export default function Contacts() {
  return (
    <RequireAuth message="Sign in to manage your contacts">
      <ContactsInner />
    </RequireAuth>
  );
}

function ContactsInner() {
  const [data, setData] = useState({ accepted: [], pending_outgoing: [], pending_incoming: [] });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [role, setRole] = useState("client");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.contacts.list();
      setData(list || { accepted: [], pending_outgoing: [], pending_incoming: [] });
    } catch (e) {
      setError(e?.message || "Could not load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await api.contacts.search(q.trim());
        if (!cancelled) setResults(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const addUser = async (user) => {
    setBusyId(user.id);
    setError("");
    try {
      await api.contacts.add({
        contact_user_id: user.id,
        contact_role: role,
      });
      setQ("");
      setResults([]);
      await load();
    } catch (e) {
      setError(e?.message || "Could not add contact");
    } finally {
      setBusyId(null);
    }
  };

  const accept = async (id) => {
    setBusyId(id);
    try {
      const pending = (data.pending_incoming || []).find((c) => c.id === id);
      await api.contacts.accept(id);
      await load();
      // First time client accepts realtor invite/connection — client's benefit.
      if (pending?.contact_role === "client") {
        try {
          const { requestPriorityQuiz } = await import("@/lib/importanceQuiz");
          requestPriorityQuiz({ trigger: "client" });
        } catch {
          /* non-blocking */
        }
      }
    } catch (e) {
      setError(e?.message || "Could not accept");
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (id) => {
    setBusyId(id);
    try {
      await api.contacts.decline(id);
      await load();
    } catch (e) {
      setError(e?.message || "Could not decline");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this contact?")) return;
    setBusyId(id);
    try {
      await api.contacts.remove(id);
      await load();
    } catch (e) {
      setError(e?.message || "Could not remove");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2234] flex items-center gap-2">
            <Users size={22} className="text-[#10b981]" /> Contacts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Add clients and colleagues to send homes for scoring.
          </p>
        </div>
        <Link
          to={createPageUrl("SharedHomes")}
          className="text-sm font-semibold text-[#10b981] hover:underline shrink-0"
        >
          Shared homes →
        </Link>
      </div>

      {error && (
        <FetchErrorState compact message={error} onRetry={load} />
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Find by email, username, or name
        </label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#10b981]/30"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                role === r.id
                  ? "bg-[#10b981]/10 border-[#10b981]/40 text-[#059669]"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              Tag as {r.label}
            </button>
          ))}
        </div>
        {searching && (
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" /> Searching…
          </p>
        )}
        {results.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {results.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1a2234] truncate">
                    {u.full_name || u.username || u.email || "User"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {[u.username ? `@${u.username}` : null, u.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => addUser(u)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#1a2234] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#243050] disabled:opacity-50"
                >
                  <UserPlus size={12} /> Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {loading ? (
        <LoadingWithTimeout isLoading onRetry={load} label="Loading contacts…" />
      ) : (
        <>
          {data.pending_incoming?.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-[#1a2234]">Incoming requests</h2>
              {data.pending_incoming.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {c.contact?.full_name || c.contact?.email || "User"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{c.contact?.email}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => accept(c.id)}
                      className="rounded-lg bg-[#10b981] p-2 text-white"
                      aria-label="Accept"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => decline(c.id)}
                      className="rounded-lg border border-slate-200 p-2 text-slate-500"
                      aria-label="Decline"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-[#1a2234]">Your contacts</h2>
            {data.accepted?.length === 0 ? (
              <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                No contacts yet. Search above to add a client or colleague.
              </p>
            ) : (
              data.accepted.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {c.contact?.full_name || c.label || c.contact?.email || "Contact"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[c.contact_role, c.contact?.email].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => remove(c.id)}
                    className="text-xs font-semibold text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </section>

          {data.pending_outgoing?.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-slate-500">Pending sent</h2>
              {data.pending_outgoing.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
                >
                  Waiting on {c.contact?.full_name || c.contact?.email || "user"}…
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
