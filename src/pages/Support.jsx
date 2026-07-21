import { useState } from 'react';
import LegalPageShell from '@/components/trust/LegalPageShell';
import { Mail, MessageCircle, Clock, HelpCircle } from 'lucide-react';
import { APP_NAME } from '@/core/constants';
import { SUPPORT_EMAIL } from '@/core/companyConfig';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Support() {
  const [subject, setSubject] = useState('General question');
  const [body, setBody] = useState('');

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[${APP_NAME}] ${subject}`)}&body=${encodeURIComponent(body)}`;

  return (
    <LegalPageShell
      title="Help & Support"
      description={`We're here to help you get the most out of ${APP_NAME}.`}
    >
      <div className="not-prose grid sm:grid-cols-3 gap-4 mb-10">
        {[
          { icon: Clock, title: 'Response time', desc: 'We aim to reply within 1–2 business days.' },
          { icon: HelpCircle, title: 'Self-service', desc: 'Use Compare to put homes side by side with your plan’s slot limits.' },
          { icon: MessageCircle, title: 'Account help', desc: 'Billing, login, and subscription questions welcome.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-slate-200 bg-white p-5">
            <Icon size={22} className="text-[#10b981] mb-2" />
            <p className="font-semibold text-[#1a2234] text-sm">{title}</p>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      <h2>Email us</h2>
      <p>
        The fastest way to reach our team:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium">{SUPPORT_EMAIL}</a>
      </p>

      <div className="not-prose my-8 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Topic</span>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10b981]/30"
          >
            <option>General question</option>
            <option>Account / login</option>
            <option>Billing / subscription</option>
            <option>Bug report</option>
            <option>Privacy request</option>
            <option>Partnership / press</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Describe your question or issue..."
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10b981]/30 resize-y"
          />
        </label>
        <a
          href={mailtoHref}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm transition-colors"
        >
          <Mail size={16} />
          Open in email app
        </a>
      </div>

      <h2>Common topics</h2>
      <ul>
        <li>
          <strong>Cancel subscription</strong> — Web: Profile → Billing. iOS: Settings → Apple ID → Subscriptions.
        </li>
        <li>
          <strong>Restore iOS purchase</strong> — Use &quot;Restore purchases&quot; in the mobile app subscription section.
        </li>
        <li>
          <strong>Data deletion</strong> — Email {SUPPORT_EMAIL} from your account email address.
        </li>
      </ul>

      <h2>Resources</h2>
      <ul>
        <li><Link to={createPageUrl('About')}>How Property Pocket works</Link></li>
        <li><Link to={createPageUrl('Pricing')}>Plans &amp; pricing</Link></li>
        <li><Link to={createPageUrl('Privacy')}>Privacy policy</Link></li>
        <li><Link to={createPageUrl('Terms')}>Terms of service</Link></li>
      </ul>
    </LegalPageShell>
  );
}
