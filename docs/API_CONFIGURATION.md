# API configuration reference

Configure **backend** variables in `backend/.env` (copy from `backend/.env.example`).  
Configure **frontend** variables in `.env` or `.env.local` at the repo root (`ALL/`) — see root `.env.example`.

Enable Google APIs on the **same GCP project** as your service account or API keys where applicable.

---

## Frontend (Vite) — required for app + integrations

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `VITE_USE_SUPABASE` | `true` to use Supabase auth/data |
| `VITE_USE_PYTHON_BACKEND` | `true` to call FastAPI for LLM, Google proxies, library, invites, etc. |
| `VITE_API_BASE_URL` | FastAPI origin, e.g. `http://localhost:8000` (no trailing slash) |

Optional:

| Variable | Purpose |
|----------|---------|
| `VITE_GOOGLE_ANALYTICS_HUB_API_VERSION` | `v1` (default) or `v1beta1` — must match paths you call |
| `VITE_GOOGLE_ADS_CLIENT_ID` | AdSense / display ads client slot setup |
| `VITE_GOOGLE_ADS_SLOT_LEADERBOARD` / `VITE_GOOGLE_ADS_SLOT_INFEED` / optional `VITE_GOOGLE_ADS_SLOT_RECTANGLE` | Ad unit slots (or `VITE_GOOGLE_ADS_SLOT_1` / `_2`) |
| `VITE_GOOGLE_ADS_DEMO` | Optional. `false` disables dev auto sample IDs. `true` forces sample test ads even outside dev (avoid in production). |
| `VITE_SITE_URL` | Production origin **no trailing slash** — canonical URLs, JSON-LD, `postbuild` **sitemap.xml** |
| `VITE_OG_IMAGE_URL` | Optional full **https** URL to a 1200×630 image for Open Graph / Twitter cards |
| `VITE_BASE44_APP_ID` / `VITE_BASE44_BACKEND_URL` / `VITE_BASE44_APP_BASE_URL` / `VITE_BASE44_FUNCTIONS_VERSION` | Base44 platform (if used) |

---

## Backend — core (auth, billing, LLM)

| Keys / env vars | Used for |
|-----------------|----------|
| `SUPABASE_*`, `SUPABASE_JWT_SECRET` | DB, JWT validation, user id for routes |
| `STRIPE_*` | Checkout, webhooks, plans |
| `REVENUECAT_WEBHOOK_SECRET`, `REVENUECAT_*_ENTITLEMENT_ID` | iOS IAP entitlement sync webhook (`POST /api/webhooks/revenuecat`) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | LLM (`ANTHROPIC` preferred if both set) |
| `ANTHROPIC_MODEL` | Optional. Messages API model id (default `claude-sonnet-4-20250514` in `config.py`) |
| `ANTHROPIC_PROMPT_CACHE_EPHEMERAL` | `true` (default): send `cache_control: {type: ephemeral}` on Anthropic requests — [prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) |
| `CORS_ORIGINS` | Allowed browser origins (comma-separated) |
| `APP_PUBLIC_URL` | Invite links, Stripe checkout success/cancel & billing portal return URL |
| `PLATFORM_ADMIN_USER_IDS` | Comma-separated Supabase user UUIDs — AdSense revenue sync & other platform-only tools (see `require_platform_admin`) |
| `PORT` | Uvicorn port |

---

## Backend — property records and exterior imagery

Exact-address search uses Google for location verification and RentCast for licensed US property and active sale-listing facts.

| Env var | Purpose |
|---------|---------|
| `RENTCAST_API_KEY` | Property records, taxes, sale history, attributes, and active listing price/status. Create at [RentCast API](https://app.rentcast.io/app/api). |
| `RENTCAST_BASE_URL` | Optional; defaults to `https://api.rentcast.io/v1`. |
| `GOOGLE_STREET_VIEW_API_KEY` | Optional dedicated server key for exterior imagery. Enable **Street View Static API**. If blank, the Places key is used. |

The frontend never receives either key. `GET /api/property/street-view` proxies Street View images without storing or caching them. Property-owner data returned by RentCast is intentionally excluded from public responses. Listing-site photo scraping is disabled; users can upload photos they own, and licensed MLS/IDX media can be added later.

---

## Backend — Google (server-side keys & proxies)

All integration routes are under **`/api/integrations`** unless noted. Most Google proxies require the user’s JWT and **`admin` plan** (or **`PLATFORM_ADMIN_USER_IDS`**) — see `require_admin_plan` in each router. Publisher revenue routes use **`require_platform_admin`** (same rules).

### API key (no SA file)

| Env vars | Proxy / feature |
|----------|-----------------|
| `GOOGLE_PLACES_API_KEY` | Geocoding, Places, property features |
| `GOOGLE_AMP_URL_API_KEY` | Optional; else Places key — AMP URL batch (`POST /api/integrations/google/amp-url/batch-get`) |
| `GOOGLE_CSE_ID` + Places key | Custom Search (property web context) |

#### Google Auto-Score (Evaluate / Quick Compare)

Deterministic scores from distances and counts — **no LLM**. Backend: `POST /api/property/autoscore` with `{ "address": "..." }` (uses `get_autoscore_data` in `google_places.py`).

| Requirement | Details |
|-------------|---------|
| Env | `GOOGLE_PLACES_API_KEY` in **`backend/.env`** |
| Google Cloud | Same project as the key: enable **Geocoding API** and **Places API** (includes legacy [Nearby Search](https://developers.google.com/maps/documentation/places/web-service/search-nearby)) |
| Frontend | `VITE_USE_PYTHON_BACKEND=true` and `VITE_API_BASE_URL` pointing at FastAPI so `api.property.autoscore` hits the backend |
| Cache | Results stored in Supabase `property_cache` (needs working `SUPABASE_*` on the backend) |

If geocoding fails (wrong/missing APIs or key), the endpoint returns **503** with a short setup hint.

### OAuth refresh token (user / publisher account)

| Env vars | Proxy prefix |
|----------|----------------|
| `GOOGLE_ADSENSE_*` (+ `GOOGLE_ADSENSE_ACCESS`, optional `GOOGLE_ADSENSE_PUBLISHER_ACCOUNT`) | `/api/integrations/google/adsense/...` |
| *(same AdSense OAuth vars)* | `/api/integrations/google/adsense-platform/v1alpha/...` (writes need `readwrite`) |
| *(same AdSense OAuth)* | **`POST /api/integrations/revenue/adsense-daily-snapshot`** (admin) — stores yesterday’s **estimated** earnings in `publisher_revenue_snapshots` (does **not** pay Stripe; see **`docs/PUBLISHER_REVENUE_ADSENSE_STRIPE.md`**) |
| `GOOGLE_DOUBLECLICKSEARCH_*` | `/api/integrations/google/doubleclicksearch/v2/{path}` |

### Service account JSON (`*_SA_JSON_PATH`)

| Env vars | Proxy prefix / notes |
|----------|------------------------|
| `GOOGLE_WORKSPACE_*` + delegation | `/api/integrations/google/workspace/datatransfer/...` |
| `GOOGLE_ANALYTICS_HUB_*` | `/api/integrations/google/analytics-hub/{v1\|v1beta1}/...` |
| `GOOGLE_ANDROID_MANAGEMENT_SA_JSON_PATH` | `/api/integrations/google/android-management/v1/...` |
| `GOOGLE_CHAT_*` | `/api/integrations/google/chat/v1/...` |
| `GOOGLE_CHROME_WEBSTORE_*` | `/api/integrations/google/chromewebstore/v2/...` |
| `GOOGLE_DATA_FUSION_*` | `/api/integrations/google/data-fusion/v1/...` and `v1beta1/...` |
| `GOOGLE_DATAMANAGER_*` | `/api/integrations/google/datamanager/v1/...` |
| `GOOGLE_DRIVE_*` | `/api/integrations/google/drive/v3/...`, `upload/v3/...`, `resumable/v3/...` |
| `GOOGLE_FILESTORE_*` | `/api/integrations/google/filestore/v1/...` and `v1beta1/...` |
| `GOOGLE_OSLOGIN_*` | `/api/integrations/google/oslogin/v1/...` and `v1beta/...` |
| `GOOGLE_TRANSLATE_*` | `/api/integrations/google/translate/v3/...` and `v3beta1/...` |
| `GOOGLE_POLICYANALYZER_*` | `/api/integrations/google/policyanalyzer/v1/...` |
| `GOOGLE_POLICYSIMULATOR_*` | `/api/integrations/google/policysimulator/v1/...` and `v1beta/...` |
| `GOOGLE_SAASSERVICEMGMT_*` | `/api/integrations/google/saasservicemgmt/v1/...` and `v1beta1/...` |
| `GOOGLE_SERVICENETWORKING_*` | `/api/integrations/google/servicenetworking/v1/...` |

Optional `*_BASE_URL` on each integration overrides the default Google hostname (host only, no path).

---

## Health check

`GET /health` on the backend returns booleans such as `google_*_configured` for each major integration (credentials present).

---

## Quick start checklist

1. Copy `backend/.env.example` → `backend/.env` and fill Supabase + at least one LLM key for core features.  
2. Copy root `.env.example` → `.env.local` and set `VITE_*` flags + API base URL.  
3. Match `CORS_ORIGINS` and `APP_PUBLIC_URL` to your Vite dev or production origin.  
4. Add Google env blocks only for APIs you actually call; enable each API in Google Cloud Console.
