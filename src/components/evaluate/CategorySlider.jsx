import { X } from "lucide-react";

function SliderLabel({ rated, value, ratedClassName }) {
  if (!rated) {
    return <span className="font-medium text-slate-400">Not yet rated</span>;
  }
  return <span className={`font-bold ${ratedClassName}`}>{value}/10</span>;
}

function RangeTrack({ value, rated, fillColor, onChange, ariaLabel }) {
  const fillPct = rated ? value * 10 : 0;
  return (
    <div className="relative">
      <input
        type="range"
        min="0"
        max="10"
        value={rated ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        className={`w-full h-2 rounded-full appearance-none cursor-pointer ${rated ? "" : "opacity-80"}`}
        style={{
          background: rated
            ? `linear-gradient(to right, ${fillColor} ${fillPct}%, #e2e8f0 ${fillPct}%)`
            : "#e2e8f0",
        }}
      />
    </div>
  );
}

export default function CategorySlider({ category, evidence, onImportanceChange, onScoreChange, onRemove }) {
  const scoreRated = Boolean(category.scoreRated);
  const importanceRated = Boolean(category.importanceRated);
  const scoreSource = category.scoreSource; // 'manual' | 'auto' | null

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[#1a2234] text-sm">{category.label}</h3>
            {scoreRated && scoreSource === "auto" && (
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-md">
                auto-filled
              </span>
            )}
            {scoreRated && scoreSource === "manual" && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                rated
              </span>
            )}
            {category.custom && (
              <span className="text-[10px] font-semibold text-[#8b5cf6] px-2 py-0.5 rounded-full border border-[#8b5cf6]/30">
                CUSTOM
              </span>
            )}
          </div>
          {evidence && <p className="mt-1 text-xs text-slate-500">{evidence}</p>}
        </div>
        <button
          type="button"
          onClick={() => onRemove(category.id)}
          className="w-7 h-7 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-400 flex items-center justify-center transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Importance */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-400 font-medium">Importance to You</span>
            <SliderLabel rated={importanceRated} value={category.importance} ratedClassName="text-[#10b981]" />
          </div>
          <RangeTrack
            value={category.importance}
            rated={importanceRated}
            fillColor="#10b981"
            ariaLabel={`${category.label} importance`}
            onChange={(val) => onImportanceChange(category.id, val)}
          />
          <div className="flex justify-between text-[10px] text-slate-300 mt-1">
            <span>Not Important</span>
            <span>Very Important</span>
          </div>
        </div>

        {/* Score */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-400 font-medium">Property Score</span>
            <SliderLabel rated={scoreRated} value={category.score} ratedClassName="text-[#1a2234]" />
          </div>
          <RangeTrack
            value={category.score}
            rated={scoreRated}
            fillColor="#1a2234"
            ariaLabel={`${category.label} property score`}
            onChange={(val) => onScoreChange(category.id, val)}
          />
          <div className="flex justify-between text-[10px] text-slate-300 mt-1">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>
      </div>
    </div>
  );
}
