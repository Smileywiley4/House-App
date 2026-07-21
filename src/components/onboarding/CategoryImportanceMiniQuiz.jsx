import { useEffect, useMemo, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import {
  getCategoryQuiz,
  getMiniQuizQuestions,
  importanceFromAnswers,
} from "@/lib/importanceQuiz";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Per-category mini-quiz (2–3 Qs) → sets only that Importance slider.
 * Logged-in Evaluate only; guests never see the trigger.
 */
export default function CategoryImportanceMiniQuiz({
  categoryId,
  categoryLabel,
  onApplyImportance,
}) {
  const bank = useMemo(() => getCategoryQuiz(categoryId), [categoryId]);
  const questions = useMemo(() => getMiniQuizQuestions(categoryId, 3), [categoryId]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  /** @type {string[]} */
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setPicked([]);
    }
  }, [open]);

  if (!bank || questions.length < 2) return null;

  const q = questions[index];
  const isLast = index >= questions.length - 1;
  const label = categoryLabel || bank.label;

  const choose = (optionId) => {
    const nextPicked = [...picked];
    nextPicked[index] = optionId;
    setPicked(nextPicked);

    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }

    const importance = importanceFromAnswers(categoryId, nextPicked.filter(Boolean));
    if (importance != null) {
      onApplyImportance?.(importance);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-[#059669] transition-colors"
          title="Not sure how much this matters?"
        >
          <HelpCircle size={12} className="shrink-0" />
          <span className="underline decoration-dotted underline-offset-2">
            Not sure how much this matters?
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[min(100vw-2rem,22rem)] p-0 rounded-xl border-slate-200 shadow-lg"
      >
        <div className="flex items-start justify-between gap-2 px-3.5 py-3 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Quick check · {label}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {questions.length} short questions · sets Importance only
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-3.5 py-3 space-y-3">
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= index ? "bg-[#10b981]" : "bg-slate-100"}`}
              />
            ))}
          </div>
          <p className="text-sm font-semibold text-[#1a2234] leading-snug">{q.prompt}</p>
          <div className="space-y-1.5">
            {q.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => choose(opt.id)}
                className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:border-[#10b981]/50 hover:bg-[#10b981]/5 transition"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
