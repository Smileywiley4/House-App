import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { api } from "@/api";
import {
  getFullOnboardingQuestions,
  mergeWeights,
  weightsFromFullAnswers,
} from "@/lib/importanceQuiz";

/**
 * Soft full-screen sheet: 5–8 priority questions → user_presets + default_weights.
 * Score side is never set.
 */
export default function ImportanceQuizModal({
  open,
  onClose,
  trigger = "signup",
  projectId = null,
  projectName = null,
  onComplete,
}) {
  const steps = useMemo(() => getFullOnboardingQuestions(), []);
  const [index, setIndex] = useState(0);
  /** @type {Record<string, string>} */
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setAnswers({});
    setError("");
    setSaving(false);
  }, [open, trigger, projectId]);

  if (!open) return null;

  const step = steps[index];
  const total = steps.length;
  const isLast = index >= total - 1;

  const copy = (() => {
    if (trigger === "client") {
      return {
        title: "What matters most in your home search?",
        subtitle:
          "A few quick questions help your realtor score homes for your priorities — not theirs. Skip anytime.",
      };
    }
    if (trigger === "project") {
      return {
        title: "New search, new priorities?",
        subtitle: projectName
          ? `Set importance weights for “${projectName}”. Scores stay unset — this is priorities only.`
          : "Set importance weights for this project. Scores stay unset — priorities only.",
      };
    }
    if (trigger === "retake") {
      return {
        title: "Retake priority quiz",
        subtitle: "Update what matters most. We’ll save a scoring preset you can load on Evaluate.",
      };
    }
    return {
      title: "What matters most?",
      subtitle:
        "Answer a few plain-language questions. We’ll save an Importance preset for Evaluate — property scores stay unset.",
    };
  })();

  const presetName = (() => {
    if (trigger === "project" && projectName) {
      return `${projectName.trim()} priorities`.slice(0, 80);
    }
    if (trigger === "client") return "My client priorities";
    return "My defaults";
  })();

  const pick = (optionId) => {
    if (!step) return;
    setAnswers((prev) => ({ ...prev, [step.categoryId]: optionId }));
  };

  const goNext = () => {
    if (!step || !answers[step.categoryId]) return;
    if (isLast) {
      void finish();
      return;
    }
    setIndex((i) => i + 1);
  };

  const finish = async () => {
    setSaving(true);
    setError("");
    try {
      const quizWeights = weightsFromFullAnswers(answers);
      const weights = mergeWeights(quizWeights);

      const preset = await api.entities.Preset.create({
        name: presetName,
        weights,
        filters: {},
      });

      // Evaluate Importance initializes from default_weights — keep in sync.
      const me = await api.auth.me().catch(() => null);
      const mergedDefaults = { ...(me?.default_weights || {}), ...weights };
      await api.auth.updateMe({ default_weights: mergedDefaults });

      if (projectId && api.projects?.update) {
        await api.projects
          .update(projectId, { scoring_presets: { weights } })
          .catch(() => {});
      }

      onComplete?.({ weights, preset, trigger });
      onClose?.({ dismissed: false, completed: true });
    } catch (e) {
      setError(e?.message || "Could not save preset");
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    onClose?.({ dismissed: true, completed: false });
  };

  const selected = step ? answers[step.categoryId] : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Dismiss"
        onClick={skip}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="priority-quiz-title"
        className="relative w-full sm:max-w-lg max-h-[92vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[#106B49] mb-1">
              <Sparkles size={16} />
              <span className="text-[11px] font-bold uppercase tracking-wide">Priority quiz</span>
            </div>
            <h2 id="priority-quiz-title" className="font-bold text-[#14192E] text-lg leading-snug">
              {copy.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={skip}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-3 shrink-0">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
            <span>
              Question {Math.min(index + 1, total)} of {total}
            </span>
            <span>{Math.round(((index + (selected ? 0.5 : 0)) / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#106B49] rounded-full transition-all duration-300"
              style={{ width: `${((index + (selected ? 1 : 0)) / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step && (
            <>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                  {step.label}
                </p>
                <p className="text-base font-semibold text-[#14192E] leading-snug">
                  {step.question.prompt}
                </p>
              </div>
              <div className="space-y-2">
                {step.question.options.map((opt) => {
                  const active = selected === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => pick(opt.id)}
                      className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition ${
                        active
                          ? "border-[#106B49] bg-[#106B49]/10 text-[#14192E] font-semibold"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {error && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex flex-col gap-2.5 shrink-0">
          <button
            type="button"
            disabled={saving || !selected}
            onClick={goNext}
            className="w-full py-2.5 rounded-xl bg-[#106B49] text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            {isLast ? "Save preset" : "Next"}
          </button>
          <button
            type="button"
            onClick={skip}
            disabled={saving}
            className="mx-auto text-xs font-medium text-slate-600 opacity-45 hover:opacity-80 transition-opacity disabled:pointer-events-none py-1"
          >
            {trigger === "retake" ? "Cancel" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
