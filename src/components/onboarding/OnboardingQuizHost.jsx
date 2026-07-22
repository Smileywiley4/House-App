import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api";
import ImportanceQuizModal from "@/components/onboarding/ImportanceQuizModal";
import QuizOfferPrompt from "@/components/onboarding/QuizOfferPrompt";
import { PRIORITY_QUIZ_EVENT } from "@/lib/importanceQuiz";
import {
  isQuizPromptDismissed,
  markQuizPromptDismissed,
} from "@/lib/quizPromptStorage";

/** Auth / legal pages — don't interrupt. */
const NO_OFFER_PATHS = [
  "/login",
  "/signup",
  "/resetpassword",
  "/privacy",
  "/terms",
  "/support",
];

/**
 * Global host for priority quiz: soft pre-quiz offer for guests + first-time
 * logged-in users, then the full ImportanceQuizModal (guests allowed).
 */
export default function OnboardingQuizHost() {
  const { user, isAuthenticated, isLoadingAuth, refreshUser } = useAuth();
  const location = useLocation();
  const [offerOpen, setOfferOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState("signup");
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState(null);
  const [guestMode, setGuestMode] = useState(false);

  const pathNorm = (location.pathname || "").replace(/\/+$/, "").toLowerCase() || "/";
  const suppressOffer = NO_OFFER_PATHS.some(
    (p) => pathNorm === p || pathNorm.endsWith(p)
  );

  const markFlag = useCallback(
    async (flag) => {
      if (!flag || !isAuthenticated) return;
      try {
        await api.auth.updateMe({ [flag]: true });
        await refreshUser?.();
      } catch {
        /* best-effort — don't block UX */
      }
    },
    [isAuthenticated, refreshUser]
  );

  const openQuiz = useCallback(
    (detail = {}) => {
      const t = detail.trigger || "signup";
      const force = Boolean(detail.force) || t === "retake";
      const asGuest = !isAuthenticated;

      // Guests: only signup-style (or forced) from the offer / event.
      if (asGuest) {
        if (!force && t !== "signup") return;
        setGuestMode(true);
        setTrigger("signup");
        setProjectId(null);
        setProjectName(null);
        setOfferOpen(false);
        setOpen(true);
        return;
      }

      if (t === "signup" && !force && user?.has_seen_onboarding_quiz) return;
      if (t === "client" && !force && user?.has_seen_client_priority_quiz) return;

      setGuestMode(false);
      setTrigger(t);
      setProjectId(detail.projectId || null);
      setProjectName(detail.projectName || null);
      setOfferOpen(false);
      setOpen(true);
    },
    [isAuthenticated, user?.has_seen_onboarding_quiz, user?.has_seen_client_priority_quiz]
  );

  // Soft offer: guests + first-time logged-in (not yet dismissed / completed).
  useEffect(() => {
    if (isLoadingAuth || suppressOffer || open) return;
    if (isAuthenticated) {
      if (!user) return;
      if (user.has_seen_onboarding_quiz) return;
      if (isQuizPromptDismissed({ authenticated: true })) return;
    } else if (isQuizPromptDismissed({ authenticated: false })) {
      return;
    }

    const t = window.setTimeout(() => {
      if (isAuthenticated) {
        if (isQuizPromptDismissed({ authenticated: true })) return;
      } else if (isQuizPromptDismissed({ authenticated: false })) {
        return;
      }
      setOfferOpen(true);
    }, 600);
    return () => window.clearTimeout(t);
  }, [
    isLoadingAuth,
    isAuthenticated,
    user?.id,
    user?.has_seen_onboarding_quiz,
    suppressOffer,
    open,
    pathNorm,
  ]);

  // Project create / client accept / Profile retake.
  useEffect(() => {
    const handler = (event) => {
      openQuiz(event?.detail || {});
    };
    window.addEventListener(PRIORITY_QUIZ_EVENT, handler);
    return () => window.removeEventListener(PRIORITY_QUIZ_EVENT, handler);
  }, [openQuiz]);

  const handleSkipOffer = () => {
    markQuizPromptDismissed({ authenticated: isAuthenticated });
    setOfferOpen(false);
  };

  const handleTakeQuiz = () => {
    markQuizPromptDismissed({ authenticated: isAuthenticated });
    openQuiz({ trigger: "signup", force: true });
  };

  const handleClose = async (result = {}) => {
    setOpen(false);
    const dismissedOrDone = result?.dismissed || result?.completed;
    if (!dismissedOrDone) return;

    markQuizPromptDismissed({ authenticated: isAuthenticated });

    if (guestMode) return;

    if (trigger === "signup" || trigger === "retake") {
      await markFlag("has_seen_onboarding_quiz");
    }
    if (trigger === "client") {
      await markFlag("has_seen_client_priority_quiz");
    }
  };

  return (
    <>
      <QuizOfferPrompt
        open={offerOpen && !open}
        onSkip={handleSkipOffer}
        onTakeQuiz={handleTakeQuiz}
      />
      <ImportanceQuizModal
        open={open}
        trigger={trigger}
        projectId={projectId}
        projectName={projectName}
        guestMode={guestMode}
        onClose={handleClose}
        onComplete={() => {
          /* flags cleared in onClose */
        }}
      />
    </>
  );
}
