#!/usr/bin/env bash
# Canlı sunucu (/opt/uzaedu): git pull, backend/web build, pm2.
# Tetikleyiciler: GitHub Actions deploy-production.yml, panel POST /api/deploy/run (DEPLOY_SCRIPT_PATH).
# UZAEDU_SKIP_GIT_PULL=1: git adimini atla (CI once cekmis ise).
# MIGRATE_ON_DEPLOY=1 → backend migration:run
# DEPLOY_GIT_BRANCH (varsayılan main)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_GIT_BRANCH:-main}"
export NODE_ENV="${NODE_ENV:-production}"

echo "[deploy] repo=$ROOT branch=$BRANCH"

if [[ -z "${UZAEDU_SKIP_GIT_PULL:-}" ]]; then
  git fetch origin "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

echo "[deploy] backend install + build"
(cd "$ROOT/backend" && npm ci && npm run build)

if [[ "${MIGRATE_ON_DEPLOY:-0}" == "1" ]]; then
  echo "[deploy] migration:run"
  (cd "$ROOT/backend" && npm run migration:run)
fi

echo "[deploy] web-admin install + build"
(cd "$ROOT/web-admin" && npm ci && npm run build)

echo "[deploy] pm2"
pm2 restart uzaedu-api --update-env
pm2 restart uzaedu-web --update-env
pm2 save

echo "[deploy] done"