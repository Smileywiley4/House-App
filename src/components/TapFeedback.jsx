import { useEffect } from 'react';
import { isTapFeedbackTarget, TAP_FEEDBACK_SELECTOR, triggerTapHaptic } from '@/lib/tapHaptics';

/**
 * Document-level listener: one short vibration on primary control taps (mobile only).
 * Keeps haptics centralized so individual buttons stay unchanged.
 */
export default function TapFeedback() {
  useEffect(() => {
    const onPointerUp = (e) => {
      if (e.pointerType === 'mouse') return;
      const target =
        e.target instanceof Element ? e.target.closest(TAP_FEEDBACK_SELECTOR) : null;
      if (!isTapFeedbackTarget(target)) return;
      triggerTapHaptic();
    };

    document.addEventListener('pointerup', onPointerUp, { passive: true });
    return () => document.removeEventListener('pointerup', onPointerUp);
  }, []);

  return null;
}
