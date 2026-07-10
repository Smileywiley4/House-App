/**
 * Light tap haptic for mobile web (Android Chrome, etc.).
 * ~12ms mirrors a "light impact" — similar to native UIImpactFeedbackGenerator(.light).
 * iOS Safari does not support navigator.vibrate; visual :active feedback covers that case.
 */
const TAP_MS = 12;

export function canUseTapHaptic() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (typeof navigator.vibrate !== 'function') return false;
  if (window.matchMedia('(pointer: coarse)').matches === false) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return true;
}

export function triggerTapHaptic() {
  if (!canUseTapHaptic()) return;
  try {
    navigator.vibrate(TAP_MS);
  } catch {
    /* ignore — user gesture or policy may block */
  }
}

/** Elements that receive tap haptic + press feedback */
export const TAP_FEEDBACK_SELECTOR = [
  'button:not(:disabled)',
  '[role="button"]:not([aria-disabled="true"])',
  'a.inline-flex',
  'header nav a',
  'input[type="submit"]:not(:disabled)',
  'input[type="button"]:not(:disabled)',
].join(', ');

export function isTapFeedbackTarget(el) {
  if (!el || !(el instanceof Element)) return false;
  if (el.closest('[data-no-pp-interactive]')) return false;
  if (el.matches('button:disabled, [aria-disabled="true"]')) return false;
  return el.matches(TAP_FEEDBACK_SELECTOR);
}
