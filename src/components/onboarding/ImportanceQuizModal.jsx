import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MapPin, Sparkles, X } from "lucide-react";
import { api } from "@/api";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import {
  browseAreaUrl,
  scoreMinsFromImportanceWeights,
  storeBoundaryHandoff,
} from "@/lib/browseHandoff";
import {
  getFullOnboardingQuestions,
  mergeWeights,
  weightsFromFullAnswers,
} from "@/lib/importanceQuiz";

/**
 * Soft full-screen sheet: 5–8 priority questions → user_presets + default_weights.
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
  onComplete,
}) {
  const navigate = useNavigate();
  const importanceSteps = useMemo(() => getFullOnboardingQuestions(), []);
  /** Location step only on first-time signup/enter onboarding — not Profile retake. */
  const includeLocation = trigger === "signup";
  const total = importanceSteps.length + (includeLocation ? 1 : 0);

  const [index, setIndex] = useState(0);
  /** @type {Record<string, string>} */
  const [answers, setAnswers] = useState({});
  const [locationQuery, setLocationQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setAnswers({});
    setLocationQuery("");
    setError("");
    setSaving(false);
  }, [open, trigger, projectId]);

  if (!open) return null;

  const isLocationStep = includeLocation && index >= importanceSteps.length;
  const step = isLocationStep ? null : importanceSteps[index];
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
        "Answer a few plain-language questions, then pick where to look. We’ll save an Importance preset and open the map — property scores stay unset.",
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
        });
        onClose?.({ dismissed: false, completed: true });
        navigate(browseAreaUrl({ label }));
        return;
      }

      onComplete?.({ weights, preset, trigger, navigatedToBrowse });
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
  const progressUnits = isLocationStep
    ? importanceSteps.length + (locationQuery.trim() ? 1 : 0.5)
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
                  inputClassName="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm"
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
            disabled={saving || !canContinue}
            onClick={goNext}
            className="w-full py-2.5 rounded-xl bg-[#106B49] text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            {isLast
              ? includeLocation
                ? "Save & find homes"
                : "Save preset"
              : "Next"}
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
