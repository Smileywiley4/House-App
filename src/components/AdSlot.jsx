import { useEffect, useRef } from "react";
import { usePlan } from "@/core/hooks/usePlan";

/**
 * Google AdSense **display** placeholders (publisher monetization).
 *
 * - **VITE_GOOGLE_ADS_CLIENT_ID** = AdSense publisher id **`ca-pub-XXXXXXXX`** (Ads → Overview in AdSense).
 * - **VITE_GOOGLE_ADS_SLOT_*** = numeric **ad unit** slot IDs (Ads → By ad unit).
 *
 * Server-side **AdSense Management API** (reports, accounts) uses OAuth in `backend/.env` — same API as Google’s
 * official samples: https://github.com/googleads/googleads-adsense-examples/tree/main/v2/python
 * One-time token: `python scripts/adsense_oauth_to_env.py` → `backend/scripts/README_ADSENSE.md`
 *
 * Renders for **free** users only (`usePlan().showAds`). Premium/Realtor see nothing.
 * React Native: use e.g. react-native-google-mobile-ads + same showAds logic.
 *
 * **Local demo:** With no `VITE_GOOGLE_ADS_*` set, `npm run dev` uses Google’s sample `ca-pub` + slot (test ads).
 * Opt out: `VITE_GOOGLE_ADS_DEMO=false`. Production: set your real AdSense IDs.
 */
/** Google sample publisher + slot — testing only. @see https://developers.google.com/admob/unity/test-ads */
const GOOGLE_SAMPLE_ADSENSE_CLIENT = "ca-pub-3940256099942544";
const GOOGLE_SAMPLE_ADSENSE_SLOT = "6300978111";

/** Normalize publisher id for the script URL and data-ad-client */
function normalizeClientId(id) {
  const s = (id || "").trim();
  if (!s) return "";
  if (s.startsWith("ca-pub-")) return s;
  if (/^\d+$/.test(s)) return `ca-pub-${s}`;
  return s;
}

const CLIENT_ID_RAW = import.meta.env.VITE_GOOGLE_ADS_CLIENT_ID;
const SLOT_LEADERBOARD_ENV =
  import.meta.env.VITE_GOOGLE_ADS_SLOT_LEADERBOARD || import.meta.env.VITE_GOOGLE_ADS_SLOT_1;
const SLOT_INFEED_ENV = import.meta.env.VITE_GOOGLE_ADS_SLOT_INFEED || import.meta.env.VITE_GOOGLE_ADS_SLOT_2;
const SLOT_RECTANGLE_ENV = import.meta.env.VITE_GOOGLE_ADS_SLOT_RECTANGLE;

const ENV_CLIENT = normalizeClientId(CLIENT_ID_RAW);
const ENV_HAS_ANY_SLOT = Boolean(SLOT_LEADERBOARD_ENV || SLOT_INFEED_ENV || SLOT_RECTANGLE_ENV);

/** Dev default: use sample IDs when you have not set your own (opt out with VITE_GOOGLE_ADS_DEMO=false). */
const DEMO_ADS_ACTIVE =
  (import.meta.env.VITE_GOOGLE_ADS_DEMO === "true" ||
    (import.meta.env.DEV && import.meta.env.VITE_GOOGLE_ADS_DEMO !== "false")) &&
  !ENV_CLIENT &&
  !ENV_HAS_ANY_SLOT;

const SLOT_LEADERBOARD = SLOT_LEADERBOARD_ENV || (DEMO_ADS_ACTIVE ? GOOGLE_SAMPLE_ADSENSE_SLOT : "");
const SLOT_INFEED = SLOT_INFEED_ENV || (DEMO_ADS_ACTIVE ? GOOGLE_SAMPLE_ADSENSE_SLOT : "");
const SLOT_RECTANGLE = SLOT_RECTANGLE_ENV || SLOT_LEADERBOARD || SLOT_INFEED;
/** At least one ad unit id configured (rectangle-only is valid). */
const HAS_ANY_SLOT = Boolean(SLOT_LEADERBOARD || SLOT_INFEED || SLOT_RECTANGLE_ENV);

const CLIENT_ID = ENV_CLIENT || (DEMO_ADS_ACTIVE ? GOOGLE_SAMPLE_ADSENSE_CLIENT : "");

/** Load `adsbygoogle.js` once per page (multiple `<AdSlot />` must not inject duplicate scripts). */
let adsenseScriptPromise = null;

function ensureAdsenseScript(clientId) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }
  if (!clientId) return Promise.reject(new Error("Missing VITE_GOOGLE_ADS_CLIENT_ID"));

  if (adsenseScriptPromise) return adsenseScriptPromise;

  adsenseScriptPromise = new Promise((resolve, reject) => {
    const existing = Array.from(document.querySelectorAll("script[src]")).find((el) =>
      el.src.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")
    );
    if (existing) {
      if (window.adsbygoogle) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("AdSense script load error")), { once: true });
      return;
    }

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => {
      adsenseScriptPromise = null;
      reject(new Error("AdSense script failed to load"));
    };
    document.head.appendChild(s);
  });

  return adsenseScriptPromise;
}

function slotForFormat(format) {
  if (format === "infeed") return SLOT_INFEED || SLOT_LEADERBOARD;
  if (format === "rectangle") return SLOT_RECTANGLE;
  return SLOT_LEADERBOARD || SLOT_INFEED;
}

export function AdSlot({ format = "leaderboard", className = "" }) {
  const { showAds } = usePlan();
  const insRef = useRef(null);

  useEffect(() => {
    if (!showAds || !CLIENT_ID) return;
    const slotId = slotForFormat(format);

    let cancelled = false;

    ensureAdsenseScript(CLIENT_ID)
      .then(() => {
        if (cancelled) return;
        if (!slotId) return;
        const el = insRef.current;
        if (!el || el.dataset.adsensePushed === "1") return;
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          el.dataset.adsensePushed = "1";
        } catch {
          // ignore; blank slot is better than crashing the page
        }
      })
      .catch(() => {
        // Script blocked / offline — placeholder stays
      });

    return () => {
      cancelled = true;
    };
  }, [showAds, format]);

  if (!showAds) return null;

  if (!CLIENT_ID || !HAS_ANY_SLOT) {
    if (import.meta.env.PROD) return null;
    const hint =
      ENV_CLIENT && !ENV_HAS_ANY_SLOT
        ? "Set VITE_GOOGLE_ADS_SLOT_LEADERBOARD (and/or INFEED / RECTANGLE) in .env.local"
        : !ENV_CLIENT && ENV_HAS_ANY_SLOT
          ? "Set VITE_GOOGLE_ADS_CLIENT_ID=ca-pub-… in .env.local"
          : "Set VITE_GOOGLE_ADS_CLIENT_ID and VITE_GOOGLE_ADS_SLOT_* in .env.local (or run npm run dev with no vars for Google sample test ads)";
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded-xl text-slate-400 text-xs py-8 px-4 text-center ${className}`}>
        {hint}
      </div>
    );
  }

  const slotId = slotForFormat(format);
  if (!slotId) {
    if (import.meta.env.PROD) return null;
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded-xl text-slate-400 text-xs py-8 ${className}`}>
        Ad slot (missing slot for format &quot;{format}&quot;)
      </div>
    );
  }

  const isRectangle = format === "rectangle";
  /** Google AdSense accepts auto|horizontal|vertical|rectangle|fluid — not arbitrary names like "leaderboard". */
  const adFormat =
    format === "rectangle" ? "auto" : format === "infeed" ? "fluid" : "horizontal";

  return (
    <div className={className} aria-label="Advertisement">
      <p className="mb-1 text-center text-[9px] font-medium uppercase tracking-[0.18em] text-slate-400">
        Advertisement
      </p>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", minHeight: isRectangle ? 250 : 90 }}
        data-ad-client={CLIENT_ID}
        data-ad-slot={slotId}
        data-ad-format={adFormat}
        data-full-width-responsive={format !== "rectangle" ? "true" : "false"}
      />
    </div>
  );
}
