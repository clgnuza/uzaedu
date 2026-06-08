#!/usr/bin/env bash
set -euo pipefail
ROOT="${UZAEDU_REPO_ROOT:-${DEPLOY_REMOTE_ROOT:-/opt/uzaedu}}"
BRANCH="${DEPLOY_GIT_BRANCH:-main}"
cd "$ROOT"
echo "[deploy] repo=$ROOT branch=$BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

npm_ci_build() {
  local dir="$1"
  local build_cmd="$2"
  ( cd "$dir"
    if [[ -d dist ]]; then rm -rf dist; fi
    if [[ -f .next/lock ]]; then rm -f .next/lock; fi
    unset NODE_ENV
    if ! npm ci --jobs=1; then
      echo "[deploy] npm ci retry ($dir): rm node_modules"
      rm -rf node_modules
      npm ci --jobs=1
    fi
    eval "$build_cmd" )
}

echo "[deploy] backend npm ci + build"
npm_ci_build "$ROOT/backend" "npm run build"

if [[ "${MIGRATE_ON_DEPLOY:-0}" == "1" || "${MIGRATE_ON_DEPLOY:-0}" == "true" ]]; then
  (cd "$ROOT/backend" && npm run migrate:sql)
fi

echo "[deploy] web-admin npm ci + build"
npm_ci_build "$ROOT/web-admin" "NODE_ENV=production npm run build"

NGINX_CONF="$ROOT/infra/nginx/uzaedu.conf"
if [[ -f "$NGINX_CONF" ]] && command -v nginx &> /dev/null; then
  cp "$NGINX_CONF" /etc/nginx/sites-available/uzaedu
  nginx -t && systemctl reload nginx
fi

PM2_ENV="$ROOT/scripts/deploy/pm2.env"
[[ -f "$PM2_ENV" ]] && set -a && source "$PM2_ENV" && set +a
export UZAEDU_BACKEND_ROOT="${UZAEDU_BACKEND_ROOT:-$ROOT/backend}"
export UZAEDU_WEB_ROOT="${UZAEDU_WEB_ROOT:-$ROOT/web-admin}"
pm2 startOrReload "$ROOT/backend/tools/pm2-ecosystem.config.cjs" --update-env
pm2 save 2>/dev/null || true
echo "[deploy] OK"