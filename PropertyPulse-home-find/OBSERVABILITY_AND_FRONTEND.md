# Observability & Operations

## Logging

### Current state

| Component | Location | Format |
|-----------|----------|--------|
| **Frontend** | Browser console (`console.log`/`console.error`) | Unstructured |
| **Backend** | stdout (uvicorn default) | Uvicorn access logs + Python tracebacks |

No structured logging (JSON), log aggregation, or centralized storage is configured.

### Recommended format (backend)

For production, configure JSON-structured logs:

```
{"timestamp":"2025-02-22T12:00:00Z","level":"INFO","message":"Request completed","method":"GET","path":"/api/auth/me","status":200,"duration_ms":45}
```

Use `structlog` or `loguru` with a JSON sink. Example (add to backend when needed):

```python
# Example: structlog JSON
import structlog
structlog.configure(processors=[structlog.processors.JSONRenderer()])
log = structlog.get_logger()
log.info("request", method="GET", path="/api/auth/me", status=200)
```

### Retention guidance

| Environment | Retention |
|-------------|-----------|
| Development | None (console only) |
| Production | 30–90 days (platform-dependent: Vercel, Railway, Render retain logs per their plans) |

For long-term retention, ship logs to Datadog, Logtail, or CloudWatch.

---

## Metrics & monitoring

### Current state

**No metrics endpoints** (Prometheus, StatsD, etc.) are exposed. No dashboards or alerting is configured.

### Recommended: Prometheus metrics

Add to backend when needed:

```python
# pip install prometheus-fastapi-instrumentator
from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app)
# Exposes /metrics
```

### Recommended dashboards (when metrics exist)

| Dashboard | Metrics |
|-----------|---------|
| **Request rate & latency** | `http_requests_total`, `http_request_duration_seconds` |
| **Errors** | `http_requests_total{status=~"5.."}` |
| **Stripe webhook** | Custom counter for `checkout.session.completed`, `customer.subscription.deleted` |

### Alert recommendations

- Backend 5xx rate > 1% over 5 minutes
- Health check failing for 2+ consecutive checks
- Stripe webhook failure rate > 0

---

## Health, readiness, liveness

### Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /health` | Liveness + basic health | `200 {"status":"ok"}` |

**Path:** `{API_BASE_URL}/health` (e.g. `https://api.yourapp.com/health`)

### Readiness vs liveness

- **Liveness:** Process is running. Use `GET /health`. Returns 200 if the app responds.
- **Readiness:** App can accept traffic (DB reachable, etc.). Currently not separated.

**Recommended readiness endpoint** (add when needed):

```python
@app.get("/ready")
def ready():
    # Optional: ping Supabase to verify connectivity
    return {"status": "ok"}
```

Kubernetes/Docker: use `/health` for both `livenessProbe` and `readinessProbe`, or add `/ready` for readiness.

---

# Security & Compliance

## Known considerations

| Area | Status |
|------|--------|
| **Secrets in code** | None; use env vars only |
| **SQL injection** | Supabase client uses parameterized queries |
| **XSS** | React escapes by default; no `dangerouslySetInnerHTML` for user input |
| **CSRF** | Stateless API; JWT in header. Stripe webhook uses signature verification |
| **Dependency CVEs** | Run `npm audit` (frontend) and `pip-audit` or `safety` (backend) periodically |

### Data classification

| Data | Sensitivity | Storage |
|------|-------------|---------|
| Email, full name | PII | Supabase `profiles` |
| Property scores, preferences | User data | Supabase `property_scores`, `profiles.default_weights` |
| Stripe customer ID | Financial linkage | Supabase `profiles` |
| JWT / tokens | Session | Client localStorage, not stored server-side |

No PCI DSS scope (Stripe handles payment card data). GDPR considerations: support data export and deletion.

---

## TLS / HTTPS

| Component | TLS |
|-----------|-----|
| **Frontend (Vercel)** | HTTPS by default |
| **Backend (Railway/Render)** | HTTPS via platform |
| **Supabase** | HTTPS only |
| **Stripe** | HTTPS only |

No custom TLS configuration in app. Ensure production URLs use `https://`.

---

## CORS configuration

**Backend:** `CORS_ORIGINS` env var (comma-separated). Set to production frontend origin(s).

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=s.cors_list,  # From CORS_ORIGINS
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Production:** Set `CORS_ORIGINS=https://yourapp.com,https://www.yourapp.com`. Do not use `*` with `allow_credentials=True`.

---

## CSP (Content Security Policy)

**No CSP headers** are set. To add (via Vercel headers or CDN):

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.google.com"
        }
      ]
    }
  ]
}
```

Adjust for Google Ads, Supabase, Stripe, and any other third-party domains. Test thoroughly after adding.

---

# Frontend Specifics

## Production build

| Item | Value |
|------|-------|
| **Command** | `npm run build` |
| **Output directory** | `dist/` |
| **Entry** | `index.html` → `src/main.jsx` |

---

## Route base path & public assets

| Item | Value |
|------|-------|
| **Base path** | `/` (root) |
| **Public asset path** | `/assets/` (Vite default) |
| **Config** | `vite.config.js` — no `base` or `build.assetsDir` override |

To deploy under a subpath (e.g. `/app/`):

```js
// vite.config.js
export default defineConfig({
  base: '/app/',
  // ...
});
```

Then `npm run build`; assets and routes will be relative to `/app/`.

---

## SPA vs SSR

| Mode | Behavior |
|------|----------|
| **Current** | SPA only. Vite produces static HTML + JS; React renders client-side after load |
| **SSR** | Not implemented |

**Required server-side rendering steps:** None. The app is a pure SPA. For SEO, consider pre-rendering (e.g. `vite-plugin-ssr`, Prerender.io) or migrating to Next.js if needed.

---

## Static asset versioning & cache-busting

| Mechanism | How |
|-----------|-----|
| **Vite** | Outputs hashed filenames for JS/CSS (e.g. `assets/index-a1b2c3d4.js`) |
| **Cache headers** | `vercel.json`: `/assets/*` → `Cache-Control: public, max-age=31536000, immutable` |
| **HTML** | No cache (`Cache-Control` not set for `index.html`); CDN default or explicit `no-cache` recommended |

**Strategy:**
- `index.html`: short or no cache so users get the latest entry point
- `/assets/*`: immutable, 1-year cache (hash in filename guarantees new file on deploy)
