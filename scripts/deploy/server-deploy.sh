#!/usr/bin/env bash
# Run from repo root (e.g. /opt/uzaedu): backend + web-admin npm ci/build, pm2 restart.
# Do not set NODE_ENV=production before npm ci — it skips devDependencies (nest CLI, Next types, etc.).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
BRANCH="${DEPLOY_BRANCH:-main}"
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

GIT_SHA_SHORT="$(git rev-parse --short HEAD)"
if [ -f backend/.env ]; then
  sed -i '/^DEPLOY_GIT_SHA=/d' backend/.env
  echo "DEPLOY_GIT_SHA=$GIT_SHA_SHORT" >> backend/.env
fi
export DEPLOY_GIT_SHA="$GIT_SHA_SHORT"

(cd backend && npm ci && npm run build)
(cd web-admin && npm ci && npm run build)
export NODE_ENV=production
pm2 restart all --update-env
pm2 save
echo "[deploy] OK $(date -Iseconds) branch=$BRANCH sha=$GIT_SHA_SHORT root=$ROOT"
