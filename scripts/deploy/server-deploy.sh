#!/usr/bin/env bash
set -euo pipefail
unset NODE_ENV
export NPM_CONFIG_PRODUCTION=false
ROOT="${UZAEDU_REPO_ROOT:-${DEPLOY_REMOTE_ROOT:-/opt/uzaedu}}"
BRANCH="${DEPLOY_GIT_BRANCH:-main}"
cd "$ROOT"
echo "[deploy] repo=$ROOT branch=$BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[deploy] pm2 stop (build oncesi)"
pm2 stop uzaedu-api uzaedu-web 2>/dev/null || true

npm_ci_build() {
  local dir="$1"
  local build_cmd="$2"
  ( cd "$dir"
    unset NODE_ENV
    export NPM_CONFIG_PRODUCTION=false
    if [[ "$dir" == *"/backend" ]]; then
      if [[ -d dist ]]; then find dist -mindepth 1 -delete 2>/dev/null || true; rm -rf dist; fi
      rm -rf node_modules
    fi
    if [[ "$dir" == *"/web-admin" ]]; then rm -f .next/lock; fi
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

GIT_SHA_SHORT="$(git rev-parse --short HEAD)"
if [[ -f "$ROOT/backend/.env" ]]; then
  sed -i '/^DEPLOY_GIT_SHA=/d' "$ROOT/backend/.env"
  echo "DEPLOY_GIT_SHA=${GIT_SHA_SHORT}" >> "$ROOT/backend/.env"
fi

PM2_ENV="$ROOT/scripts/deploy/pm2.env"
[[ -f "$PM2_ENV" ]] && set -a && source "$PM2_ENV" && set +a
export UZAEDU_BACKEND_ROOT="${UZAEDU_BACKEND_ROOT:-$ROOT/backend}"
export UZAEDU_WEB_ROOT="${UZAEDU_WEB_ROOT:-$ROOT/web-admin}"
pm2 startOrReload "$ROOT/backend/tools/pm2-ecosystem.config.cjs" --update-env
pm2 save 2>/dev/null || true

echo "[deploy] OK git=${GIT_SHA_SHORT}"