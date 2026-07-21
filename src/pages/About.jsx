import LegalPageShell from '@/components/trust/LegalPageShell';
import { APP_NAME } from '@/core/constants';
import { SUPPORT_EMAIL } from '@/core/companyConfig';

export default function About() {
  return (
    <LegalPageShell
      title="About Propurty"
      description="We help home buyers compare properties objectively — with weighted scores you control, not guesswork."
    >
      <h2>Our mission</h2>
      <p>
        {APP_NAME} exists because choosing a home is one of the biggest decisions most people make — yet comparison
        tools rarely reflect <em>your</em> priorities. Schools matter more to some buyers; commute time matters more
        to others. We built a platform where you define what matters, score each property against those criteria, and
        compare results side by side with clarity.
      </p>

      <h2>How scoring works</h2>
      <ol>
        <li><strong>Search</strong> — Enter an address to load property details and location context.</li>
        <li><strong>Weight</strong> — Assign importance to 30+ categories (schools, noise, layout, condition, and more).</li>
        <li><strong>Score</strong> — Rate each category for the property; we calculate a transparent weighted total.</li>
        <li><strong>Compare</strong> — Put two or more homes head-to-head and see which aligns best with your priorities.</li>
      </ol>
      <p>
        Scores are driven by <strong>your inputs and weights</strong>. They are not appraisals, automated valuations,
        or guarantees of market performance.
      </p>

      <h2>Who we serve</h2>
      <ul>
        <li><strong>Home buyers</strong> — Compare options during search and open-house season.</li>
        <li><strong>Households deciding together</strong> — Share comparisons so partners align on priorities.</li>
        <li><strong>Real estate professionals</strong> — Realtor tools for clients, private listings, and shared scorecards.</li>
      </ul>

      <h2>Data &amp; privacy</h2>
      <p>
        We use secure cloud infrastructure (including Supabase for authentication and data storage) and process
        payments through established providers (Stripe on web, Apple In-App Purchase on iOS). We do not sell your
        personal information. See our <a href="/Privacy">Privacy Policy</a> for details.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, partnerships, or press: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPageShell>
  );
}
