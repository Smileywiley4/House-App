import { useEffect, useRef } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();

/** True when a CAPTCHA site key is configured for this build. */
export function isCaptchaConfigured() {
  return Boolean(TURNSTILE_SITE_KEY);
}

/**
 * Cloudflare Turnstile widget for auth forms.
 * Supabase verifies the token server-side when CAPTCHA protection is enabled.
 */
export default function CaptchaField({
  onToken,
  resetKey = 0,
  className = "",
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!resetKey) return;
    onToken("");
    try {
      ref.current?.reset?.();
    } catch {
      /* widget may not be mounted yet */
    }
  }, [resetKey, onToken]);

  if (!TURNSTILE_SITE_KEY) {
    if (import.meta.env.PROD) {
      return (
        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Bot protection is not configured for this site yet. Account creation is temporarily unavailable.
        </p>
      );
    }
    return (
      <p className="text-[11px] text-slate-400">
        Dev note: set <code className="font-mono">VITE_TURNSTILE_SITE_KEY</code> to enable CAPTCHA.
      </p>
    );
  }

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold text-slate-500">Verify you&apos;re human</p>
      <Turnstile
        ref={ref}
        siteKey={TURNSTILE_SITE_KEY}
        options={{ theme: "light", size: "flexible" }}
        onSuccess={(token) => onToken(token || "")}
        onExpire={() => onToken("")}
        onError={() => onToken("")}
        onTimeout={() => onToken("")}
      />
    </div>
  );
}
