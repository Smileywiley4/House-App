# Hand-off package — Property Pulse

This doc lists all artifacts for migration or hand-off. Create a **ZIP** or **branch** containing the repo and use this as the index.

---

## Deployment checklist (README)

Use the checklist below before going live. Full details: [LAUNCH.md](LAUNCH.md).

- [ ] **Frontend:** Deploy to Vercel; set env (`VITE_USE_PYTHON_BACKEND`, `VITE_API_BASE_URL`, `VITE_SUPABASE_*`)
- [ ] **Backend:** Deploy to Railway/Render/Docker; set env (Supabase, Stripe, OpenAI, `CORS_ORIGINS`)
- [ ] **Supabase:** Run migrations; set Auth redirect URLs; use production keys
- [ ] **Stripe:** Configure webhook; use live keys in production
- [ ] **Smoke test:** Login, search property, save score, checkout (if Stripe configured)

---

## Artifact index

| Artifact | Location | Notes |
|----------|----------|-------|
| **README** | [README.md](README.md) | Quick start, architecture summary, project structure |
| **Deployment checklist** | [LAUNCH.md](LAUNCH.md), this doc | Step-by-step deploy |
| **Dockerfile** | [backend/Dockerfile](backend/Dockerfile) | Backend image |
| **Build scripts** | [Makefile](Makefile), `package.json` scripts | `make build`, `npm run build` |
| **Lockfiles** | `package-lock.json`, `backend/requirements.lock` | npm + pip; generate lock with `make lockfile` |
| **Migrations** | [supabase/migrations/](supabase/migrations/) | Run in order |
| **Example .env** | [.env.example](.env.example), [backend/.env.example](backend/.env.example) | No secrets |
| **OpenAPI spec** | [openapi.json](openapi.json) | Static export; regenerate with `make openapi` |
| **Test commands** | See [Testing](#testing) | `npm run lint`, `make test-backend` |
| **Architecture diagram** | [ARCHITECTURE.md](ARCHITECTURE.md) | ASCII diagram, data flow |
| **CI/CD** | [.github/workflows/](.github/workflows/) | frontend.yml, backend.yml |

---

## Build commands

| Target | Command |
|--------|---------|
| Frontend build | `npm ci && npm run build` |
| Backend run | `cd backend && pip install -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| Docker build | `cd backend && docker build -t propertypulse-backend:latest .` |

---

## Testing

| Layer | Command |
|-------|---------|
| Frontend lint | `npm run lint` |
| Frontend typecheck | `npm run typecheck` |
| Backend import | `cd backend && python -c "from app.main import app; print('OK')"` |
| Backend (if pytest added) | `cd backend && pytest` |

No unit or e2e tests exist yet. Add `vitest` (frontend) and `pytest` (backend) when needed.

---

## Creating the hand-off package

### Option A: ZIP

```bash
# From repo root (exclude node_modules, .venv, .env)
zip -r propertypulse-handoff.zip . \
  -x "node_modules/*" -x ".venv/*" -x "*.env" -x ".env.*" -x "dist/*" -x ".git/*"
```

### Option B: Branch

```bash
git checkout -b handoff/propertypulse-v1
git add -A
git commit -m "Hand-off package v1"
git push origin handoff/propertypulse-v1
```

Then archive the branch (e.g. GitHub → Download ZIP) or share the branch name.

---

## Legal protection & ownership

See [LEGAL_AND_OWNERSHIP.md](LEGAL_AND_OWNERSHIP.md) for guidance on:

- Copyright and LICENSE
- Keeping the repo and secrets secure
- Contracts (CLA, NDA, ToS, Privacy Policy)
- Hand-off agreements

**Before hand-off:** Update `LICENSE` with your name/company and year. Do not include `.env` or real secrets in the package.

---

## Related docs

- [PROJECT_ARTIFACTS.md](PROJECT_ARTIFACTS.md) — Build artifacts, deps, env
- [DATABASES_AND_OPERATIONS.md](DATABASES_AND_OPERATIONS.md) — DB, auth, APIs, CI/CD
- [OBSERVABILITY_AND_FRONTEND.md](OBSERVABILITY_AND_FRONTEND.md) — Logging, security, frontend
- [ARCHITECTURE.md](ARCHITECTURE.md) — Diagram, code locations, onboarding
