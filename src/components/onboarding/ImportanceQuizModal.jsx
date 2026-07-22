import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Lock, MapPin, Sparkles, X } from "lucide-react";
import { api } from "@/api";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import PaywallModal from "@/components/PaywallModal";
import { usePlan } from "@/core/hooks/usePlan";
import { createPageUrl } from "@/utils";
import {
  browseAreaUrl,
  scoreMinsFromImportanceWeights,
  storeBoundaryHandoff,
} from "@/lib/browseHandoff";
import {
  AUTOSCORE_CATEGORY_IDS,
  getCategoryQuiz,
  getDeepFallbackQuestions,
  getFullOnboardingQuestions,
  mergeWeights,
  normalizeDeepAiQuestions,
  weightsFromFullAnswers,
} from "@/lib/importanceQuiz";
import { storeGuestImportanceWeights } from "@/lib/quizPromptStorage";

/**
 * Soft full-screen sheet: simple priority questions first → optional deeper
 * auto-scorable questions (AI when Premium, bank fallback otherwise) →
 * user_presets + default_weights (or localStorage for guests).
 * First-time signup also asks for a search area (city/ZIP/place) — location is NOT
 * stored on the preset; it only hands off to BrowseProperties map + filters.
 * Score side is never set.
 */
export default function ImportanceQuizModal({
  open,
  onClose,
  trigger = "signup",
  projectId = null,
  projectName = null,
  guestMode = false,
  onComplete,
}) {
  const navigate = useNavigate();
  const { canUseAIFeatures } = usePlan();
  const simpleSteps = useMemo(() => getFullOnboardingQuestions(), []);
  /** Location step only on first-time signup/enter onboarding — not Profile retake. */
  const includeLocation = trigger === "signup";

  const [steps, setSteps] = useState(simpleSteps);
  const [index, setIndex] = useState(0);
  /** @type {Record<string, string>} */
  const [answers, setAnswers] = useState({});
  const [locationQuery, setLocationQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepPhase, setDeepPhase] = useState(false);
  const [deepSource, setDeepSource] = useState(null);
  /** @type {{ categoryId: string, question: object }[]} */
  const [supplementalQuestions, setSupplementalQuestions] = useState([]);
  const [error, setError] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = getFullOnboardingQuestions();
    setSteps(base);
    setIndex(0);
    setAnswers({});
    setLocationQuery("");
    setError("");
    setSaving(false);
    setDeepLoading(false);
    setDeepPhase(false);
    setDeepSource(null);
    setSupplementalQuestions([]);
    setShowPaywall(false);
  }, [open, trigger, projectId]);

  if (!open) return null;

  const total = steps.length + (includeLocation ? 1 : 0);
  const isLocationStep = includeLocation && index >= steps.length;
  const step = isLocationStep ? null : steps[index];
  const isLast = index >= total - 1;
  const onLastSimple =
    !deepPhase && !isLocationStep && steps.length > 0 && index === simpleSteps.length - 1;

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
    if (guestMode) {
      return {
        title: "What matters most?",
        subtitle:
          "Answer a few plain-language questions, then pick where to look. We’ll apply your priorities on Browse — sign in later to save them to your account.",
      };
    }
    return {
      title: "What matters most?",
      subtitle:
        "Answer a few plain-language questions, then pick where to look. We’ll save an Importance preset and open the map — property scores stay unset.",
    };
  })();

  const presetName = (() => {
    if (trigger === "project" && projectName) {
      return `${projectName.trim()} priorities`.slice(0, 80);
    }
    if (trigger === "client") return "My client priorities";
    if (deepPhase) return "My deep priorities";
    return "My defaults";
  })();

  const pick = (optionId) => {
    if (!step) return;
    setAnswers((prev) => ({ ...prev, [step.categoryId]: optionId }));
  };

  const canContinue = isLocationStep
    ? Boolean(locationQuery.trim())
    : Boolean(step && answers[step.categoryId]);

  const goNext = () => {
    if (!canContinue) return;
    if (isLast) {
      void finish();
      return;
    }
    setIndex((i) => i + 1);
  };

  const startDeepQuiz = async ({ preferAi = true } = {}) => {
    if (deepLoading || deepPhase) return;
    setDeepLoading(true);
    setError("");
    try {
      const exclude = Object.keys(answers);
      /** @type {ReturnType<typeof normalizeDeepAiQuestions>} */
      let deep = [];
      let source = "bank";

      if (preferAi && canUseAIFeatures && api.integrations?.invokeLLM) {
        try {
          const catalog = AUTOSCORE_CATEGORY_IDS.filter((id) => !exclude.includes(id))
            .map((id) => {
              const bank = getCategoryQuiz(id);
              return `${id}${bank?.label ? ` (${bank.label})` : ""}`;
            })
            .join(", ");
          const raw = await api.integrations.invokeLLM({
            feature: "deep_priority_quiz",
            prompt: `Generate additional home-buyer priority quiz questions.
Only use these category IDs (auto-scorable only): ${catalog || AUTOSCORE_CATEGORY_IDS.join(", ")}.
Do not invent other categories.
Return JSON: {"questions":[{"categoryId":"...","label":"...","prompt":"plain-language question","options":[{"id":"a","label":"...","importance":1-10},...]}]}
Rules: 4–8 questions max; one category each; 2–4 options; importance 1–10; skip categories already answered: ${exclude.join(", ") || "none"}.`,
            response_json_schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      categoryId: { type: "string" },
                      label: { type: "string" },
                      prompt: { type: "string" },
                      options: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            label: { type: "string" },
                            importance: { type: "number" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          });
          const payload = raw?.data ?? raw;
          deep = normalizeDeepAiQuestions(payload?.questions || payload, exclude, 8);
          if (deep.length) source = "ai";
        } catch {
          /* fall through to bank */
        }
      }

      if (!deep.length) {
        deep = getDeepFallbackQuestions(exclude, 8);
        source = "bank";
      }
      if (!deep.length) {
        setError("No more auto-scorable questions to ask.");
        return;
      }

      setSupplementalQuestions((prev) => [...prev, ...deep.filter((d) => d.source === "ai")]);
      const baseLen = steps.length;
      setSteps((prev) => [...prev, ...deep]);
      setIndex(baseLen);
      setDeepPhase(true);
      setDeepSource(source);
    } catch (e) {
      setError(e?.message || "Could not load deeper questions");
    } finally {
      setDeepLoading(false);
    }
  };

  const onGoDeeper = () => {
    // Logged-in free users deepen via bank questions; AI wording is Premium.
    void startDeepQuiz({ preferAi: canUseAIFeatures });
  };

  const finish = async () => {
    setSaving(true);
    setError("");
    try {
      const quizWeights = weightsFromFullAnswers(answers, supplementalQuestions);
      const weightCategoryIds = [
        ...new Set([...simpleSteps.map((s) => s.categoryId), ...Object.keys(quizWeights)]),
      ];
      const weights = mergeWeights(quizWeights, weightCategoryIds);

      let preset = null;

      if (guestMode) {
        storeGuestImportanceWeights(weights);
      } else {
        preset = await api.entities.Preset.create({
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
      }

      const locationLabel = locationQuery.trim();
      let navigatedToBrowse = false;

      if (includeLocation && locationLabel) {
        const score_mins = scoreMinsFromImportanceWeights(weights);
        const browseFilters = Object.keys(score_mins).length ? { score_mins } : {};

        let ring = [];
        let label = locationLabel;
        let lat = null;
        let lng = null;

        if (api.geo?.boundary) {
          try {
            const boundary = await api.geo.boundary(locationLabel);
            if (Array.isArray(boundary?.ring) && boundary.ring.length >= 3) {
              ring = boundary.ring;
            }
            if (boundary?.label) label = boundary.label;
            if (Number.isFinite(Number(boundary?.lat))) lat = Number(boundary.lat);
            if (Number.isFinite(Number(boundary?.lng))) lng = Number(boundary.lng);
          } catch {
            /* Browse can re-resolve via ?area=1&q= */
          }
        }

        storeBoundaryHandoff({
          ring,
          label,
          lat,
          lng,
          filters: browseFilters,
          presetId: preset?.id || null,
          weights,
        });
        navigatedToBrowse = true;
        onComplete?.({
          weights,
          preset,
          trigger,
          location: label,
          navigatedToBrowse: true,
          guestMode,
        });
        onClose?.({ dismissed: false, completed: true });
        navigate(browseAreaUrl({ label }));
        return;
      }

      onComplete?.({ weights, preset, trigger, navigatedToBrowse, guestMode });
      onClose?.({ dismissed: false, completed: true });
    } catch (e) {
      setError(e?.message || (guestMode ? "Could not apply priorities" : "Could not save preset"));
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    onClose?.({ dismissed: true, completed: false });
  };

  const selected = step ? answers[step.categoryId] : null;
  const progressUnits = isLocationStep
    ? steps.length + (locationQuery.trim() ? 1 : 0.5)
    : index + (selected ? 1 : 0);

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
              <span className="text-[11px] font-bold uppercase tracking-wide">
                {deepPhase ? "Deep priority quiz" : "Priority quiz"}
              </span>
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
              {deepPhase && deepSource === "ai" ? " · AI" : deepPhase ? " · deeper" : ""}
            </span>
            <span>{Math.round((progressUnits / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#106B49] rounded-full transition-all duration-300"
              style={{ width: `${(progressUnits / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLocationStep ? (
            <>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                  Where to look
                </p>
                <p className="text-base font-semibold text-[#14192E] leading-snug">
                  Which city, ZIP, or area should we open on the map?
                </p>
                <p className="mt-1.5 text-sm text-slate-500">
                  This sets your browse area only — your Importance preset stays location-agnostic so
                  you can reuse it in other markets.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-center gap-2 text-[#106B49] mb-2">
                  <MapPin size={15} />
                  <span className="text-[11px] font-bold uppercase tracking-wide">Search area</span>
                </div>
                <AddressAutocompleteInput
                  value={locationQuery}
                  onChange={setLocationQuery}
                  onSelect={(address) => setLocationQuery(address)}
                  placeholder="City, ZIP, or neighborhood…"
                  ariaLabel="Search city, ZIP, or place"
                  showKindBadge
                  inputClassName="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-[#14192E] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#106B49]/30 focus:border-[#106B49]"
                />
              </div>
            </>
          ) : step ? (
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
          ) : null}
          {error && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex flex-col gap-2.5 shrink-0">
          <button
            type="button"
            disabled={saving || deepLoading || !canContinue}
            onClick={goNext}
            className="w-full py-2.5 rounded-xl bg-[#106B49] text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            {isLast
              ? includeLocation
                ? guestMode
                  ? "Apply & find homes"
                  : "Save & find homes"
                : guestMode
                  ? "Apply priorities"
                  : "Save preset"
              : "Next"}
          </button>
          {onLastSimple && selected ? (
            <button
              type="button"
              disabled={saving || deepLoading}
              onClick={onGoDeeper}
              className="w-full py-2.5 rounded-xl border border-[#106B49]/40 bg-white text-[#106B49] text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {deepLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              {canUseAIFeatures ? "Go deeper — more in-depth quiz" : "Go deeper"}
            </button>
          ) : null}
          {onLastSimple && !canUseAIFeatures ? (
            <p className="text-[11px] text-center text-slate-500">
              Extra questions cover beds, baths, transit, hospital distance, and other auto-scorable
              priorities.{" "}
              <button
                type="button"
                onClick={() => setShowPaywall(true)}
                className="inline-flex items-center gap-1 text-[#106B49] font-semibold underline-offset-2 hover:underline"
              >
                <Lock size={10} /> Upgrade for AI wording
              </button>
              {" · "}
              <Link
                to={createPageUrl("Pricing")}
                className="text-[#106B49] font-semibold underline-offset-2 hover:underline"
              >
                Pricing
              </Link>
            </p>
          ) : null}
          <button
            type="button"
            onClick={skip}
            disabled={saving || deepLoading}
            className="mx-auto text-xs font-medium text-slate-600 opacity-45 hover:opacity-80 transition-opacity disabled:pointer-events-none py-1"
          >
            {trigger === "retake" ? "Cancel" : "Skip"}
          </button>
        </div>
      </div>
      <PaywallModal
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="AI in-depth priority quiz"
        planId="premium"
      />
    </div>
  );
}
