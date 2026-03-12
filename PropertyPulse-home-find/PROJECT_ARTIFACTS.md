# Project & Artifacts

> **Related:**
> - [DATABASES_AND_OPERATIONS.md](DATABASES_AND_OPERATIONS.md) — Databases, migrations, storage, auth, APIs, webhooks, CI/CD, deployment, rollback.
> - [OBSERVABILITY_AND_FRONTEND.md](OBSERVABILITY_AND_FRONTEND.md) — Logging, metrics, health probes, security, CORS, CSP, frontend build, SPA, cache-busting.
> - [ARCHITECTURE.md](ARCHITECTURE.md) — Architecture diagram, components, data flow, key code locations, onboarding.

## Build artifacts

| Artifact | Location | Produced by |
|----------|----------|-------------|
| **Frontend static bundle** | `dist/` | `npm run build` (Vite) |
| **Python backend** | N/A (no compiled output) | Runs interpreted via uvicorn; no build step |

**Frontend (`dist/`):**
- `index.html` — entry point
- `assets/*.js`, `assets/*.css` — hashed JS/CSS bundles
- `assets/*` — other static assets (images, fonts, etc.)

**Backend:** No binaries or bundles. Source in `backend/app/` is executed directly.

---

## Reproducible build

### Frontend

| Item | Value |
|------|-------|
| **Command** | `npm ci && npm run build` |
| **Package manager** | npm |
| **Lockfile** | `package-lock.json` |
| **Runtime** | Node.js 18+ (LTS recommended) |
| **Framework** | Vite 6.x |

Use `npm ci` (not `npm install`) to get exact dependency versions from the lockfile.

### Backend

| Item | Value |
|------|-------|
| **Command** | `pip install -r requirements.txt` then `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| **Package manager** | pip |
| **Lockfile** | None (Python uses `requirements.txt` only; consider `pip freeze > requirements.lock` for reproducibility) |
| **Runtime** | Python 3.11+ |
| **ASGI server** | uvicorn |

---

## Docker

**Dockerfile:** `backend/Dockerfile`

**Build and run:**
```bash
cd backend
docker build -t propertypulse-backend:latest .
docker run -p 8000:8000 --env-file .env propertypulse-backend:latest
```

**Suggested image tag:** `propertypulse-backend:latest` or `propertypulse-backend:v1.0.0` (for version pinning).

Frontend is typically deployed as static files (Vercel, Netlify, S3+CloudFront) and does not need a Docker image.

---

# Dependencies & Environment

## Full dependency list

### Frontend (`package.json`)

**Runtime dependencies:**
- `@base44/sdk`, `@base44/vite-plugin` — Base44 BaaS (optional)
- `@supabase/supabase-js` — Supabase client
- `@tanstack/react-query` — Data fetching
- `react`, `react-dom`, `react-router-dom` — Core UI
- Radix UI (`@radix-ui/*`) — Components
- `lucide-react` — Icons
- `tailwind-merge`, `clsx`, `class-variance-authority` — Styling
- `framer-motion`, `recharts`, `sonner` — UI enhancements
- `@stripe/react-stripe-js`, `@stripe/stripe-js` — Stripe (client)
- `zod`, `react-hook-form`, `@hookform/resolvers` — Forms
- `date-fns`, `lodash`, `moment` — Utilities

**Dev dependencies:** `vite`, `@vitejs/plugin-react`, `eslint`, `typescript`, `tailwindcss`, etc.

**Lockfile:** `package-lock.json`

### Backend (`backend/requirements.txt`)

```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
supabase>=2.10.0
python-dotenv>=1.0.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
httpx>=0.27.0
stripe>=11.0.0
openai>=1.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
```

**Lockfile:** None. Run `pip freeze > requirements.lock` for production reproducibility.

---

## OS / system packages

No special system packages. Requires:

- **Node.js 18+** (frontend)
- **Python 3.11+** (backend)
- **npm 9+** or equivalent

**Resources (guidelines):**

| Service | CPU | Memory | Disk |
|---------|-----|--------|------|
| Frontend (static) | N/A | N/A | ~5–20 MB (built assets) |
| Backend (uvicorn) | 0.5+ vCPU | 512 MB+ | 100 MB+ |

---

## Sample `.env` (no secrets)

### Frontend (root `.env.example` or `.env.local`)

```bash
# Backend selection
VITE_USE_PYTHON_BACKEND=true
VITE_API_BASE_URL=https://api.yourapp.com

# Supabase (required for Python backend or Supabase-only mode)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Google Ads
VITE_GOOGLE_ADS_CLIENT_ID=ca-pub-xxxxxxxxxx
VITE_GOOGLE_ADS_SLOT_LEADERBOARD=123456789
```

### Backend (`backend/.env.example`)

```bash
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-dashboard

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_REALTOR_PRICE_ID=price_...

OPENAI_API_KEY=sk-...

CORS_ORIGINS=https://yourapp.com,https://www.yourapp.com

PORT=8000
```

---

## Required environment variables

### Frontend (Vite; must be prefixed with `VITE_`)

| Variable | Required | Format | Example |
|----------|----------|--------|---------|
| `VITE_USE_PYTHON_BACKEND` | When using Python API | `true` / `false` | `true` |
| `VITE_API_BASE_URL` | When `VITE_USE_PYTHON_BACKEND=true` | URL, no trailing slash | `https://api.yourapp.com` |
| `VITE_SUPABASE_URL` | When Supabase or Python backend | URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | When Supabase or Python backend | JWT string | `eyJhbGciOiJ...` |
| `VITE_GOOGLE_ADS_CLIENT_ID` | Optional (ads) | `ca-pub-*` | `ca-pub-123456` |
| `VITE_GOOGLE_ADS_SLOT_*` | Optional | Numeric ID | `123456789` |

### Backend

| Variable | Required | Format | Example |
|----------|----------|--------|---------|
| `SUPABASE_URL` | Yes | URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | JWT | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | JWT (secret) | `eyJ...` |
| `SUPABASE_JWT_SECRET` | Yes | HS256 secret | From Supabase API settings |
| `STRIPE_SECRET_KEY` | For subscriptions | `sk_test_*` or `sk_live_*` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | For webhook | `whsec_*` | `whsec_...` |
| `STRIPE_PREMIUM_PRICE_ID` | For checkout | `price_*` | `price_123` |
| `STRIPE_REALTOR_PRICE_ID` | For checkout | `price_*` | `price_456` |
| `OPENAI_API_KEY` | For LLM features | `sk-*` | `sk-...` |
| `CORS_ORIGINS` | Yes | Comma-separated URLs | `https://yourapp.com` |

---

# Configuration & Secrets

## How secrets are managed

**Current approach:** Environment variables only. No Vault, secrets manager, or external secret store is wired into the app.

**Production options:**

1. **Platform env vars** — Vercel, Railway, Render, etc.: set variables in the dashboard. Encrypted at rest by the platform.
2. **Vault / AWS Secrets Manager** — Load secrets at startup and set `os.environ` (or a config module) before the app runs. Example wrapper: `vault kv get -field=value secret/data/propertypulse/openai | export OPENAI_API_KEY=...`.
3. **Docker secrets** — If using Docker Swarm/Kubernetes, mount secrets as files and read in code.

**Recommendation for MVP:** Use platform-provided env vars (e.g. Vercel, Railway). Avoid committing `.env` (it is in `.gitignore`).

---

## Config files that change for production

| File / area | What to change |
|-------------|----------------|
| **Frontend env** | `VITE_API_BASE_URL` → production API URL; `VITE_SUPABASE_*` → production Supabase project |
| **Backend env** | `CORS_ORIGINS` → production frontend URL(s); `STRIPE_*` → live keys; `OPENAI_API_KEY` → production key |
| **Supabase Dashboard** | Auth → URL Configuration: Site URL and Redirect URLs to production frontend domain |
| **Stripe Dashboard** | Webhook endpoint URL → production backend `/api/webhooks/stripe` |
| **vercel.json** | No changes for typical deployment |

**Feature flags:** None in code. Backend selection is via `VITE_USE_PYTHON_BACKEND` and `VITE_USE_SUPABASE`.
