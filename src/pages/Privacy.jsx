import LegalPageShell from '@/components/trust/LegalPageShell';
import { APP_NAME } from '@/core/constants';
import { SUPPORT_EMAIL, PRODUCT_DISCLAIMER } from '@/core/companyConfig';

export default function Privacy() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      description={`How ${APP_NAME} collects, uses, and protects your information.`}
    >
      <p>{PRODUCT_DISCLAIMER}</p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account data</strong> — Email address, name, optional phone number, and authentication identifiers when you sign up or sign in.</li>
        <li><strong>Marketing preferences</strong> — If you opt in at signup or in your profile, we record that choice and when you opted in.</li>
        <li><strong>Property data</strong> — Addresses you search, scores, comparisons, saved properties, and visit notes you create.</li>
        <li><strong>Mobile content</strong> — Photos and notes you capture during property visits, if you use our mobile app.</li>
        <li><strong>Location</strong> — Approximate location when you enable map features (with your device permission).</li>
        <li><strong>Contacts</strong> — Only when you explicitly use invite features; we do not upload your full contact book without action.</li>
        <li><strong>Payment data</strong> — Processed by Stripe (web) or Apple (iOS). We receive subscription status, not full card numbers.</li>
        <li><strong>Usage &amp; diagnostics</strong> — Basic logs and optional device snapshots if you opt in, to improve reliability.</li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>Provide search, scoring, comparison, and account features</li>
        <li>Process subscriptions and restore purchases</li>
        <li>Send service-related communications (e.g. account or billing notices)</li>
        <li>Send product updates, new features, and promotions when you have opted in to marketing communications</li>
        <li>Improve product quality, security, and support</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>We do <strong>not</strong> sell your personal information to data brokers or advertisers.</li>
      </ul>

      <h2>Advertising and privacy choices</h2>
      <p>
        Guest visitors and free-account users may see advertising provided by Google AdSense. Google and its
        advertising partners may use cookies, device identifiers, IP-derived location, page context, and interaction
        data to deliver, measure, limit, and—where permitted by your choices—personalize ads. Paid plans do not load
        our on-page advertising placements.
      </p>
      <p>
        Where required, we use a Google-certified consent message so you can accept, reject, or manage advertising
        choices. You may revisit those choices using the privacy controls presented on the site. Learn more about{' '}
        <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer">
          how Google uses information for advertising
        </a>.
      </p>

      <h2>Marketing communications</h2>
      <p>
        If you opt in at signup, we may send you product updates, new features, and promotional messages by email.
        You can opt out anytime by contacting us. We store opted-in contacts in an internal Google Sheet (Google
        Workspace) used as our CRM processor for marketing lists — not for sale to third parties.
      </p>

      <h2>Service providers</h2>
      <p>We use trusted processors to operate the service, including:</p>
      <ul>
        <li>Supabase (authentication and database)</li>
        <li>Stripe (web payments)</li>
        <li>Apple / RevenueCat (iOS in-app purchases)</li>
        <li>Cloud hosting (e.g. Vercel, Railway or similar for API hosting)</li>
        <li>Google AdSense (optional display ads for free-tier web users — subject to Google&apos;s policies)</li>
        <li>Google Sheets (internal CRM for marketing opt-in contacts — service account access only)</li>
      </ul>

      <h2>Data retention &amp; deletion</h2>
      <p>
        We retain account and property data while your account is active. You may request deletion by contacting{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Some records may be retained where required by law
        or for legitimate business purposes (e.g. billing records).
      </p>

      <h2>Security</h2>
      <p>
        We use industry-standard practices including encrypted connections (HTTPS), authenticated API access, and
        row-level security on database tables. No method of transmission over the Internet is 100% secure; we
        continuously work to protect your data.
      </p>

      <h2>Children</h2>
      <p>{APP_NAME} is not directed at children under 13. We do not knowingly collect data from children.</p>

      <h2>Changes</h2>
      <p>We may update this policy. Material changes will be reflected by updating the date at the top of this page.</p>

      <h2>Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPageShell>
  );
}
