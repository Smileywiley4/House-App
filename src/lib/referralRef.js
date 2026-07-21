/** Persist signup referral codes from `?ref=` until claim completes. */
const STORAGE_KEY = "pp_referral_ref";

export function captureReferralFromSearchParams(searchParams) {
  const ref = (searchParams?.get?.("ref") || "").trim();
  if (ref && ref.length >= 4) {
    try {
      localStorage.setItem(STORAGE_KEY, ref.toUpperCase());
    } catch {
      /* ignore */
    }
    return ref.toUpperCase();
  }
  return readStoredReferralCode();
}

export function readStoredReferralCode() {
  try {
    return (localStorage.getItem(STORAGE_KEY) || "").trim().toUpperCase() || null;
  } catch {
    return null;
  }
}

export function clearStoredReferralCode() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** After auth, claim stored/URL referral code (best-effort). */
export async function claimStoredReferral(api) {
  const code = readStoredReferralCode();
  if (!code || !api?.referrals?.claim) return null;
  try {
    const result = await api.referrals.claim(code);
    clearStoredReferralCode();
    return result;
  } catch {
    return null;
  }
}
