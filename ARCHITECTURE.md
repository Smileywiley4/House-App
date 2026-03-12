# Code & Architecture

## Architecture diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PROPERTY PULSE                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     HTTPS      ┌──────────────┐     Bearer JWT     ┌──────────────┐
│   Browser    │ ─────────────►│   Frontend   │ ──────────────────►│   Backend    │
│  (React SPA) │                │  (Vite/      │                    │  (FastAPI)   │
│              │ ◄───────────── │   React)     │ ◄────────────────── │              │
└──────────────┘                └──────┬──────┘                     └──────┬───────┘
       │                               │                                    │
       │ Supabase Auth                  │ VITE_API_BASE_URL                  │
       │ (login, session)               │ (env)                              │
       ▼                               │                                    │
┌──────────────┐                       │                                    │
│   Supabase   │◄─────────────────────┼────────────────────────────────────┘
│   Auth + DB  │   JWT validation,     │        DB (profiles, property_scores,
└──────────────┘   CRUD via client    │         clients, private_listings,
       ▲          or Python API       │         property_cache)
       │                               │
       │                               │
       │ Stripe Checkout               │ OpenAI
       │ (redirect)                    │ (property search, AI features)
       ▼                               ▼
┌──────────────┐                ┌──────────────┐
│   Stripe     │◄───────────────│   OpenAI     │
│ (payments,   │  Webhook       │   (LLM)      │
│  webhook)    │  /api/webhooks │              │
└──────────────┘  /stripe       └──────────────┘
```

### Data flow

| Flow | Path |
|------|------|
| **Login** | Browser → Supabase Auth → session in localStorage → frontend sends Bearer token to backend |
| **Property search** | Frontend → `api.property.search` or `api.integrations.invokeLLM` → Backend → OpenAI + property_cache |
| **Save score** | Frontend → `api.entities.PropertyScore.create` → Backend → Supabase |
| **Checkout** | Frontend → `api.subscription.createCheckoutSession` → Backend → Stripe → redirect |
| **Webhook** | Stripe → `POST /api/webhooks/stripe` → Backend → updates `profiles.plan` in Supabase |

---

## Components

| Component | Tech | Role |
|-----------|------|------|
| **Frontend** | React, Vite | SPA; auth via Supabase, API calls to backend (or Supabase/Base44) |
| **Backend** | FastAPI (Python) | Auth, CRUD, property search, LLM proxy, Stripe checkout/webhook |
| **Database** | Supabase (PostgreSQL) | Profiles, scores, clients, listings, property_cache |
| **Auth** | Supabase Auth | Sign-up, sign-in, JWT |
| **Payments** | Stripe | Checkout, subscription, webhook |
| **LLM** | OpenAI | Property data, AI insights |
| **Ads** | Google Ads/AdSense | Client-side; free users only |

**Workers / cron:** None. All work is request-response (sync API calls, Stripe webhook handler).

---

## Key code locations

### Frontend (`src/`)

| Path | Purpose |
|------|---------|
| `src/App.jsx` | Root, routes, ErrorBoundary, AuthProvider |
| `src/main.jsx` | Entry point |
| `src/Layout.jsx` | Shell layout, nav, AdSlot in footer |
| `src/pages/*.jsx` | Page components (Home, Login, Profile, Compare, etc.) |
| `src/components/` | Reusable UI (PremiumGate, AdSlot, ForSaleBadge, evaluate/*, ui/*) |
| `src/api/` | Backend abstraction; adapters for Python, Supabase, Base44 |
| `src/core/` | Shared logic: routes, hooks (usePlan, usePropertyScores), propertyService, constants |
| `src/lib/` | AuthContext, app-params, query-client, utils |

### Backend (`backend/`)

| Path | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app, CORS, Stripe webhook, health |
| `backend/app/config.py` | Settings from env |
| `backend/app/dependencies.py` | JWT verification, get_current_user_id |
| `backend/app/supabase_client.py` | Supabase admin client |
| `backend/app/llm.py` | OpenAI property search, invoke_llm |
| `backend/app/routers/*.py` | auth, property_scores, clients, private_listings, property, llm, subscription |

### Database

| Path | Purpose |
|------|---------|
| `supabase/migrations/*.sql` | Schema: profiles, property_scores, clients, private_listings, property_cache, triggers |

### Config / tooling

| Path | Purpose |
|------|---------|
| `vite.config.js` | Vite build config |
| `vercel.json` | Vercel deploy config |
| `backend/Dockerfile` | Backend container image |
| `.github/workflows/*.yml` | CI (frontend build/lint, backend import check) |

---

## Onboarding

### First-time setup

1. **Read:** [README.md](README.md) (quick start), [AGENTS.md](AGENTS.md) (structure).
2. **Clone:** Repo, then `npm install` (frontend) and `pip install -r backend/requirements.txt` (backend).
3. **Env:** Copy `.env.example` → `.env.local` (frontend) and `backend/.env.example` → `backend/.env` (backend). Fill Supabase URL/keys, OpenAI key.
4. **Supabase:** Create project, run `supabase/migrations/*.sql` in order.
5. **Run:** `npm run dev` (frontend), `uvicorn app.main:app --reload` (backend).
6. **Docs:** [PROJECT_ARTIFACTS.md](PROJECT_ARTIFACTS.md), [DATABASES_AND_OPERATIONS.md](DATABASES_AND_OPERATIONS.md), [OBSERVABILITY_AND_FRONTEND.md](OBSERVABILITY_AND_FRONTEND.md).

### Conventions

- **API:** Use `import { api } from '@/api'`; do not import Supabase/Base44 directly.
- **Routes:** Use `createPageUrl()` and `src/core/routes.js` for paths.
- **Backend:** All routes under `/api`; protected routes use `get_current_user_id` dependency.

---

## Contact & support

| Need | Where |
|------|-------|
| **Base44** (if using) | [app.base44.com/support](https://app.base44.com/support) |
| **Supabase** | [supabase.com/docs](https://supabase.com/docs) |
| **Stripe** | [stripe.com/docs](https://stripe.com/docs) |

For project-specific questions, add a `CONTACT.md` or update this section with maintainer details.
