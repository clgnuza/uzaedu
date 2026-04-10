#!/usr/bin/env bash
# /opt/uzaedu: git pull, backend+web build, pm2. Triggers: Actions, panel POST /deploy/run.
# UZAEDU_SKIP_GIT_PULL=1: skip git (CI already pulled). MIGRATE_ON_DEPLOY=1: run migrations.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_GIT_BRANCH:-main}"

echo "[deploy] repo=$ROOT branch=$BRANCH"

if [[ -z "${UZAEDU_SKIP_GIT_PULL:-}" ]]; then
  git fetch origin "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

echo "[deploy] backend install + build"
rm -rf "$ROOT/backend/node_modules"
(cd "$ROOT/backend" && unset NODE_ENV && npm ci --jobs=1 && npm run build)

if [[ "${MIGRATE_ON_DEPLOY:-0}" == "1" ]]; then
  echo "[deploy] migration:run"
  (cd "$ROOT/backend" && npm run migration:run)
fi

echo "[deploy] web-admin install + build"
rm -rf "$ROOT/web-admin/node_modules"
rm -f "$ROOT/web-admin/.next/lock"
(cd "$ROOT/web-admin" && unset NODE_ENV && npm ci --jobs=1 && NODE_ENV=production npm run build)

echo "[deploy] pm2"
pm2 restart uzaedu-api --update-env
pm2 restart uzaedu-web --update-env
pm2 save

echo "[deploy] done"