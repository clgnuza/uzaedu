#!/usr/bin/env bash
# Run from repo root (e.g. /opt/uzaedu): backend + web-admin npm ci/build, pm2 restart.
# Do not set NODE_ENV=production before npm ci - it skips devDependencies (nest CLI, Next types, etc.).
#
# Optional: MIGRATE_ON_DEPLOY=1 -> backend npm run migration:run (schema).
# Optional: DOMAIN_API, DOMAIN_SITE (default: api.uzaedu.com, uzaedu.com) -> web-admin/.env.production NEXT_PUBLIC_SITE_URL
# Optional: DOMAIN_ADMIN (default: admin.uzaedu.com) — yalnızca log; admin host nginx ile köke yönlendirilir.
# Data SQL local->prod: backend/tools/DEPLOY-LOCAL-TO-PROD.txt
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
BRANCH="${DEPLOY_BRANCH:-main}"
DOMAIN_API="${DOMAIN_API:-api.uzaedu.com}"
DOMAIN_ADMIN="${DOMAIN_ADMIN:-admin.uzaedu.com}"
DOMAIN_SITE="${DOMAIN_SITE:-uzaedu.com}"
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

GIT_SHA_SHORT="$(git rev-parse --short HEAD)"
if [ -f backend/.env ]; then
  sed -i '/^DEPLOY_GIT_SHA=/d' backend/.env
  echo "DEPLOY_GIT_SHA=$GIT_SHA_SHORT" >> backend/.env
fi
export DEPLOY_GIT_SHA="$GIT_SHA_SHORT"

(cd backend && npm ci && npm run build)
(
  cd web-admin
  printf '%s\n' "NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN_API}/api" "NEXT_PUBLIC_SITE_URL=https://${DOMAIN_SITE}" > .env.production
  npm ci && npm run build
)
if [ "${MIGRATE_ON_DEPLOY:-}" = "1" ] || [ "${MIGRATE_ON_DEPLOY:-}" = "true" ]; then
  echo "[deploy] migration:run (MIGRATE_ON_DEPLOY)"
  (cd backend && npm run migration:run)
fi
export NODE_ENV=production
pm2 restart all --update-env
pm2 save
echo "[deploy] OK $(date -Iseconds) branch=$BRANCH sha=$GIT_SHA_SHORT root=$ROOT api=https://${DOMAIN_API} site=https://${DOMAIN_SITE} admin_host=https://${DOMAIN_ADMIN}"