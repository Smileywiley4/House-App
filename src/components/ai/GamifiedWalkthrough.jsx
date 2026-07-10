import { useState } from "react";
import { Heart, ThumbsUp, Minus, ThumbsDown, X, ChevronRight, Sparkles } from "lucide-react";
import { api } from "@/api";
import AiDisclaimer from "@/components/trust/AiDisclaimer";

const RESPONSES = [
  { id: "love", label: "Love it", icon: Heart, color: "text-rose-500", bg: "bg-rose-50 border-rose-200 hover:bg-rose-100" },
  { id: "like", label: "Like it", icon: ThumbsUp, color: "text-[#10b981]", bg: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100" },
  { id: "neutral", label: "Neutral", icon: Minus, color: "text-slate-500", bg: "bg-slate-50 border-slate-200 hover:bg-slate-100" },
  { id: "dislike", label: "Not for me", icon: ThumbsDown, color: "text-amber-600", bg: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
  { id: "hate", label: "Dealbreaker", icon: X, color: "text-red-500", bg: "bg-red-50 border-red-200 hover:bg-red-100" },
];

/**
 * Gamified property walk-through — swipe-style questions that feed preference learning (EMA).
 */
export default function GamifiedWalkthrough({ propertyAddress, assignmentId, onComplete }) {
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [learnedHint, setLearnedHint] = useState(null);

  const start = async () => {
    if (!api.preferences?.startQuestionnaire) {
      setError("Preference learning requires the Python backend.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const data = await api.preferences.startQuestionnaire({
        property_address: propertyAddress,
        assignment_id: assignmentId || undefined,
      });
      setSessionId(data.session_id);
      setQuestions(data.questions || []);
      setIndex(0);
    } catch (e) {
      setError(e?.message || "Could not start walk-through.");
    } finally {
      setStarting(false);
    }
  };

  const answer = async (responseValue) => {
    const q = questions[index];
    if (!q || !sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.preferences.respondQuestionnaire({
        session_id: sessionId,
        category_id: q.category_id,
        category_label: q.category_label,
        question_text: q.question_text,
        response_value: responseValue,
      });
      if (result.updated_preference) {
        setLearnedHint(`${q.category_label}: learning your taste (${result.updated_preference.weight}/10 importance)`);
      }
      if (result.completed) {
        setDone(true);
        onComplete?.();
      } else {
        setIndex((i) => i + 1);
      }
    } catch (e) {
      setError(e?.message || "Could not save response.");
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="rounded-2xl border border-[#10b981]/20 bg-white p-6 text-center">
        <Sparkles className="mx-auto mb-3 text-[#10b981]" size={28} />
        <h3 className="font-bold text-[#1a2234] mb-2">Gamified walk-through</h3>
        <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
          Quick tap-through while you tour. We learn what matters to you and refine suggestions over time.
        </p>
        <AiDisclaimer className="mb-4 text-left max-w-md mx-auto" />
        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm disabled:opacity-60"
        >
          {starting ? "Starting…" : "Start tour questionnaire"}
        </button>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[#10b981]/30 bg-[#10b981]/5 p-8 text-center">
        <p className="text-[#10b981] font-bold text-lg mb-2">Tour complete</p>
        <p className="text-sm text-slate-600">
          Your preferences were updated. Check <strong>For You</strong> on your profile for insights you might not have noticed.
        </p>
      </div>
    );
  }

  const q = questions[index];
  const progress = questions.length ? Math.round(((index) / questions.length) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
      <div className="h-1.5 bg-slate-100">
        <div className="h-full bg-[#10b981] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
          Question {index + 1} of {questions.length}
        </p>
        <p className="text-lg font-semibold text-[#1a2234] mb-1">{q?.category_label}</p>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">{q?.question_text}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {RESPONSES.map(({ id, label, icon: Icon, color, bg }) => (
            <button
              key={id}
              type="button"
              disabled={loading}
              onClick={() => answer(id)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition ${bg} disabled:opacity-50`}
            >
              <Icon size={20} className={color} />
              {label}
            </button>
          ))}
        </div>
        {learnedHint && (
          <p className="mt-4 text-xs text-[#10b981] flex items-center gap-1">
            <ChevronRight size={12} /> {learnedHint}
          </p>
        )}
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  );
}
