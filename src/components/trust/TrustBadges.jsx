import { Link } from 'react-router-dom';
import { Lock, Shield, Scale, CreditCard } from 'lucide-react';
import { createPageUrl } from '@/utils';

const BADGES = [
  { icon: Lock, title: 'Secure sign-in', desc: 'Industry-standard authentication via Supabase.' },
  { icon: Shield, title: 'Privacy-first', desc: 'We do not sell your personal data to third parties.' },
  { icon: Scale, title: 'Transparent scoring', desc: 'Your weights drive the score — not a black box.' },
  {
    icon: CreditCard,
    title: 'Cancel anytime',
    desc: 'Manage or cancel subscriptions from your account.',
    href: `${createPageUrl('Profile')}?tab=billing`,
    linkLabel: 'Manage or cancel in Profile → Billing',
  },
];

export default function TrustBadges() {
  return (
    <section className="border-y border-slate-200/80 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {BADGES.map(({ icon: Icon, title, desc, href, linkLabel }) => (
            <div key={title} className="text-center sm:text-left">
              <div className="inline-flex w-10 h-10 rounded-xl bg-[#10b981]/10 items-center justify-center mb-3">
                <Icon size={20} className="text-[#10b981]" aria-hidden />
              </div>
              <p className="font-semibold text-[#1a2234] text-sm mb-1">{title}</p>
              {href ? (
                <p className="text-slate-600 text-xs leading-relaxed">
                  <Link to={href} className="text-[#047857] hover:underline font-medium">
                    {linkLabel || desc}
                  </Link>
                  {' — self-serve, no support ticket required.'}
                </p>
              ) : (
                <p className="text-slate-600 text-xs leading-relaxed">{desc}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
