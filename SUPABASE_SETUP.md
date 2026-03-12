# Transfer Property Pulse to Supabase

Step-by-step guide to connect and run the app with a Supabase project.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Pick an org, name the project (e.g. `propertypulse`), set a database password
4. Choose a region and create the project

---

## 2. Run database migrations

Apply migrations in order (oldest → newest) in **SQL Editor**:

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase/migrations/20250222000000_propertypulse_schema.sql` | profiles, property_scores, clients, private_listings |
| 2 | `supabase/migrations/20250222100000_property_cache_and_stripe.sql` | property_cache, stripe_customer_id |
| 3 | `supabase/migrations/20250226000000_user_presets.sql` | user_presets (presets feature) |

**Steps:**

1. Open Supabase Dashboard → **SQL Editor**
2. Create a new query
3. Copy the contents of each migration file
4. Run it
5. Repeat for the next file

**Or use Supabase CLI (if installed):**

```bash
# Install: npm i -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push
```

---

## 3. Get Supabase keys

In Supabase Dashboard → **Project Settings** → **API**:

| Key | Where to use |
|-----|--------------|
| **Project URL** | Frontend + Backend |
| **anon (public)** | Frontend + Backend |
| **service_role** | Backend only (never expose to frontend) |

In **Project Settings** → **API** → **JWT Settings**:

| Key | Where to use |
|-----|--------------|
| **JWT Secret** | Backend (for token verification) |

---

## 4. Configure the frontend

Create `.env.local` in the project root:

```bash
# Use Python backend + Supabase
VITE_USE_PYTHON_BACKEND=true
VITE_API_BASE_URL=http://localhost:8000

# Supabase (required)
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

For **production** (e.g. Vercel), set these in the host’s environment variables. `VITE_API_BASE_URL` must be your deployed backend URL.

---

## 5. Configure the backend

Create `backend/.env`:

```bash
# Supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# From Supabase → Settings → API → JWT Secret
SUPABASE_JWT_SECRET=your-jwt-secret

# Optional for MVP
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
OPENAI_API_KEY=sk-...

# Allow frontend origin
CORS_ORIGINS=http://localhost:5173,https://your-vercel-app.vercel.app
```

---

## 6. Auth redirect URLs

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Set **Site URL** to your app URL (e.g. `http://localhost:5173` or your Vercel URL)
3. Add **Redirect URLs**:
   - `http://localhost:5173/**`
   - `https://your-vercel-app.vercel.app/**` (for production)

---

## 7. Run locally

**Terminal 1 – Frontend:**

```bash
npm install
npm run dev
```

**Terminal 2 – Backend:**

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:5173. Sign up or log in (Supabase Auth), then search and score properties.

---

## 8. Deploy to production

| Component | Host | Notes |
|-----------|------|-------|
| **Frontend** | Vercel | Connect repo, add env vars, deploy |
| **Backend** | Railway, Render, Fly.io | Connect repo, root `backend`, add env vars |
| **Database** | Supabase | Migrations applied in step 2 |

Use production URLs in `CORS_ORIGINS` and Supabase redirect URLs. See [LAUNCH.md](LAUNCH.md) for the full checklist.

---

## Quick reference

| Env var | Frontend | Backend |
|---------|----------|---------|
| `VITE_SUPABASE_URL` | ✅ | — |
| `VITE_SUPABASE_ANON_KEY` | ✅ | — |
| `SUPABASE_URL` | — | ✅ |
| `SUPABASE_ANON_KEY` | — | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | — | ✅ |
| `SUPABASE_JWT_SECRET` | — | ✅ |
| `VITE_API_BASE_URL` | ✅ | — |
