import { useState } from "react";
import {
  Check,
  Copy,
  Facebook,
  Instagram,
  Link2,
  Mail,
  MessageCircle,
  Share2,
  X,
} from "lucide-react";
import {
  canUseWebShare,
  facebookShareHref,
  mailtoShareHref,
  propertyShareMessage,
  propertySharePayload,
  publicPropertyIdentity,
  smsShareHref,
  twitterShareHref,
  whatsappShareHref,
} from "@/lib/propertyShare";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

/**
 * Share a public property link outside the app (Messages, Mail, Instagram via OS sheet, etc.).
 * Prefers navigator.share on supporting devices; falls back to channel buttons.
 */
export default function SharePropertyButton({
  property,
  className,
  variant = "default",
  label = "Share",
  stopPropagation = false,
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const identity = publicPropertyIdentity(property);
  if (!identity.address && identity.lat == null && identity.lng == null) {
    return null;
  }

  const payload = propertySharePayload(property);
  const message = propertyShareMessage(property);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(payload.url);
      setCopied(true);
      toast({ title: "Link copied", description: "Paste it anywhere — including Instagram." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Could not copy", description: "Select and copy the link manually.", variant: "destructive" });
    }
  };

  const openFallback = () => setOpen(true);

  const handleShare = async (e) => {
    if (stopPropagation) {
      e?.preventDefault?.();
      e?.stopPropagation?.();
    }
    if (canUseWebShare()) {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        // User dismissed the sheet — don't open fallback.
        if (err?.name === "AbortError") return;
      }
    }
    openFallback();
  };

  const btnClass =
    variant === "compact"
      ? "inline-flex items-center justify-center gap-1.5 min-h-9 min-w-9 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-white active:bg-slate-50"
      : variant === "ghost"
        ? "inline-flex items-center justify-center gap-1.5 min-h-10 min-w-10 px-3 py-2 rounded-xl text-slate-500 hover:text-[#14192E] hover:bg-slate-100"
        : variant === "sidebar"
          ? "mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100 min-h-12"
          : variant === "icon"
            ? "inline-flex items-center justify-center min-h-9 min-w-9 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
            : variant === "onDark"
              ? "flex items-center gap-2 px-4 py-2.5 min-h-11 border border-white/20 text-white font-semibold rounded-xl text-sm hover:bg-white/10 transition"
              : "flex items-center gap-2 px-4 py-2.5 min-h-11 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors text-sm";

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        className={cn(btnClass, className)}
        aria-label={`Share ${identity.address || "this property"}`}
        title="Share this home"
      >
        <Share2 size={variant === "compact" || variant === "icon" ? 14 : 15} />
        {variant !== "icon" ? <span>{label}</span> : null}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-property-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#14192E] px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Share2 size={16} className="text-[#106B49] shrink-0" />
                <span id="share-property-title" className="text-white font-bold truncate">
                  Share this home
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-10 min-w-10 inline-flex items-center justify-center text-slate-400 hover:text-white rounded-lg"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              {identity.address ? (
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{identity.address}</p>
              ) : (
                <p className="text-sm text-slate-500 mb-4">Send a link anyone can open — no account required.</p>
              )}

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 mb-4">
                <Link2 size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs text-slate-500 truncate flex-1 select-all">{payload.url}</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={copyLink}
                  className={cn(
                    "flex items-center justify-center gap-2 min-h-12 rounded-xl text-sm font-bold transition",
                    copied
                      ? "bg-[#106B49] text-white"
                      : "bg-[#14192E] hover:bg-[#2A3150] text-white"
                  )}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy link"}
                </button>

                <a
                  href={mailtoShareHref({ subject: payload.title, body: message })}
                  className="flex items-center justify-center gap-2 min-h-12 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Mail size={16} /> Email
                </a>

                <a
                  href={smsShareHref(message)}
                  className="flex items-center justify-center gap-2 min-h-12 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <MessageCircle size={16} /> Text / SMS
                </a>

                <a
                  href={whatsappShareHref(message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 min-h-12 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <MessageCircle size={16} className="text-brand" /> WhatsApp
                </a>

                <a
                  href={facebookShareHref(payload.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 min-h-12 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Facebook size={16} className="text-[#1877f2]" /> Facebook
                </a>

                <a
                  href={twitterShareHref({ url: payload.url, text: payload.text })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 min-h-12 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <span className="text-sm font-black leading-none">𝕏</span> X / Twitter
                </a>
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                <Instagram size={16} className="text-slate-500 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Instagram doesn&apos;t support web share-to-feed links. Use{" "}
                  <button type="button" onClick={copyLink} className="font-semibold text-[#0C4F37] underline-offset-2 hover:underline">
                    Copy link
                  </button>{" "}
                  and paste it in a DM or story, or share from your phone&apos;s native share sheet.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
