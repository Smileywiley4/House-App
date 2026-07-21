{/* Agent note: When the user asks to add Terms content, APPEND new sections below (do not replace existing sections unless they explicitly request a rewrite). Keep Auto-renewal current. */}
import LegalPageShell from '@/components/trust/LegalPageShell';
import { Link } from 'react-router-dom';
import { APP_NAME } from '@/core/constants';
import {
  SUPPORT_EMAIL,
  PRODUCT_DISCLAIMER,
  COMPANY_LEGAL_NAME,
  GOVERNING_LAW_STATE,
  LEGAL_LAST_UPDATED,
} from '@/core/companyConfig';

export default function Terms() {
  return (
    <LegalPageShell
      title="Terms of Service"
      description={`Terms governing your use of ${APP_NAME} and related subscriptions.`}
    >
      <p>
        These Terms of Service (&quot;Terms&quot;) are a binding agreement between you and {COMPANY_LEGAL_NAME}{' '}
        (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), operating {APP_NAME} (the &quot;Service&quot;). By
        accessing, browsing, signing up for, or using the Service — including our website and related apps — you
        agree to these Terms and our{' '}
        <Link to="/Privacy">Privacy Policy</Link>. If you do not agree, do not use the Service.
      </p>
      <p className="text-sm text-slate-500">
        Last updated: {LEGAL_LAST_UPDATED}. These Terms may change over time. This document is for informational
        clarity and risk reduction; it is not legal advice to you. You should consult your own attorney about your
        rights and obligations.
      </p>

      <h2>1. Acceptance</h2>
      <p>
        Creating an account, completing checkout, or continuing to use the Service after notice of updates
        constitutes acceptance of the then-current Terms. If you use the Service on behalf of an organization, you
        represent that you have authority to bind that organization.
      </p>

      <h2>2. Eligibility &amp; accounts</h2>
      <ul>
        <li>You must be at least 18 years old (or the age of majority where you live) to create an account or use paid features.</li>
        <li>You must provide accurate account information and keep it updated.</li>
        <li>You are responsible for safeguarding credentials and for all activity under your account.</li>
        <li>
          Notify us promptly at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> if you suspect unauthorized
          access.
        </li>
        <li>We may refuse, suspend, or terminate accounts that violate these Terms or create risk to the Service or others.</li>
      </ul>

      <h2>3. Description of the Service</h2>
      <p>{PRODUCT_DISCLAIMER}</p>
      <p>
        {APP_NAME} is a software tool that may help you search and view property-related information, apply personal
        weights and scoring estimates, compare properties, manage projects, and — where available — share information
        with clients or contacts (including realtor–client workflows and private listing links). Features may change
        over time. The Service is <strong>informational and decision-support only</strong>.
      </p>

      <h2>4. Not brokerage, MLS, appraisal, or professional advice</h2>
      <p>Without limiting the disclaimer above, you acknowledge that:</p>
      <ul>
        <li>
          We are <strong>not</strong> a real estate brokerage, agent, or MLS; we do not represent buyers or sellers
          in transactions; and we do not provide listing brokerage services.
        </li>
        <li>
          Scores, estimates, comps, AI insights, maps, Street View imagery, and similar outputs are{' '}
          <strong>estimates and informational only</strong> — not appraisals, inspections, surveys, warranties, or
          guarantees of value, condition, title, or marketability.
        </li>
        <li>
          Property Scores reflect your stated preferences and publicly available data; they are not appraisals and
          should not be the sole basis for a purchase decision. Off-market and automated value estimates are likewise
          estimates only — not appraisals — and should not be the sole basis for a purchase decision.
        </li>
        <li>
          Nothing in the Service is financial, investment, legal, tax, insurance, or real-estate licensing advice.
          Consult licensed professionals before making decisions.
        </li>
        <li>
          Listings, availability, prices, photos, and data may be incomplete, outdated, or incorrect. Always verify
          independently with primary sources (e.g. listing agents, MLS where applicable, public records, inspectors).
        </li>
        <li>We do not guarantee accuracy, completeness, timeliness, or continued availability of any data or feature.</li>
      </ul>

      <h2>5. Third-party data &amp; services</h2>
      <p>
        The Service may rely on third parties such as RentCast, Google (including Maps and Street View), Stripe,
        Supabase, OpenStreetMap / Nominatim, hosting providers, email providers, app stores, and others. We do not
        control those third parties. Their terms, privacy policies, and availability apply. Outages, errors, rate
        limits, or policy changes by third parties may affect the Service. We are not responsible for third-party
        content, maps, imagery, payment processors, or data feeds.
      </p>

      <h2>6. User content, shares &amp; private listing links</h2>
      <ul>
        <li>
          You retain ownership of content you submit (notes, photos, project data, messages, links you share). You
          grant us a non-exclusive license to host, process, and display that content solely to operate and improve
          the Service.
        </li>
        <li>
          You represent that you have all rights needed to upload, share, or link content — including private listing
          links and client contact information — and that doing so does not violate law, contracts, or third-party
          rights.
        </li>
        <li>
          Private listing links and realtor–client shares are between the parties who initiate them. Recipients you
          invite may see information you choose to share. You are responsible for what you share and with whom.
        </li>
        <li>
          These Terms do <strong>not</strong> authorize scraping, bulk export, resale, or automated harvesting of the
          Service or its data.
        </li>
      </ul>

      <h2>7. Realtor–client &amp; professional use</h2>
      <p>
        If you use realtor, client, sharing, or professional features, you alone are responsible for complying with
        fair housing laws, agency and disclosure rules, privacy and telemarketing rules, licensing requirements, and
        any MLS or brokerage policies that apply in your jurisdiction. We do not supervise your real-estate practice
        and are not a party to your client relationships.
      </p>

      <h2>8. Subscriptions &amp; billing</h2>
      <ul>
        <li>
          <strong>Premium (Pro)</strong> — Currently $3.99 per month or $39.99 per year (USD), plus applicable taxes,
          as shown at checkout. Prices may change for future periods with notice where required.
        </li>
        <li>
          <strong>Realtor and other plans</strong> — Priced as shown in the app / Pricing page at the time of
          purchase.
        </li>
        <li>
          Web subscriptions are processed by Stripe. iOS/Android purchases (if offered) are processed by Apple or
          Google under their terms.
        </li>
        <li>
          Paid plans are <strong>recurring subscriptions that auto-renew</strong> until you cancel (see Auto-renewal
          below).
        </li>
        <li>
          Cancel anytime via Profile → Billing (web Stripe portal) or the applicable app-store subscription settings.
          Cancellation stops future renewals; you generally retain access through the end of the period already paid.
        </li>
        <li>
          <strong>Refunds</strong> — Except where required by law or by Apple/Google platform rules, fees are
          generally non-refundable, including for unused time in a billing period, downgrades, or partial periods.
          Chargebacks or payment disputes may result in suspension of the account.
        </li>
      </ul>

      <h2>9. Auto-renewal</h2>
      <p>
        When you complete checkout for a paid plan, you authorize {COMPANY_LEGAL_NAME} / {APP_NAME} (via Stripe or
        the app store) to charge your payment method automatically at the start of each billing period until you
        cancel.
      </p>
      <ul>
        <li>
          <strong>Billing period</strong> — Monthly plans renew every month; annual plans renew every year on the
          anniversary of your subscription start (or the interval shown at checkout).
        </li>
        <li>
          <strong>Current Premium list prices</strong> — $3.99/month or $39.99/year (USD), plus taxes. Realtor and
          other plan prices are shown at purchase.
        </li>
        <li>
          <strong>Renewal charge</strong> — Unless you cancel before the renewal date, your payment method is charged
          the then-current price for the next period.
        </li>
        <li>
          <strong>How to cancel</strong> — Web: Profile → Billing → Manage subscription / Cancel (Stripe customer
          portal). No support ticket, phone call, or retention survey is required. iOS: Apple ID subscription
          settings. Android: Google Play subscriptions. Cancellation stops future renewals; access typically
          continues through the paid period already charged.
        </li>
        <li>
          <strong>Failed payments</strong> — Processors may retry failed renewals; access may be suspended if payment
          cannot be collected.
        </li>
      </ul>

      <h2>10. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for unlawful, fraudulent, or harmful purposes</li>
        <li>Harass, spam, or abuse other users or contacts reached through the Service</li>
        <li>Scrape, crawl, mirror, bulk-download, or reverse engineer the Service or its data without our written permission</li>
        <li>Bypass rate limits, paywalls, access controls, or security features</li>
        <li>Misrepresent scores or outputs as official appraisals, MLS data, or legal/financial advice</li>
        <li>Upload malware or infringe others&apos; intellectual property or privacy rights</li>
        <li>Resell or sublicense access to the Service except as expressly allowed</li>
      </ul>

      <h2>11. Intellectual property</h2>
      <p>
        The Service, software, branding, design, and our original content are owned by {COMPANY_LEGAL_NAME} or its
        licensors. Third-party marks (e.g. Google, Stripe) belong to their owners. No rights are granted except the
        limited license to use the Service as permitted by these Terms.
      </p>

      <h2>12. Disclaimer of warranties</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE AND ALL DATA, SCORES, MAPS, LINKS, AND CONTENT ARE
        PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
        INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT
        THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS, OR THAT RESULTS WILL MEET
        YOUR EXPECTATIONS.
      </p>

      <h2>13. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, {COMPANY_LEGAL_NAME.toUpperCase()}, {APP_NAME.toUpperCase()}, AND
        THEIR SUPPLIERS SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE
        DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITY, ARISING FROM OR RELATED TO
        YOUR USE OF (OR INABILITY TO USE) THE SERVICE — EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATING TO THE
        SERVICE OR THESE TERMS SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID TO US FOR THE SERVICE IN THE
        TWELVE (12) MONTHS BEFORE THE CLAIM, OR (B) FIFTY U.S. DOLLARS (US $50) IF YOU HAVE NOT PAID US.
      </p>
      <p>
        Some jurisdictions do not allow certain limitations; in those places, our liability is limited to the fullest
        extent permitted by law. Nothing in these Terms excludes liability that cannot be limited under applicable
        law.
      </p>

      <h2>14. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold harmless {COMPANY_LEGAL_NAME}, its affiliates, and their officers,
        directors, employees, and agents from and against claims, damages, losses, and expenses (including reasonable
        attorneys&apos; fees) arising out of or related to: (a) your use of the Service; (b) your content or shares
        (including private links and client data); (c) your violation of these Terms or law; or (d) your professional
        real-estate or agency activities.
      </p>

      <h2>15. Termination</h2>
      <p>
        You may stop using the Service and cancel subscriptions as described above. We may suspend or terminate
        access immediately for violation of these Terms, nonpayment, legal risk, or misuse. Upon termination,
        sections that by nature should survive (including disclaimers, limitations, indemnification, and governing
        law) will survive.
      </p>

      <h2>16. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The &quot;Last updated&quot; date will change when we do.
        Continued use after changes become effective constitutes acceptance. For material changes to paid
        subscriptions, we will provide reasonable notice where required by law.
      </p>

      <h2>17. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of {GOVERNING_LAW_STATE}, United States, without regard to
        conflict-of-law rules, except where mandatory consumer protections in your place of residence apply. Courts
        located in {GOVERNING_LAW_STATE} shall have exclusive jurisdiction over disputes arising from these Terms,
        subject to applicable law. You and we waive any objection to venue in those courts to the extent permitted by
        law.
      </p>

      <h2>18. Account deletion</h2>
      <p>
        You may delete your account from Profile → Security (web). Deletion is permanent and typically includes:
      </p>
      <ul>
        <li>
          Removal or anonymization of personal account data in our systems (profile, contacts, shares, projects,
          photos/avatars, and related app data), subject to legal retention needs (for example limited billing or
          fraud records).
        </li>
        <li>
          <strong>Subscription billing</strong> — Any active Stripe web subscription is{" "}
          <strong>canceled immediately</strong> so that <strong>no charge occurs at the next billing period</strong>.
          Paid access ends when deletion completes (you do not keep mid-cycle access after deletion).
        </li>
        <li>
          <strong>Referral credits</strong> — Any unused referral / invite credits are <strong>forfeited</strong> on
          deletion. Auto-renewal stops because the subscription is canceled.
        </li>
        <li>
          Our internal account CRM (Google Sheets) is updated to a Deleted status with a timestamp; contact fields are
          cleared. Card numbers are never stored in that sheet.
        </li>
      </ul>
      <p>
        After deletion we clear local session data on the device that completed the request; sign out on other devices
        as needed. App-store subscriptions (if any) must also be canceled in Apple / Google subscription settings.
      </p>

      <h2>19. Invite &amp; referral program</h2>
      <p>
        {APP_NAME} may offer an invite / referral program that lets you share a personal invite link with contacts.
        Free accounts may invite others, and invitees may create a free account. Referral rewards are separate from
        any admin promo codes or Stripe promotion codes entered at checkout.
      </p>
      <ul>
        <li>
          <strong>Eligibility for credit</strong> — A referral credit is earned only when an invitee signs up using
          your valid invite link (or code) and later subscribes to a paid plan of <strong>Premium (Pro) or Realtor</strong>{' '}
          (or higher). Signing up for Free alone does not create a billing credit.
        </li>
        <li>
          <strong>Reward</strong> — When that paid subscription first becomes active, we may credit both the inviter
          and the invitee an amount roughly equal to <strong>one month</strong> of the paid plan each person is on
          (for monthly plans: about one billing cycle; for yearly plans: about one-twelfth of the annual price, or an
          equivalent month of value). Credits are typically applied as a Stripe customer balance (or similar) toward
          the <strong>next</strong> invoice / billing statement.
        </li>
        <li>
          <strong>Yearly plans &amp; forfeiture</strong> — For annual subscriptions, unused referral credit is intended
          for the next renewal statement. If you cancel before that next billing statement and the credit has not yet
          been applied to a paid invoice, you <strong>forfeit</strong> the unused referral credit.
        </li>
        <li>
          <strong>Limits</strong> — One reward path per invitee (no double-dipping). An inviter may invite many people.
          Self-referrals are void. We may deny, reverse, or reclaim credits for fraud, abuse, chargebacks, or errors.
          Credits have no cash value, are non-transferable, and may be modified or discontinued with notice where
          required.
        </li>
        <li>
          <strong>Inviter paid status</strong> — The invitee&apos;s credit applies when they pay for Pro/Realtor. The
          inviter&apos;s matching credit applies when the inviter also has an active paid Pro/Realtor (or higher)
          subscription with a billing customer on file at the time credits are applied.
        </li>
        <li>
          Program details in the app are informational; this section and your checkout terms control. This is not legal
          advice.
        </li>
      </ul>

      <h2>20. Contact</h2>
      <p>
        Legal or terms questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>

      <h2>21. General</h2>
      <p>
        If any provision is found unenforceable, the remaining provisions remain in effect. These Terms, together
        with the Privacy Policy and any plan-specific checkout terms, are the entire agreement regarding the
        Service. Our failure to enforce a provision is not a waiver. You may not assign these Terms without our
        consent; we may assign them in connection with a merger, acquisition, or sale of assets.
      </p>
      <p className="text-sm text-slate-500">
        Policies may be updated. This is not a substitute for advice from your own counsel. Nothing herein claims
        immunity from all legal claims or liability that cannot be limited under law.
      </p>
    </LegalPageShell>
  );
}
