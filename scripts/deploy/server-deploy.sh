#!/usr/bin/env bash
# Run from repo root (e.g. /opt/uzaedu): backend + web-admin npm ci/build, pm2 restart.
# Do not set NODE_ENV=production before npm ci — it skips devDependencies (nest CLI, Next types, etc.).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
BRANCH="${DEPLOY_BRANCH:-main}"
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"
(cd backend && npm ci && npm run build)
(cd web-admin && npm ci && npm run build)
export NODE_ENV=production
pm2 restart all
pm2 save
echo "[deploy] OK $(date -Iseconds) branch=$BRANCH root=$ROOT"