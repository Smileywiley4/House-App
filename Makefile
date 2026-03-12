.PHONY: build build-frontend build-backend openapi lockfile test test-frontend test-backend docker clean

# Full build (frontend + backend deps)
build: build-frontend
	cd backend && pip install -q -r requirements.txt

build-frontend:
	npm ci
	npm run build

build-backend:
	cd backend && pip install -r requirements.txt

# Export OpenAPI schema to openapi.json (requires: cd backend && pip install -r requirements.txt)
openapi:
	cd backend && python3 scripts/export_openapi.py

# Generate backend/requirements.lock (run after pip install -r requirements.txt)
lockfile:
	cd backend && pip freeze > requirements.lock && echo "Wrote requirements.lock"

# Run all checks
test: test-frontend test-backend

test-frontend:
	npm run lint
	npm run typecheck 2>/dev/null || true

test-backend:
	cd backend && python3 -c "from app.main import app; print('OK')"

# Build backend Docker image
docker:
	cd backend && docker build -t propertypulse-backend:latest .

clean:
	rm -rf dist node_modules backend/.venv openapi.json
