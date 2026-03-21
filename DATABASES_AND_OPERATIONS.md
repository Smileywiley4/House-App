# Databases & Storage

## Database: Supabase (PostgreSQL)

| Item | Value |
|------|-------|
| **Database** | PostgreSQL 15 (Supabase managed) |
| **Host** | Provided by Supabase project |
| **Access** | Via Supabase client (anon/service_role) or direct connection string for migrations |

---

## Migration scripts

**Location:** `supabase/migrations/`

| File | Purpose |
|------|---------|
| `20250222000000_propertypulse_schema.sql` | Core schema: profiles, property_scores, clients, private_listings, handle_new_user trigger |
| `20250222100000_property_cache_and_stripe.sql` | property_cache table, profiles.stripe_customer_id |
| `20250226000000_user_presets.sql` | user_presets table (presets feature) |
| `20250301000000_mobile_device_snapshots.sql` | Opt-in anonymous Expo/mobile device-class rows for analytics (`mobile_device_snapshots`) |

**Apply migrations:**

1. **Supabase Dashboard:** SQL Editor → paste and run each file in order.
2. **Supabase CLI:** `supabase db push` (if linked to project).

---

## Seed data

**There is no seed data in the repo.** Profiles are created automatically on signup via `handle_new_user` trigger. Optional dev seed example:

```sql
-- Optional: dev-only seed (run manually in SQL Editor)
-- Inserts a test user profile (requires existing auth.users row from Supabase Auth)
-- insert into public.profiles (id, email, full_name, plan)
-- values ('00000000-0000-0000-0000-000000000001', 'dev@test.com', 'Dev User', 'premium');
```

---

## Backup & restore

**Supabase managed backups:** Supabase Pro includes daily backups. See [Supabase Backups](https://supabase.com/docs/guides/platform/backups).

**Manual backup (pg_dump):**
```bash
# Get connection string from Supabase: Settings → Database → Connection string (URI)
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --schema=public \
  -F c \
  -f propertypulse_backup_$(date +%Y%m%d).dump
```

**Restore:**
```bash
pg_restore -d "postgresql://..." -c --if-exists propertypulse_backup_20250222.dump
```

---

## Storage (uploads/assets)

**There is no file upload or asset storage in the app.** Property data, scores, and profiles are stored in PostgreSQL. Static frontend assets (JS, CSS, images) are built into `dist/` and served by the frontend host (Vercel, etc.).

**To add S3-compatible storage (e.g. user avatars, property photos):**

1. Create a Supabase Storage bucket, or use S3/R2/Cloudflare R2.
2. Add upload logic in backend: `POST /api/upload` accepting multipart form data, returning a public URL.
3. Configure CORS on the bucket for your frontend origin.
4. For CDN: Use CloudFront (AWS), Cloudflare, or Supabase Storage CDN (included).

**Supabase Storage (recommended):** Already integrated; use `supabase.storage.from('bucket').upload()` from backend with service role. Bucket policies control public/private access.

---

## Connection pooling & limits

**Supabase:** Connection pooling is managed by Supabase. Use the **Pooler** connection string (port 6543) for serverless/backend that opens many short-lived connections. Direct connection (port 5432) for long-lived connections.

**Python backend:** Uses `supabase-py` (HTTP client), not direct PostgreSQL connections. No connection pool config in app. If you switch to raw `asyncpg`/`psycopg`, recommend:

- Pool size: 5–20 for typical backend
- Max overflow: 10
- Timeout: 30s

---

# Authentication & External Services

## Integrated third-party services

| Service | Purpose | Test/sandbox | Production |
|---------|---------|--------------|------------|
| **Supabase Auth** | User sign-up, sign-in, JWT | Same project; use test users | Production Supabase project |
| **Stripe** | Subscriptions, checkout, portal | `sk_test_*`, `pk_test_*` | `sk_live_*`, `pk_live_*` |
| **OpenAI** | Property search, AI insights | Same API key; monitor usage | Same; use org limits |
| **Google Ads / AdSense** | Ads for free users | Test ads in AdSense | Live client ID & slots |

**Endpoints:**
- Supabase: Project URL from dashboard (e.g. `https://xxx.supabase.co`)
- Stripe API: `https://api.stripe.com` (test/live via key)
- OpenAI: `https://api.openai.com`

---

## User auth flows

| Flow | Behavior |
|------|----------|
| **Sign up** | User submits email+password (or OAuth) on `/login` → Supabase `signUp()` → email confirmation (if enabled) → session created |
| **Sign in** | `signInWithPassword()` or `signInWithOAuth()` → Supabase returns session with `access_token` and `refresh_token` |
| **API calls** | Frontend sends `Authorization: Bearer <access_token>` to Python backend; backend verifies JWT with Supabase JWT secret |
| **Token refresh** | Supabase client auto-refreshes when `access_token` expires |
| **Logout** | `supabase.auth.signOut()` clears local session; no server-side blacklist |

**Token lifetimes (Supabase defaults):**
- Access token: 1 hour
- Refresh token: configurable (default ~2 weeks)
- Configurable in Supabase Dashboard → Authentication → Settings

**Session storage:** `localStorage` (Supabase client default). Keys: `supabase.auth.token`, etc.

---

# APIs & Integrations

## OpenAPI / Swagger

FastAPI exposes OpenAPI automatically:

| URL | Description |
|-----|-------------|
| `/docs` | Swagger UI (interactive) |
| `/redoc` | ReDoc |
| `/openapi.json` | Raw OpenAPI 3.0 schema |

**Base URL:** `{API_BASE_URL}/docs` (e.g. `https://api.yourapp.com/docs`)

---

## Webhook endpoints

### Stripe webhook

| Property | Value |
|----------|-------|
| **Path** | `POST /api/webhooks/stripe` |
| **Auth** | Stripe signature verification (`Stripe-Signature` header) |
| **Content-Type** | `application/json` |

**Request:** Raw Stripe event payload (do not parse JSON in middleware; `request.body()` is used for signature verification).

**Response:** `{"received": true}` with 200 on success.

**Handled events:**
- `checkout.session.completed` — sets `profiles.plan` and `profiles.stripe_customer_id`
- `customer.subscription.deleted` — sets `profiles.plan` to `free`, clears `stripe_customer_id`

**Retry logic:** Stripe retries failed webhooks (non-2xx) with exponential backoff. Return 200 quickly; do heavy work async if needed.

**Idempotency:** Stripe sends `id` in event. Store processed event IDs and skip duplicates if needed.

---

# Build / CI / CD

## CI/CD pipeline definitions

**None exist in the repo.** Example GitHub Actions workflows follow.

### Frontend: build & lint

```yaml
# .github/workflows/frontend.yml
name: Frontend
on:
  push:
    branches: [main]
    paths: ['src/**', 'package.json', 'package-lock.json', 'vite.config.js']
  pull_request:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm run lint
```

### Backend: build & lint

```yaml
# .github/workflows/backend.yml
name: Backend
on:
  push:
    branches: [main]
    paths: ['backend/**']
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: backend/requirements.txt
      - working-directory: backend
        run: |
          pip install -r requirements.txt
          python -c "from app.main import app; print('OK')"
```

### Docker build (optional)

```yaml
# .github/workflows/docker.yml
name: Docker
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: false
          tags: propertypulse-backend:latest
```

---

## Deployment steps

1. **Frontend (Vercel):** Connect repo → set env vars → deploy. Vercel builds on push to `main`.
2. **Backend (Railway/Render):** Connect repo, root `backend`, set env, deploy. Or push Docker image to registry and run.
3. **Supabase:** Migrations applied manually or via CLI. No deploy step.
4. **Stripe:** Webhook URL set in Dashboard; no deploy.

---

## Rollback procedure

| Component | Rollback |
|-----------|----------|
| **Vercel** | Dashboard → Deployments → select previous → Promote to Production |
| **Railway/Render** | Redeploy previous commit or rollback via dashboard |
| **Database** | Restore from backup if schema/data changed; otherwise no rollback needed |
| **Stripe** | Webhook changes are instant; revert Dashboard URL if needed |

---

## Tests in pipeline

**No test suites exist in the repo.** Commands to add:

| Layer | Command | When added |
|-------|---------|------------|
| **Frontend unit** | `npm run test` (e.g. Vitest) | Add `vitest` and test files |
| **Frontend lint** | `npm run lint` | ✅ Exists |
| **Backend unit** | `pytest` in `backend/` | Add `pytest`, `httpx`, test files |
| **Backend import** | `python -c "from app.main import app"` | ✅ Smoke check possible |
| **E2E** | `npm run test:e2e` (e.g. Playwright) | Add separately |

**Minimal pipeline:** Run `npm run build` and `npm run lint` (frontend), and `pip install -r requirements.txt` + import check (backend) to catch breakages before deploy.
