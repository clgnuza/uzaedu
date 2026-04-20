#!/usr/bin/env bash
# Hetzner /opt/uzaedu: git pull, backend+web build, pm2. Panel POST /api/deploy ile ayni betik.
set -euo pipefail

ROOT="${UZAEDU_REPO_ROOT:-${DEPLOY_REMOTE_ROOT:-/opt/uzaedu}}"
BRANCH="${DEPLOY_GIT_BRANCH:-main}"
cd "$ROOT"

echo "[deploy] repo=$ROOT branch=$BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[deploy] backend npm ci + build"
(
  cd "$ROOT/backend"
  npm ci
  npm run build
)
if [[ "${MIGRATE_ON_DEPLOY:-0}" == "1" || "${MIGRATE_ON_DEPLOY:-0}" == "true" ]]; then
  echo "[deploy] migrate:sql"
  (cd "$ROOT/backend" && npm run migrate:sql)
fi

echo "[deploy] web-admin npm ci + build"
(
  cd "$ROOT/web-admin"
  npm ci
  npm run build
)

echo "[deploy] pm2 restart"
pm2 restart uzaedu-api --update-env 2>/dev/null || pm2 restart uzaedu-api || true
if pm2 describe uzaedu-web >/dev/null 2>&1; then
  pm2 restart uzaedu-web --update-env || pm2 restart uzaedu-web || true
fi
pm2 save 2>/dev/null || true
echo "[deploy] OK"
