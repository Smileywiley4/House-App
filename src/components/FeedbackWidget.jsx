import { useEffect, useId, useRef, useState } from "react";
import { MessageSquarePlus, X, Paperclip, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/api";
import { useAuth } from "@/lib/AuthContext";
import { SUPPORT_EMAIL } from "@/core/companyConfig";

const ACCENT = "#10b981";
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;

/**
 * Persistent bottom-corner feedback button (every page).
 * Collapsed to icon by default; expands a simple form — not live chat.
 * Sits above mobile bottom nav; bottom-right on desktop.
 */
export default function FeedbackWidget() {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("problem");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [screenshotName, setScreenshotName] = useState("");
  const [screenshotBase64, setScreenshotBase64] = useState(null);
  const [pageUrl, setPageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);
  const panelTitleId = useId();

  useEffect(() => {
    if (open && typeof window !== "undefined") {
      setPageUrl(window.location.href);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const resetForm = () => {
    setCategory("problem");
    setMessage("");
    setContactEmail("");
    setScreenshotName("");
    setScreenshotBase64(null);
    setError("");
    setDone(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    resetForm();
    setOpen(true);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    setError("");
    if (!file) {
      setScreenshotName("");
      setScreenshotBase64(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Screenshot must be an image file.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setError("Screenshot must be under 2 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotBase64(typeof reader.result === "string" ? reader.result : null);
      setScreenshotName(file.name);
    };
    reader.onerror = () => {
      setError("Could not read that file.");
      setScreenshotName("");
      setScreenshotBase64(null);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) {
      setError("Please enter a short message.");
      return;
    }
    if (!api?.support?.submitFeedback) {
      setError(`Feedback isn’t available here. Email ${SUPPORT_EMAIL}.`);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const url = typeof window !== "undefined" ? window.location.href : pageUrl;
      await api.support.submitFeedback({
        category,
        message: text,
        page_url: url,
        contact_email: !isAuthenticated ? contactEmail.trim() || undefined : undefined,
        screenshot_base64: screenshotBase64 || undefined,
      });
      setDone(true);
      setMessage("");
      setScreenshotName("");
      setScreenshotBase64(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err?.message || `Could not send. Please email ${SUPPORT_EMAIL} instead.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed z-[45] flex flex-col items-end gap-2 bottom-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom)))] md:bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))]"
    >
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={panelTitleId}
          className="w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/80">
            <h2 id={panelTitleId} className="text-sm font-semibold text-[#1a2234]">
              Send feedback
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              aria-label="Close feedback form"
            >
              <X size={16} />
            </button>
          </div>

          {done ? (
            <div className="p-5 space-y-3 text-center">
              <CheckCircle2 size={36} className="mx-auto text-[#10b981]" />
              <p className="text-sm font-medium text-[#1a2234]">Thanks — we got it.</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                For urgent account or billing help, email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#10b981] hover:underline">
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full mt-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: ACCENT }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="p-4 space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-slate-600">Type</legend>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "problem", label: "Report a problem" },
                    { value: "feedback", label: "Send feedback" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-medium text-center transition-colors ${
                        category === opt.value
                          ? "border-[#10b981] bg-[rgba(16,185,129,0.08)] text-[#059669]"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="feedback-category"
                        value={opt.value}
                        checked={category === opt.value}
                        onChange={() => setCategory(opt.value)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="block">
                <span className="text-xs font-medium text-slate-600">Message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={8000}
                  required
                  placeholder={
                    category === "problem"
                      ? "What went wrong? What did you expect?"
                      : "What’s on your mind?"
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#1a2234] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#10b981]/30 resize-y"
                />
              </label>

              {!isAuthenticated && (
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">
                    Email <span className="text-slate-400 font-normal">(optional)</span>
                  </span>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="So we can reply"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10b981]/30"
                  />
                </label>
              )}

              {isAuthenticated && user?.email && (
                <p className="text-[11px] text-slate-400">Sending as {user.email}</p>
              )}

              <div>
                <span className="text-xs font-medium text-slate-600">
                  Screenshot <span className="text-slate-400 font-normal">(optional)</span>
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Paperclip size={14} />
                    Attach
                  </button>
                  {screenshotName && (
                    <span className="text-[11px] text-slate-500 truncate flex-1">{screenshotName}</span>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={onFile}
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 truncate" title={pageUrl}>
                Page: {pageUrl || "…"}
              </p>

              {error && (
                <p className="text-xs text-red-600 leading-snug" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: ACCENT }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Submit"
                )}
              </button>

              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                Not live chat — we read these in email. Prefer writing us?{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#10b981] hover:underline">
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg shadow-slate-900/20 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] focus-visible:ring-offset-2"
        style={{ backgroundColor: ACCENT }}
        aria-label={open ? "Close feedback" : "Send feedback or report a problem"}
        aria-expanded={open}
      >
        {open ? <X size={22} strokeWidth={2.25} /> : <MessageSquarePlus size={22} strokeWidth={2} />}
      </button>
    </div>
  );
}
