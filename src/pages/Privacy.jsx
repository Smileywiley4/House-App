{/* Agent note: When the user asks to add Privacy Policy content, APPEND new sections below (do not replace existing sections unless they explicitly request a rewrite). Structure supports growth over time. */}
import LegalPageShell from '@/components/trust/LegalPageShell';
import { Link } from 'react-router-dom';
import { APP_NAME } from '@/core/constants';
import {
  SUPPORT_EMAIL,
  PRODUCT_DISCLAIMER,
  COMPANY_LEGAL_NAME,
  LEGAL_LAST_UPDATED,
} from '@/core/companyConfig';

export default function Privacy() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      description={`How ${APP_NAME} collects, uses, and protects your information.`}
    >
      <p>
        This Privacy Policy explains how {COMPANY_LEGAL_NAME} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;),
        operating {APP_NAME}, collects, uses, shares, and protects personal information when you use our website,
        apps, and related services (the &quot;Service&quot;). By using the Service or creating an account, you
        acknowledge this Policy. See also our <Link to="/Terms">Terms of Service</Link>.
      </p>
      <p>{PRODUCT_DISCLAIMER}</p>
      <p className="text-sm text-slate-500">
        Last updated: {LEGAL_LAST_UPDATED}. Policies may change. This Policy is informational and is not legal advice
        to you; consult your own counsel if you need advice about your privacy rights.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — Email, name, optional phone, authentication identifiers, plan/status, and
          profile settings when you sign up or sign in (including via Google or similar providers).
        </li>
        <li>
          <strong>Usage &amp; search data</strong> — Addresses and searches you run, scores, comparisons, saved
          properties, projects, presets, feature usage, and approximate activity logs needed to operate the Service.
        </li>
        <li>
          <strong>Location</strong> — Approximate or precise location only if you grant permission (e.g. map
          features). Location permission is voluntary; you can deny or revoke it in device/browser settings. We use
          location to power map-related features you request, not to sell location profiles.
        </li>
        <li>
          <strong>Communications</strong> — Messages you send to support, feedback, and marketing preference choices
          (opt-in / opt-out).
        </li>
        <li>
          <strong>Contacts, shares &amp; client tools</strong> — Information you choose to enter or share (client
          names/emails, invites, private listing links, notes). We do not upload your full device contact book unless
          a feature you explicitly use requests that and you approve it.
        </li>
        <li>
          <strong>Payment data</strong> — Processed by Stripe (web) and, if applicable, Apple / Google / RevenueCat
          (mobile). We receive subscription and entitlement status; we do not store full card numbers.
        </li>
        <li>
          <strong>Device &amp; technical data</strong> — IP address, browser/device type, pages viewed, cookies or
          local storage identifiers, and basic diagnostics. Optional device snapshots only if you opt in.
        </li>
        <li>
          <strong>Mobile content</strong> — Photos and visit notes you capture in our mobile app, if you use those
          features.
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>Provide, maintain, and secure the Service (search, scoring, compare, projects, shares, accounts)</li>
        <li>Process subscriptions, billing, renewals, and restore purchases</li>
        <li>Send service notices (account, security, billing)</li>
        <li>Send product updates or promotions only if you opt in; you may opt out anytime</li>
        <li>Improve product quality, performance, and support</li>
        <li>Detect abuse, prevent fraud, and enforce our Terms</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>3. How we share information</h2>
      <p>We do <strong>not</strong> sell your personal information to data brokers. We share information only as needed to run the Service or as required by law:</p>
      <ul>
        <li>
          <strong>Processors</strong> — Supabase (auth/database), Stripe (payments), Vercel and Railway (or similar
          hosting), Google (Maps/Street View/OAuth/ads where applicable), RentCast (property data), email providers
          such as Resend, Apple/Google/RevenueCat (mobile billing), and Google Sheets (internal CRM for marketing
          opt-ins only — not for sale).
        </li>
        <li>
          <strong>User-initiated shares</strong> — When you invite a client, share a link, or use realtor–client
          features, recipients see what you choose to share.
        </li>
        <li>
          <strong>Legal &amp; safety</strong> — If required by law, legal process, or to protect rights, safety, or
          the integrity of the Service.
        </li>
        <li>
          <strong>Business transfers</strong> — In connection with a merger, acquisition, or asset sale, subject to
          appropriate confidentiality.
        </li>
      </ul>

      <h2>4. Advertising</h2>
      <p>
        Guest visitors and free-account users may see advertising (e.g. Google AdSense). Google and partners may use
        cookies, device identifiers, IP-derived location, and page context to deliver and measure ads, subject to
        your consent choices where required. Paid plans do not load our on-page advertising placements. Learn more
        about{' '}
        <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer">
          how Google uses information for advertising
        </a>
        .
      </p>

      <h2>5. Cookies &amp; local storage</h2>
      <p>
        We use cookies and similar technologies (including local/session storage) for sign-in sessions, preferences,
        security, analytics needed to operate the site, and — where applicable — advertising consent and delivery.
        You can control cookies through your browser; disabling them may break login or core features.
      </p>

      <h2>6. Retention</h2>
      <p>
        We retain account and property data while your account is active and for a reasonable period afterward as
        needed for backups, disputes, security, and legal compliance (e.g. billing records). You may request deletion
        as described below; some information may remain where retention is required or permitted by law.
      </p>

      <h2>7. Security</h2>
      <p>
        We use reasonable administrative, technical, and organizational measures — including HTTPS, authenticated
        API access, and database access controls. No method of transmission or storage is 100% secure; we cannot
        guarantee absolute security.
      </p>

      <h2>8. Your choices &amp; rights</h2>
      <p>
        Depending on where you live (including under laws such as the CCPA/CPRA in California or GDPR-style rules in
        the EEA/UK, if they apply to you), you may have rights to access, correct, delete, or export certain personal
        data, or to object to/restrict certain processing. You can often manage profile data in your account. For
        access or deletion requests, email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from your account email. We may need to verify your
        identity. We do not discriminate against you for exercising privacy rights available under applicable law.
        We do not guarantee that every jurisdiction&apos;s rights apply to every request; we will respond as required
        by applicable law.
      </p>

      <h2>9. Children&apos;s privacy</h2>
      <p>
        The Service is not directed to children under 13 (or under 16 where that higher age applies). We do not
        knowingly collect personal information from children. If you believe a child has provided data, contact us
        and we will take appropriate steps to delete it.
      </p>

      <h2>10. International transfers</h2>
      <p>
        We are based in the United States. If you access the Service from outside the U.S., your information may be
        processed in the United States and other countries where our processors operate. Those countries may have
        different data-protection laws than your home country.
      </p>

      <h2>11. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. Material changes will be reflected by updating the &quot;Last
        updated&quot; date. Continued use after changes means you acknowledge the updated Policy. For significant
        changes, we may provide additional notice where appropriate.
      </p>

      <h2>12. Contact</h2>
      <p>
        Privacy questions or requests: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
      <p className="text-sm text-slate-500">
        This Policy may be updated. It is not legal advice. Nothing herein claims that we are immune from all legal
        claims or obligations under applicable privacy law.
      </p>
    </LegalPageShell>
  );
}
