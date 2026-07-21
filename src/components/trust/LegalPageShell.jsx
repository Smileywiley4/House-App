import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronLeft } from 'lucide-react';
import { SeoHelmet } from '@/components/SeoHelmet';
import { LEGAL_LAST_UPDATED } from '@/core/companyConfig';

/**
 * Consistent layout for Privacy, Terms, Support, About.
 */
export default function LegalPageShell({ title, description, children, noindex = false }) {
  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <SeoHelmet title={title} description={description} noindex={noindex} />
      <div className="max-w-3xl mx-auto px-6 py-10 md:py-14">
        <Link
          to={createPageUrl('Home')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#106B49] mb-8 transition-colors"
        >
          <ChevronLeft size={16} />
          Back to home
        </Link>
        <header className="mb-10 border-b border-slate-200 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#14192E] mb-3">{title}</h1>
          {description && <p className="text-slate-600 text-lg leading-relaxed">{description}</p>}
          <p className="text-slate-400 text-sm mt-4">Last updated: {LEGAL_LAST_UPDATED}</p>
        </header>
        <article className="prose prose-slate max-w-none prose-headings:text-[#14192E] prose-a:text-[#106B49] prose-a:no-underline hover:prose-a:underline">
          {children}
        </article>
      </div>
    </div>
  );
}
