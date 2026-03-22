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
 */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_ADS_CLIENT_ID;
const SLOT_LEADERBOARD = import.meta.env.VITE_GOOGLE_ADS_SLOT_LEADERBOARD || import.meta.env.VITE_GOOGLE_ADS_SLOT_1;
const SLOT_INFEED = import.meta.env.VITE_GOOGLE_ADS_SLOT_INFEED || import.meta.env.VITE_GOOGLE_ADS_SLOT_2;

export function AdSlot({ format = "leaderboard", className = "" }) {
  const { showAds } = usePlan();
  const ref = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!showAds || typeof document === "undefined") return;
    const slot = format === "infeed" ? SLOT_INFEED : SLOT_LEADERBOARD;
    if (!CLIENT_ID || !slot) return;

    if (loaded.current) return;
    loaded.current = true;

    const s = document.createElement("script");
    s.async = true;
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + CLIENT_ID;
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);

    return () => { loaded.current = false; };
  }, [showAds, format]);

  useEffect(() => {
    if (!showAds || !ref.current || !CLIENT_ID) return;
    if (typeof window !== "undefined" && window.adsbygoogle) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {}
    }
  }, [showAds]);

  if (!showAds) return null;

  if (!CLIENT_ID || (!SLOT_LEADERBOARD && !SLOT_INFEED)) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded-xl text-slate-400 text-xs py-8 ${className}`}>
        Ad slot (set VITE_GOOGLE_ADS_CLIENT_ID and VITE_GOOGLE_ADS_SLOT_* in env)
      </div>
    );
  }

  const slotId = format === "infeed" ? SLOT_INFEED : SLOT_LEADERBOARD;
  const isRectangle = format === "rectangle";

  return (
    <div className={className} ref={ref}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", minHeight: isRectangle ? 250 : 90 }}
        data-ad-client={CLIENT_ID}
        data-ad-slot={slotId}
        data-ad-format={format === "rectangle" ? "auto" : format}
        data-full-width-responsive={format !== "rectangle" ? "true" : "false"}
      />
    </div>
  );
}
