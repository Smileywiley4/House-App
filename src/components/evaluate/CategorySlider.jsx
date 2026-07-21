import { X } from "lucide-react";
import CategoryImportanceMiniQuiz from "@/components/onboarding/CategoryImportanceMiniQuiz";

function SliderLabel({ rated, value, ratedClassName }) {
  if (!rated) {
    return <span className="font-medium text-slate-600">Not yet rated</span>;
  }
  return <span className={`font-bold ${ratedClassName}`}>{value}/10</span>;
}

function RangeTrack({ value, rated, fillColor, onChange, ariaLabel }) {
  const fillPct = rated ? value * 10 : 0;
  const displayValue = rated ? value : 0;
  return (
    <div className="relative">
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={displayValue}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={displayValue}
        aria-valuetext={rated ? `${displayValue} out of 10` : "Not yet rated"}
        className={`w-full h-2 rounded-full appearance-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0C4F37] focus-visible:ring-offset-2 ${rated ? "" : "opacity-80"}`}
        style={{
          background: rated
            ? `linear-gradient(to right, ${fillColor} ${fillPct}%, #e2e8f0 ${fillPct}%)`
            : "#e2e8f0",
        }}
      />
    </div>
  );
}

export default function CategorySlider({
  category,
  evidence,
  onImportanceChange,
  onScoreChange,
  onRemove,
  showImportanceHelp = false,
}) {
  const scoreRated = Boolean(category.scoreRated);
  const importanceRated = Boolean(category.importanceRated);
  const scoreSource = category.scoreSource;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-[var(--motion-duration)] ease-[var(--motion-ease)]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[#14192E] text-sm">{category.label}</h3>
            {scoreRated && scoreSource === "auto" && (
              <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-md">
                auto-filled
              </span>
            )}
            {scoreRated && scoreSource === "manual" && (
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                rated
              </span>
            )}
            {category.custom && (
              <span className="text-[10px] font-semibold text-[#6d28d9] px-2 py-0.5 rounded-full border border-[#8b5cf6]/30">
                CUSTOM
              </span>
            )}
          </div>
          {evidence && <p className="mt-1 text-xs text-slate-600">{evidence}</p>}
        </div>
        <button
          type="button"
          onClick={() => onRemove(category.id)}
          aria-label={`Remove ${category.label} category`}
          className="w-7 h-7 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0C4F37] focus-visible:ring-offset-2"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-600 font-medium">Importance to You</span>
            <SliderLabel rated={importanceRated} value={category.importance} ratedClassName="text-[#0C4F37]" />
          </div>
          <RangeTrack
            value={category.importance}
            rated={importanceRated}
            fillColor="#0C4F37"
            ariaLabel={`${category.label} importance, ${importanceRated ? `${category.importance} out of 10` : "not yet rated"}`}
            onChange={(val) => onImportanceChange(category.id, val)}
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>Not Important</span>
            <span>Very Important</span>
          </div>
          {showImportanceHelp && (
            <div className="mt-2">
              <CategoryImportanceMiniQuiz
                categoryId={category.id}
                categoryLabel={category.label}
                onApplyImportance={(val) => onImportanceChange(category.id, val)}
              />
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-600 font-medium">Property Score</span>
            <SliderLabel rated={scoreRated} value={category.score} ratedClassName="text-[#14192E]" />
          </div>
          <RangeTrack
            value={category.score}
            rated={scoreRated}
            fillColor="#14192E"
            ariaLabel={`${category.label} property score, ${scoreRated ? `${category.score} out of 10` : "not yet rated"}`}
            onChange={(val) => onScoreChange(category.id, val)}
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>
      </div>
    </div>
  );
}
