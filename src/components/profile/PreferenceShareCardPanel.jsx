import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Link2,
  Loader2,
  RefreshCw,
  Share2,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";
import { api } from "@/api";
import { APP_NAME } from "@/core/constants";
import { canUseWebShare } from "@/lib/propertyShare";
import { downloadPreferenceCardPng } from "@/lib/preferenceCardImage";

const usePython = import.meta.env.VITE_USE_PYTHON_BACKEND === "true";

function PreferenceCardVisual({ card }) {
  if (!card?.top_priorities?.length) return null;
  const homes = Number(card.homes_scored) || 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#0f172a] via-[#132337] to-[#0d3d36] text-white p-6 sm:p-8 shadow-sm">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#106B49]/10"
        aria-hidden
      />
      <p className="text-[#106B49] text-xs font-bold uppercase tracking-widest mb-2">
        {APP_NAME} · Preference pattern
      </p>
      <h3 className="text-xl sm:text-2xl font-bold leading-snug mb-1">
        {homes > 0
          ? `Based on ${homes} home${homes === 1 ? "" : "s"} scored`
          : "From your saved scoring preferences"}
      </h3>
      <p className="text-slate-300 text-sm mb-5">
        Top {Math.min(3, card.top_priorities.length)} priorit
        {card.top_priorities.length === 1 ? "y" : "ies"}
        {card.display_name ? ` · ${card.display_name}` : ""}
      </p>
      <ol className="space-y-3">
        {card.top_priorities.slice(0, 3).map((p, i) => (
          <li key={`${p.label}-${i}`} className="flex items-baseline gap-3">
            <span className="text-[#106B49] font-bold text-sm w-5">{i + 1}.</span>
            <div>
              <p className="font-semibold text-base">{p.label}</p>
              {p.avg_importance != null && (
                <p className="text-xs text-slate-400 mt-0.5">
                  avg importance {Number(p.avg_importance).toFixed(1)}/10
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[11px] text-slate-500 flex items-center gap-1.5">
        <Shield size={12} /> Preferences only — no addresses, prices, or photos
      </p>
    </div>
  );
}

/**
 * Opt-in preference pattern card: preview → share link / image → regenerate / revoke.
 * Mount on Profile (Score Preferences or Presets). Logged-in only.
 */
export default function PreferenceShareCardPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [card, setCard] = useState(null);
  const [share, setShare] = useState(null);
  const [canShare, setCanShare] = useState(false);
  const [includeFirstName, setIncludeFirstName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const applyPayload = (data) => {
    setCard(data?.card || null);
    setShare(data?.share || null);
    setCanShare(Boolean(data?.can_share ?? data?.card?.top_priorities?.length));
    if (data?.share?.include_first_name != null) {
      setIncludeFirstName(Boolean(data.share.include_first_name));
    }
  };

  const load = useCallback(async () => {
    if (!usePython || !api.preferenceCards?.preview) {
      setLoading(false);
      setError("Preference cards require the live backend.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api.preferenceCards.preview();
      applyPayload(data);
      if (data?.share?.enabled) setShowPreview(true);
    } catch (e) {
      setError(e?.message || "Could not load preference card");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createPreview = async () => {
    setShowPreview(true);
    setBusy("preview");
    setError("");
    try {
      const data = await api.preferenceCards.preview();
      applyPayload(data);
    } catch (e) {
      setError(e?.message || "Could not build preview");
    } finally {
      setBusy("");
    }
  };

  const enableShare = async ({ rotate = false } = {}) => {
    setBusy(rotate ? "rotate" : "enable");
    setError("");
    try {
      const data = await api.preferenceCards.enableShare({
        include_first_name: includeFirstName,
        rotate_token: rotate,
      });
      applyPayload({ ...data, can_share: true });
      setShowPreview(true);
    } catch (e) {
      setError(e?.message || "Could not create share link");
    } finally {
      setBusy("");
    }
  };

  const regenerate = async () => {
    setBusy("regen");
    setError("");
    try {
      const data = await api.preferenceCards.regenerate();
      applyPayload({ ...data, can_share: true });
    } catch (e) {
      setError(e?.message || "Could not regenerate");
    } finally {
      setBusy("");
    }
  };

  const revoke = async () => {
    setBusy("revoke");
    setError("");
    try {
      await api.preferenceCards.revokeShare();
      setShare({ enabled: false, token: null, share_url: null, include_first_name: includeFirstName });
    } catch (e) {
      setError(e?.message || "Could not revoke link");
    } finally {
      setBusy("");
    }
  };

  const copyLink = async () => {
    const url = share?.share_url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the link manually.");
    }
  };

  const webShare = async () => {
    const url = share?.share_url;
    if (!url || !canUseWebShare()) return;
    try {
      await navigator.share({
        title: `${APP_NAME} preference pattern`,
        text: card?.summary_line || "My home-scoring priorities",
        url,
      });
    } catch (e) {
      if (e?.name !== "AbortError") {
        /* ignore */
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 size={16} className="animate-spin" /> Loading preference card…
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#106B49]/10 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-[#106B49]" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">Preference pattern card</h3>
          <p className="text-sm text-muted-foreground mt-1">
            See what you tend to prioritize across scored homes — then optionally share a
            preferences-only card. Nothing is public until you create a link.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
      )}

      {!showPreview ? (
        <button
          type="button"
          onClick={createPreview}
          disabled={busy === "preview"}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#14192E] hover:bg-[#2A3150] text-white disabled:opacity-60"
        >
          {busy === "preview" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Create preference card
        </button>
      ) : (
        <>
          {!canShare || !card?.top_priorities?.length ? (
            <p className="text-sm text-muted-foreground">
              Score a few homes (or save score preferences) to generate your pattern.
            </p>
          ) : (
            <>
              <PreferenceCardVisual card={card} />
              <p className="text-sm text-slate-600 leading-relaxed">{card.summary_line}</p>

              <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-border"
                  checked={includeFirstName}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    setIncludeFirstName(next);
                    if (!share?.enabled || !api.preferenceCards?.updateShare) return;
                    try {
                      const data = await api.preferenceCards.updateShare({
                        include_first_name: next,
                      });
                      applyPayload({ ...data, can_share: true });
                    } catch {
                      /* keep local toggle; user can recreate link */
                    }
                  }}
                />
                <span>
                  Include first name on the card{" "}
                  <span className="text-muted-foreground">(off by default)</span>
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={!!busy}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted disabled:opacity-60"
                >
                  {busy === "regen" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={() => downloadPreferenceCardPng(card)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted"
                >
                  <Download size={14} /> Download image
                </button>
              </div>

              {!share?.enabled ? (
                <button
                  type="button"
                  onClick={() => enableShare({ rotate: false })}
                  disabled={!!busy}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#106B49] hover:bg-[#0C4F37] text-white disabled:opacity-60"
                >
                  {busy === "enable" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Link2 size={15} />
                  )}
                  Create share link
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Public link (opt-in)
                  </p>
                  <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2.5">
                    <Link2 size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {share.share_url}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyLink}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#14192E] text-white"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    {canUseWebShare() && (
                      <button
                        type="button"
                        onClick={webShare}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted"
                      >
                        <Share2 size={14} /> Share
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => enableShare({ rotate: true })}
                      disabled={!!busy}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted disabled:opacity-60"
                    >
                      {busy === "rotate" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      New link
                    </button>
                    <button
                      type="button"
                      onClick={revoke}
                      disabled={!!busy}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {busy === "revoke" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <XCircle size={14} />
                      )}
                      Revoke
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Regenerating updates the summary as you score more homes. Revoking or
                    creating a new link invalidates the old URL.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
