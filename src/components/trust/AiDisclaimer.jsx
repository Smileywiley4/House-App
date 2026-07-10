import { Info } from 'lucide-react';
import { AI_DISCLAIMER } from '@/core/companyConfig';

export default function AiDisclaimer({ className = '' }) {
  return (
    <div
      className={`flex gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-950 leading-relaxed ${className}`}
      role="note"
    >
      <Info size={16} className="shrink-0 mt-0.5 text-amber-700" aria-hidden />
      <p>{AI_DISCLAIMER}</p>
    </div>
  );
}
