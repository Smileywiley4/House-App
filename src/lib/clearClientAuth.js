/**
 * Clear device-local auth and handoff state after account deletion or hard sign-out.
 */

const LOCAL_KEYS = ["pp_referral_ref"];

const SESSION_KEYS = [
  "compareProperty",
  "browseMapHandoff",
  "pp_oauth_pending",
  "propertypulse_current_property",
  "browseCompareProperties",
  "browseComparePropertiesBackup",
];

const LOCAL_PREFIXES = ["sb-", "supabase.", "propertypulse_", "pp_", "proppocket_"];

export function clearClientAuthMemory() {
  if (typeof window === "undefined") return;

  try {
    for (const key of LOCAL_KEYS) localStorage.removeItem(key);
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (LOCAL_PREFIXES.some((p) => key.startsWith(p))) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }

  try {
    for (const key of SESSION_KEYS) sessionStorage.removeItem(key);
    const sessionRemove = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (
        SESSION_KEYS.includes(key) ||
        LOCAL_PREFIXES.some((p) => key.startsWith(p)) ||
        key.toLowerCase().includes("supabase") ||
        key.toLowerCase().includes("handoff") ||
        key.toLowerCase().includes("compare")
      ) {
        sessionRemove.push(key);
      }
    }
    [...new Set(sessionRemove)].forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
