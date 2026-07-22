import { Sparkles } from "lucide-react";

/**
 * Soft pre-quiz offer — not the quiz itself.
 * Light backdrop; Skip only dismisses (caller persists the flag).
 */
export default function QuizOfferPrompt({ open, onSkip, onTakeQuiz }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-4 sm:p-6 pointer-events-none">
      <button
        type="button"
        className="absolute inset-0 bg-[#14192E]/25 backdrop-blur-[2px] pointer-events-auto animate-in fade-in duration-200"
        aria-label="Dismiss quiz offer"
        onClick={onSkip}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-offer-title"
        className="pointer-events-auto relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
      >
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background: "linear-gradient(90deg, #106B49 0%, #0C4F37 55%, #E8A33D 100%)",
          }}
          aria-hidden
        />
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2 text-[#106B49] mb-3">
            <img
              src="/logo/propurty-icon.svg"
              alt=""
              className="h-7 w-7 object-contain"
              width={28}
              height={28}
            />
            <span className="text-[11px] font-bold uppercase tracking-wide">Propurty</span>
          </div>
          <div className="flex items-start gap-2.5 mb-2">
            <Sparkles size={18} className="text-[#106B49] shrink-0 mt-0.5" />
            <h2 id="quiz-offer-title" className="font-heading font-bold text-[#14192E] text-lg leading-snug">
              Want a 60-second priority quiz?
            </h2>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed mb-5">
            Tell us what matters in a home — we’ll tune Browse scoring to your priorities. Skip anytime.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onTakeQuiz}
              className="w-full py-2.5 rounded-xl bg-[#106B49] text-white text-sm font-bold hover:bg-[#0C4F37] transition-colors"
            >
              Take quiz
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="mx-auto text-xs font-medium text-slate-600 opacity-45 hover:opacity-80 transition-opacity py-1"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
