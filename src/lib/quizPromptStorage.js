/**
 * Pre-quiz offer dismissal + guest importance weights (no account required).
 */

export const QUIZ_PROMPT_DISMISSED_KEY = "propurty_quiz_prompt_dismissed";
/** Logged-in users who skipped the offer (without completing onboarding quiz). */
export const QUIZ_PROMPT_DISMISSED_AUTH_KEY = "propurty_quiz_prompt_dismissed_auth";
export const GUEST_IMPORTANCE_WEIGHTS_KEY = "propurty_guest_importance_weights";

export function isQuizPromptDismissed({ authenticated = false } = {}) {
  if (typeof window === "undefined") return true;
  try {
    const key = authenticated ? QUIZ_PROMPT_DISMISSED_AUTH_KEY : QUIZ_PROMPT_DISMISSED_KEY;
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markQuizPromptDismissed({ authenticated = false } = {}) {
  if (typeof window === "undefined") return;
  try {
    const key = authenticated ? QUIZ_PROMPT_DISMISSED_AUTH_KEY : QUIZ_PROMPT_DISMISSED_KEY;
    window.localStorage.setItem(key, "1");
  } catch {
    /* private mode / quota */
  }
}

/**
 * @param {Record<string, number>} weights
 */
export function storeGuestImportanceWeights(weights) {
  if (typeof window === "undefined" || !weights || typeof weights !== "object") return;
  try {
    window.localStorage.setItem(
      GUEST_IMPORTANCE_WEIGHTS_KEY,
      JSON.stringify({ weights, savedAt: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

/** @returns {Record<string, number> | null} */
export function loadGuestImportanceWeights() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_IMPORTANCE_WEIGHTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const weights = parsed?.weights;
    if (!weights || typeof weights !== "object") return null;
    return weights;
  } catch {
    return null;
  }
}
