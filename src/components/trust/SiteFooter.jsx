import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { APP_NAME } from '@/core/constants';
import { COMPANY_TAGLINE, SUPPORT_EMAIL, COMPANY_LEGAL_NAME } from '@/core/companyConfig';

const FOOTER_LINKS = {
  Product: [
    { label: 'Search homes', page: 'Home' },
    { label: 'Compare', page: 'Compare' },
    { label: 'Pricing', page: 'Pricing' },
    { label: 'How it works', page: 'About' },
  ],
  Company: [
    { label: 'About us', page: 'About' },
    { label: 'Contact support', page: 'Support' },
  ],
  Legal: [
    { label: 'Privacy policy', page: 'Privacy' },
    { label: 'Terms of service', page: 'Terms' },
  ],
};

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy border-t border-white/5 text-slate-300">
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <p className="font-bold text-white text-base mb-1">{APP_NAME}</p>
            <p className="text-xs leading-relaxed text-slate-300">{COMPANY_TAGLINE}</p>
          </div>
          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">{section}</p>
              <ul className="space-y-2">
                {links.map(({ label, page }) => (
                  <li key={label}>
                    <Link
                      to={createPageUrl(page)}
                      className="text-sm text-slate-300 hover:text-brand transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-300">
          <p>© {year} {COMPANY_LEGAL_NAME}. {APP_NAME}. All rights reserved.</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="hover:text-brand transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}
