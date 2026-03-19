import { X } from "lucide-react";

export default function CategorySlider({ category, onImportanceChange, onScoreChange, onRemove }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-[#1a2234] text-sm">{category.label}</h3>
          {category.custom && (
            <span className="text-[10px] font-semibold text-[#8b5cf6] px-2 py-0.5 rounded-full mt-1 inline-block border border-[#8b5cf6]/30">
              CUSTOM
            </span>
          )}
        </div>
        <button
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
            <span className="font-bold text-[#10b981]">{category.importance}/10</span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="10"
              value={category.importance}
              onChange={(e) => onImportanceChange(category.id, Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #10b981 ${category.importance * 10}%, #e2e8f0 ${category.importance * 10}%)`
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-300 mt-1">
            <span>Not Important</span>
            <span>Very Important</span>
          </div>
        </div>

        {/* Score */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-400 font-medium">Property Score</span>
            <span className="font-bold text-[#1a2234]">{category.score}/10</span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="10"
              value={category.score}
              onChange={(e) => onScoreChange(category.id, Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #1a2234 ${category.score * 10}%, #e2e8f0 ${category.score * 10}%)`
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-300 mt-1">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>
      </div>
    </div>
  );
}