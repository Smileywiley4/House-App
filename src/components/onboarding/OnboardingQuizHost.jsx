import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api";
import ImportanceQuizModal from "@/components/onboarding/ImportanceQuizModal";
import { PRIORITY_QUIZ_EVENT } from "@/lib/importanceQuiz";

/**
 * Global host for one-time (dismissible) priority quiz triggers.
 * Guests never see this. Skip / complete both clear the relevant profile flag.
 */
export default function OnboardingQuizHost() {
  const { user, isAuthenticated, isLoadingAuth, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState("signup");
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState(null);

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
      if (!isAuthenticated) return;
      const t = detail.trigger || "signup";
      const force = Boolean(detail.force) || t === "retake";

      if (t === "signup" && !force && user?.has_seen_onboarding_quiz) return;
      if (t === "client" && !force && user?.has_seen_client_priority_quiz) return;

      setTrigger(t);
      setProjectId(detail.projectId || null);
      setProjectName(detail.projectName || null);
      setOpen(true);
    },
    [isAuthenticated, user?.has_seen_onboarding_quiz, user?.has_seen_client_priority_quiz]
  );

  // After signup / first login — once.
  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !user) return;
    if (user.has_seen_onboarding_quiz) return;
    // Small delay so first paint isn't blocked.
    const t = window.setTimeout(() => {
      openQuiz({ trigger: "signup" });
    }, 900);
    return () => window.clearTimeout(t);
  }, [
    isLoadingAuth,
    isAuthenticated,
    user?.id,
    user?.has_seen_onboarding_quiz,
    openQuiz,
  ]);

  // Project create / client accept / Profile retake.
  useEffect(() => {
    const handler = (event) => {
      openQuiz(event?.detail || {});
    };
    window.addEventListener(PRIORITY_QUIZ_EVENT, handler);
    return () => window.removeEventListener(PRIORITY_QUIZ_EVENT, handler);
  }, [openQuiz]);

  const handleClose = async (result = {}) => {
    setOpen(false);
    const dismissedOrDone = result?.dismissed || result?.completed;
    if (!dismissedOrDone) return;

    if (trigger === "signup" || trigger === "retake") {
      await markFlag("has_seen_onboarding_quiz");
    }
    if (trigger === "client") {
      await markFlag("has_seen_client_priority_quiz");
    }
    // Project trigger is session-scoped (no persistent nag flag).
  };

  if (!isAuthenticated) return null;

  return (
    <ImportanceQuizModal
      open={open}
      trigger={trigger}
      projectId={projectId}
      projectName={projectName}
      onClose={handleClose}
      onComplete={() => {
        /* flags cleared in onClose */
      }}
    />
  );
}
