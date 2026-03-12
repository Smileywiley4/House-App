# Property Pulse

Compare properties with weighted scoring: search an address, score categories that matter to you, and compare saved properties side-by-side. Built for **Cursor**, **Supabase**, and a **Python (FastAPI) backend**, with optional Base44. Works on web and (with the same core) React Native.

**Architecture:** Browser → React SPA → Python API (or Supabase/Base44) → Supabase DB. Auth via Supabase; Stripe for payments; OpenAI for property/AI. See [ARCHITECTURE.md](ARCHITECTURE.md) for diagram, data flow, key code locations, and onboarding.

## Quick start (Python backend — recommended)

1. **Supabase:** Create a project at [supabase.com](https://supabase.com). Run all SQL in [supabase/migrations/](supabase/migrations/) (in order). Note: Project URL, anon key, service role key, and JWT secret (Project Settings → API).

2. **Backend:** From repo root:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate   # or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   cp .env.example .env        # fill SUPABASE_*, STRIPE_*, OPENAI_API_KEY, CORS_ORIGINS
   uvicorn app.main:app --reload
   ```
   Backend runs at `http://localhost:8000`. Optional: Stripe webhook at `POST /api/webhooks/stripe` to set `profiles.plan` after payment.

3. **Frontend:** In repo root:
   ```bash
   npm install
   cp .env.example .env.local
   ```
   Set in `.env.local`:
   ```bash
   VITE_USE_PYTHON_BACKEND=true
   VITE_API_BASE_URL=http://localhost:8000
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   Then `npm run dev`. Add a `/login` page that uses Supabase Auth (e.g. `signInWithOAuth` or `signInWithPassword`) and redirects back.

4. **Cursor / tooling:** See [.cursorrules](.cursorrules) and [AGENTS.md](AGENTS.md) for stack and conventions.

**MVP launch (e.g. Vercel):** See [LAUNCH.md](LAUNCH.md) for a step-by-step checklist (Vercel frontend, Railway/Render backend, Supabase, Stripe, env vars).

**Hand-off package:** See [HANDOFF.md](HANDOFF.md) for artifact index, deployment checklist, ZIP/branch instructions, and [LEGAL_AND_OWNERSHIP.md](LEGAL_AND_OWNERSHIP.md) for ownership and legal guidance.

## Quick start (Base44)

1. Clone, then `npm install`
2. Create `.env` or `.env.local` (see [.env.example](.env.example)):

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
VITE_BASE44_FUNCTIONS_VERSION=prod
```

3. Run: `npm run dev`

## Using Supabase (client-only, no Python)

1. Create a project at [supabase.com](https://supabase.com) and get your project URL and anon key.
2. Run the schema in the Supabase SQL Editor: [supabase/migrations/20250222000000_propertypulse_schema.sql](supabase/migrations/20250222000000_propertypulse_schema.sql)
3. Set env and switch backend:

```bash
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. **Auth:** The app redirects unauthenticated users to `/login`. Add a Login page that signs in with Supabase (e.g. `supabase.auth.signInWithOAuth()` or `signInWithPassword`) and redirect back.
5. **AI (LLM):** With Supabase, AI features (search, auto-score, insights) call a Supabase Edge Function named `invoke-llm`. Create that function to proxy to your preferred LLM (OpenAI, Anthropic, etc.). Until then, those features will error when using Supabase.

## Project structure (web + portable core)

- **`src/api/`** — Backend abstraction. Use `import { api } from '@/api'` everywhere. Backend is chosen by env: **Python** (`VITE_USE_PYTHON_BACKEND` + `VITE_API_BASE_URL`), **Supabase client** (`VITE_USE_SUPABASE`), or **Base44** (default).
  - `api.auth` — `me()`, `updateMe()`, `logout()`, `redirectToLogin()`
  - `api.entities.PropertyScore` / `Client` / `PrivateListing` — list, create, delete
  - `api.integrations.invokeLLM(options)` — AI; with Python backend, `api.property.search(address)` for cached property search
- **`backend/`** — Python FastAPI app (optional). Supabase for DB + Auth, Stripe for subscriptions, OpenAI for LLM. See [AGENTS.md](AGENTS.md).
- **`src/core/`** — Shared logic safe for React and React Native:
  - `routes.js` — Route keys and `getPathForRoute()` / `getRouteFromPath()`
  - `constants.js` — App name, theme colors
  - `hooks/usePropertyScores.js` — Fetch and delete property scores (use in web and RN)
- **`src/pages/`** — React (web) pages using React Router and DOM.
- **`src/components/`** — UI components (web). For React Native, you’d add a separate set of views (e.g. under `src/native/` or another app) that use the same `api` and `core`.

## Using this codebase with React Native

The front end is structured so you can reuse the same backend and logic in a React Native app:

1. **Backend:** Use the same `src/api` (and env) in your RN app. The `api` object has no DOM dependency; only the Base44 adapter uses `window` for redirects (Supabase adapter is fine in RN).
2. **Routes:** Use `src/core/routes.js` — same `ROUTE_KEYS` and helpers. Map these to React Navigation screens instead of paths.
3. **Data:** Use `src/core/hooks/usePropertyScores.js` and your existing auth context (or an RN-safe wrapper around `api.auth`).
4. **UI:** Implement RN screens that call `api.*` and the shared hooks; use React Native components instead of `src/pages/*` and `src/components/*` (those are DOM-based).

So: **API + core (routes, constants, hooks) are portable.** Pages and components are web-specific; for RN you add new views that depend only on `api` and `core`.

## Paywall & subscriptions (web + iOS/Android)

- **Plans:** Free (compare 2, with ads), Premium (3+ compare, AI features, ad-free), Realtor (portal, clients, private listings).
- **Gating:** Premium features (AI insights, AI auto-score, For You recommendations, 3+ property compare) show a paywall modal; Realtor portal requires Realtor plan. Use `usePlan()` from `@/core/hooks/usePlan` and `<PremiumGate>` / `<PaywallModal>` for consistent behavior on web and React Native.
- **Checkout:** Pricing page calls `api.subscription.createCheckoutSession({ planId, successUrl, cancelUrl })`. With Base44, wire your Stripe integration to that API or use the redirect to Pricing. With Supabase, implement a `create-checkout-session` Edge Function that creates a Stripe Checkout Session and returns the URL; use a webhook to set `profiles.plan` after payment.

## Ads (free users only)

- **Free users** see ad slots (e.g. Google AdSense/Google Ads). **Premium and Realtor** users do not. `<AdSlot>` in `src/components/AdSlot.jsx` only renders when `usePlan().showAds` is true.
- **Web:** Set `VITE_GOOGLE_ADS_CLIENT_ID` and `VITE_GOOGLE_ADS_SLOT_LEADERBOARD` (and optionally `VITE_GOOGLE_ADS_SLOT_INFEED`) in env. Ads appear in the footer and on the Home page.
- **iOS/Android:** Use the same `showAds` check; render your native ad SDK (e.g. react-native-google-mobile-ads) instead of the web AdSlot component.

## Property accuracy & “For Sale” badge

- **Consistency:** Property search uses `getPropertyByAddress()` in `src/core/propertyService.js`, which caches results by normalized address (localStorage, 24h TTL). The same address returns the same data on repeat searches.
- **Accuracy:** The LLM prompt asks for data aligned with major listing sites and public records; you can later plug in a real property API (e.g. ATTOM, Realtor.com) by replacing the LLM call inside `propertyService.js`.
- **Listing badge:** If the data includes `on_market: true`, the property card shows a **“For Sale”** badge (and optional `listing_source`). The LLM is prompted to set `on_market` when the property is actively listed; otherwise the badge is hidden.

## Base44 (default backend)

- View and edit the app on [Base44.com](https://Base44.com). Pushing to the connected repo updates the Base44 builder.
- Docs: [docs.base44.com](https://docs.base44.com/Integrations/Using-GitHub)  
- Support: [app.base44.com/support](https://app.base44.com/support)
