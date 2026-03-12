# Property Pulse — MVP launch checklist (e.g. Vercel)

Use this to ship a minimum viable product on a full-stack host like **Vercel** (frontend) plus a backend host.

---

## 1. Frontend on Vercel

- **Connect repo:** Vercel → Import Git repo → Framework Preset: **Vite**.
- **Build:** Vercel will use `vercel.json` (build command `npm run build`, output `dist`, SPA rewrites).
- **Env:** In Vercel project → Settings → Environment Variables, add for **Production** (and Preview if you want):

  | Name | Value |
  |------|--------|
  | `VITE_USE_PYTHON_BACKEND` | `true` |
  | `VITE_API_BASE_URL` | `https://your-backend.up.railway.app` (or your Python API URL) |
  | `VITE_SUPABASE_URL` | Supabase project URL |
  | `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
  | `VITE_GOOGLE_ADS_CLIENT_ID` | (optional) for ads |
  | `VITE_GOOGLE_ADS_SLOT_LEADERBOARD` | (optional) |

- **Deploy.** Your app will be at `https://your-project.vercel.app`. `/login` works with Supabase.

---

## 2. Backend (Python) on Railway or Render

Vercel does not run long-lived Python servers. Run the FastAPI backend elsewhere:

- **Railway:** New Project → Deploy from GitHub (select `backend/` or repo root and set root to `backend`). Add env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PREMIUM_PRICE_ID`, `STRIPE_REALTOR_PRICE_ID`, `OPENAI_API_KEY`, `CORS_ORIGINS` (include your Vercel URL, e.g. `https://your-project.vercel.app`). Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- **Render:** New Web Service → connect repo, Root Directory `backend`, Build `pip install -r requirements.txt`, Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Add same env vars; set CORS to your Vercel domain.

Use the deployed backend URL as `VITE_API_BASE_URL` in Vercel.

---

## 3. Supabase (production)

- Create a production project (or use existing) at [supabase.com](https://supabase.com).
- Run all migrations in `supabase/migrations/` in order (SQL Editor or `supabase db push`).
- In Authentication → URL Configuration, set **Site URL** to your Vercel URL and add it to **Redirect URLs** (e.g. `https://your-project.vercel.app/**`).
- Copy **Project URL**, **anon key**, **service_role key**, and **JWT Secret** (Settings → API) into backend env and frontend env (URL + anon only).

---

## 4. Stripe (optional for MVP)

- Create products/prices in Stripe for Premium and Realtor.
- Put **Price IDs** and **Secret key** in backend env.
- Webhook: Stripe Dashboard → Developers → Webhooks → Add endpoint: `https://your-backend-url/api/webhooks/stripe`, events `checkout.session.completed`, `customer.subscription.deleted`. Copy **Signing secret** into backend `STRIPE_WEBHOOK_SECRET`.

---

## 5. MVP “good enough” checklist

- [ ] Frontend deploys on Vercel and loads without errors.
- [ ] Backend deploys (Railway/Render) and `/health` returns `{"status":"ok"}`.
- [ ] Supabase migrations applied; Auth redirect URLs include your Vercel domain.
- [ ] User can open `/login`, sign up or sign in (email or Google if enabled), and land back on the app.
- [ ] User can search a property, see result, and (if logged in) score and save.
- [ ] Env vars set in Vercel (frontend) and in backend host; `VITE_API_BASE_URL` points at live backend.
- [ ] (Optional) Stripe webhook configured so upgrades set `profiles.plan`.

---

## 6. After launch

- Add **Privacy Policy** and **Terms of Service** pages and links (footer or signup).
- Configure a **custom domain** in Vercel and add it to Supabase redirect URLs and backend CORS.
- Prefer **Stripe live keys** and **Supabase production**; keep test keys for preview envs only.
