import { useState, useEffect, useCallback } from "react";
import { Copy, Check, Loader2, Link2, Mail, MessageSquare, Share2, SkipForward } from "lucide-react";
import { api } from "@/api";
import { mailtoShareHref, smsShareHref } from "@/lib/propertyShare";
import { APP_NAME } from "@/core/constants";

const usePython = import.meta.env.VITE_USE_PYTHON_BACKEND === "true";

function inviteMessage(url) {
  return `Join me on ${APP_NAME} — compare homes and find your fit.\n${url}`;
}

/**
 * Shareable referral invite UI for signup + Profile.
 * Free users can invite; Pro+ reward credits apply when invitee pays.
 */
export default function InviteContactsPanel({
  compact = false,
  showSkip = false,
  onSkip,
  onDone,
  title = "Invite contacts",
  subtitle = "Share your link. Friends can sign up free — when they go Pro or Realtor, you both get about a month of credit on your next bill.",
}) {
  const [loading, setLoading] = useState(true);
  const [inviteUrl, setInviteUrl] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [rewardSummary, setRewardSummary] = useState("");

  const load = useCallback(async () => {
    if (!usePython || !api.referrals?.me) {
      setLoading(false);
      setError("Invites require the live backend.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api.referrals.me();
      setInviteUrl(data.invite_url || "");
      setCode(data.code || "");
      setRewardSummary(data.reward_summary || "");
    } catch (e) {
      setError(e?.message || "Could not load invite link");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the link and copy manually.");
    }
  };

  const nativeShare = async () => {
    if (!inviteUrl || !navigator.share) return;
    try {
      await navigator.share({
        title: `${APP_NAME} invite`,
        text: inviteMessage(inviteUrl),
        url: inviteUrl,
      });
    } catch (e) {
      if (e?.name !== "AbortError") {
        /* user cancelled or share failed — ignore */
      }
    }
  };

  if (!usePython) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Invite contacts requires the Python backend.
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!compact && (
        <div>
          <h2 className="text-lg font-bold text-[#1a2234] flex items-center gap-2">
            <Share2 size={20} className="text-[#10b981]" />
            {title}
          </h2>
          <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading your invite link…
          </div>
        ) : error && !inviteUrl ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Your invite link</label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-[#1a2234] font-mono truncate">
                  <Link2 size={14} className="shrink-0 text-slate-400" />
                  <span className="truncate">{inviteUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a2234] text-white text-sm font-semibold hover:bg-[#243050] shrink-0"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {code && (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Code: <span className="font-mono font-semibold text-slate-600">{code}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {typeof navigator !== "undefined" && navigator.share && (
                <button
                  type="button"
                  onClick={nativeShare}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#10b981] text-white text-sm font-semibold hover:bg-[#0d9b6c]"
                >
                  <Share2 size={16} />
                  Share
                </button>
              )}
              <a
                href={mailtoShareHref({
                  subject: `Join me on ${APP_NAME}`,
                  body: inviteMessage(inviteUrl),
                })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-[#1a2234] hover:bg-slate-50"
              >
                <Mail size={16} />
                Email
              </a>
              <a
                href={smsShareHref(inviteMessage(inviteUrl))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-[#1a2234] hover:bg-slate-50"
              >
                <MessageSquare size={16} />
                Text / SMS
              </a>
            </div>

            {rewardSummary && (
              <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
                {rewardSummary}
              </p>
            )}
            {error && <p className="text-xs text-amber-700">{error}</p>}
          </>
        )}
      </div>

      {(showSkip || onDone) && (
        <div className="flex flex-wrap gap-2 justify-end">
          {showSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-[#1a2234] hover:bg-slate-100"
            >
              <SkipForward size={16} />
              Skip for now
            </button>
          )}
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] text-white text-sm font-bold hover:bg-[#0d9b6c]"
            >
              Continue
            </button>
          )}
        </div>
      )}
    </div>
  );
}
