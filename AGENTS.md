# PropertyPulse — Agent & tooling guide

This doc helps Cursor, Supabase, and other tools work correctly with the repo.

## Repo layout

```
├── backend/                 # Python FastAPI backend (optional)
│   ├── app/
│   │   ├── main.py          # App, CORS, Stripe webhook
│   │   ├── config.py        # Settings from env
│   │   ├── dependencies.py   # JWT auth, Supabase
│   │   ├── llm.py           # OpenAI property + invoke
│   │   └── routers/         # auth, property_scores, clients, private_listings, property, llm, subscription
│   ├── requirements.txt
│   └── .env.example
├── src/
│   ├── api/                 # Backend abstraction
│   │   ├── index.js         # Picks adapter: Python, Supabase, or Base44
│   │   ├── types.js
│   │   └── adapters/        # base44Adapter, supabaseAdapter, pythonBackendAdapter
│   ├── core/                # Shared (web + RN): routes, hooks, constants, propertyService
│   ├── lib/                 # AuthContext, app-params, etc.
│   ├── pages/               # React pages (web)
│   └── components/
├── supabase/
│   └── migrations/          # SQL schema (profiles, property_scores, clients, private_listings, property_cache)
├── .cursorrules             # Cursor-specific rules
├── .env.example             # Frontend env
└── AGENTS.md                # This file
```

## Backend modes

1. **Python backend (recommended for production)**  
   - Set `VITE_USE_PYTHON_BACKEND=true` and `VITE_API_BASE_URL` (e.g. `http://localhost:8000`).  
   - Auth: Supabase (frontend logs in with Supabase; sends JWT to Python).  
   - Run backend: `cd backend && uvicorn app.main:app --reload`.  
   - Env: copy `backend/.env.example` to `backend/.env` (Supabase, Stripe, OpenAI, CORS).

2. **Supabase client-only**  
   - Set `VITE_USE_SUPABASE=true` and Supabase URL/anon key.  
   - No Python server; frontend talks to Supabase directly. LLM/subscription require Edge Functions or external services.

3. **Base44**  
   - Default when neither Python nor Supabase is enabled. Uses Base44 SDK and Builder.

## Supabase

- **Schema:** Apply all files in `supabase/migrations/` in order (e.g. Supabase SQL Editor or `supabase db push`).
- **Auth:** Frontend uses Supabase Auth (login/signup). With Python backend, frontend sends `Authorization: Bearer <access_token>`; Python verifies JWT with `SUPABASE_JWT_SECRET`.
- **Service role:** Python backend uses `SUPABASE_SERVICE_ROLE_KEY` for DB; never expose it to the frontend.

## Python backend

- **Port:** Default 8000; override with `PORT` in `backend/.env`.
- **Stripe webhook:** Point Stripe to `https://your-api/api/webhooks/stripe`; set `STRIPE_WEBHOOK_SECRET`. Webhook sets `profiles.plan` and `profiles.stripe_customer_id`.
- **Property search:** `POST /api/property/search` uses server-side cache (`property_cache` table) and OpenAI for misses.

## Cursor

- Prefer editing via the abstractions: use `api` from `@/api`, and Python routers in `backend/app/routers/`.
- See `.cursorrules` for path aliases and backend selection.
