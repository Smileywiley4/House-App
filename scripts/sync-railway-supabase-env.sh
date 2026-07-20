#!/usr/bin/env bash
# Push local Supabase + Google Sheets secrets to Railway (backend).
# One-time: export RAILWAY_TOKEN=...  (Railway → Account → Tokens)
# Or: npx @railway/cli login
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

if [[ ! -f .env ]]; then
  echo "backend/.env missing" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source <(grep -E '^(SUPABASE_|GOOGLE_MARKETING_SHEET_ID|GOOGLE_SHEETS_SA_JSON|CORS_ORIGINS|APP_PUBLIC_URL)=' .env | sed 's/\r$//')
set +a

: "${SUPABASE_URL:?}"
: "${SUPABASE_ANON_KEY:?}"
: "${SUPABASE_SERVICE_ROLE_KEY:?}"
: "${SUPABASE_JWT_SECRET:?}"

if ! npx --yes @railway/cli whoami >/dev/null 2>&1; then
  echo "Railway CLI not logged in."
  echo "Run: npx @railway/cli login"
  echo "Then re-run this script."
  exit 1
fi

npx --yes @railway/cli variables set \
  "SUPABASE_URL=${SUPABASE_URL}" \
  "SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}" \
  "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}" \
  "SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}" \
  "GOOGLE_MARKETING_SHEET_ID=${GOOGLE_MARKETING_SHEET_ID:-}" \
  ${GOOGLE_SHEETS_SA_JSON:+"GOOGLE_SHEETS_SA_JSON=${GOOGLE_SHEETS_SA_JSON}"} \
  ${CORS_ORIGINS:+"CORS_ORIGINS=${CORS_ORIGINS}"} \
  ${APP_PUBLIC_URL:+"APP_PUBLIC_URL=${APP_PUBLIC_URL}"}

echo "Railway variables updated. Triggering redeploy..."
npx --yes @railway/cli up --detach || npx --yes @railway/cli redeploy --yes || true
echo "Done."
