{/* Agent note: When the user asks to add Terms content, APPEND new sections below (do not replace existing sections unless they explicitly request a rewrite). Keep Auto-renewal current. */}
import LegalPageShell from '@/components/trust/LegalPageShell';
import { Link } from 'react-router-dom';
import { APP_NAME } from '@/core/constants';
import { SUPPORT_EMAIL, PRODUCT_DISCLAIMER } from '@/core/companyConfig';

export default function Terms() {
  return (
    <LegalPageShell
      title="Terms of Service"
      description={`Terms governing your use of ${APP_NAME} and related subscriptions.`}
    >
      <p>
        By accessing or using {APP_NAME} (&quot;Service&quot;), you agree to these Terms. If you do not agree, do not
        use the Service.
      </p>

      <h2>Eligibility</h2>
      <p>You must be at least 18 years old and able to form a binding contract to use paid features.</p>

      <h2>The Service</h2>
      <p>{PRODUCT_DISCLAIMER}</p>
      <p>
        {APP_NAME} provides tools to search addresses, assign weights, score properties, compare results, and
        (optionally) use AI-assisted insights. We do not guarantee accuracy of third-party property data, map
        results, or AI-generated content.
      </p>

      <h2>Accounts</h2>
      <p>
        You are responsible for safeguarding your login credentials and for activity under your account. Notify us
        promptly at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> if you suspect unauthorized access.
      </p>

      <h2>Subscriptions &amp; billing</h2>
      <ul>
        <li>Paid plans are sold as recurring subscriptions and renew automatically until canceled (web: Stripe; iOS: Apple In-App Purchase).</li>
        <li>Prices are shown before purchase and may change with notice for future billing periods.</li>
        <li>You may cancel anytime via your account billing settings (web) or Apple subscription settings (iOS).</li>
        <li>Refunds are handled per the applicable platform policy (Stripe / Apple) unless required by law.</li>
      </ul>

      <h2>Auto-renewal</h2>
      <p>
        Premium (Pro) and Realtor subscriptions on the web are billed through Stripe on a recurring basis.
        When you complete checkout, you authorize {APP_NAME} (via Stripe) to charge your payment method
        automatically at the start of each billing period until you cancel.
      </p>
      <ul>
        <li>
          <strong>Billing period</strong> — Monthly plans renew every month; annual plans renew every year, on the
          anniversary of your subscription start (or the interval shown at checkout).
        </li>
        <li>
          <strong>Current Premium (Pro) list prices</strong> — $3.99 per month or $39.99 per year (USD), plus any
          applicable taxes. Realtor and other plan prices are shown on the Pricing page at purchase.
        </li>
        <li>
          <strong>Renewal charge</strong> — Unless you cancel before the renewal date, your payment method on file
          is charged the then-current subscription price for the next period.
        </li>
        <li>
          <strong>How to cancel</strong> — On the web, open Profile → Billing and use the Stripe customer portal
          (or equivalent billing controls) to cancel. On iOS, manage or cancel in Apple ID subscription settings.
          Cancellation stops future renewals; you typically retain access through the end of the paid period already charged.
        </li>
        <li>
          <strong>Failed payments</strong> — If a renewal payment fails, Stripe (or Apple) may retry according to
          their policies; access may be suspended if payment cannot be collected.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for unlawful purposes or to harass others</li>
        <li>Scrape, reverse engineer, or overload our systems without permission</li>
        <li>Misrepresent scores or comparisons as official appraisals or legal advice</li>
        <li>Upload malicious code or infringe others&apos; intellectual property</li>
      </ul>

      <h2>Intellectual property</h2>
      <p>
        The Service, branding, and software are owned by {APP_NAME} or its licensors. You retain ownership of
        content you submit (e.g. notes, photos); you grant us a license to host and process it to provide the Service.
      </p>

      <h2>Disclaimer of warranties</h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, {APP_NAME.toUpperCase()} AND ITS SUPPLIERS SHALL NOT BE LIABLE FOR
        INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL,
        ARISING FROM YOUR USE OF THE SERVICE.
      </p>

      <h2>Privacy</h2>
      <p>
        Our <Link to="/Privacy">Privacy Policy</Link> describes how we handle personal data and is incorporated into
        these Terms.
      </p>

      <h2>Changes</h2>
      <p>
        We may modify these Terms. Continued use after changes constitutes acceptance. For material subscription
        changes, we will provide reasonable notice where required.
      </p>

      <h2>Contact</h2>
      <p>
        Legal or terms questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPageShell>
  );
}
