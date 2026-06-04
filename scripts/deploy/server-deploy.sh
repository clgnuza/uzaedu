#!/usr/bin/env bash
set -euo pipefail
ROOT="${UZAEDU_REPO_ROOT:-${DEPLOY_REMOTE_ROOT:-/opt/uzaedu}}"
BRANCH="${DEPLOY_GIT_BRANCH:-main}"
cd "$ROOT"
echo "[deploy] repo=$ROOT branch=$BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "[deploy] backend npm ci + build"
( cd "$ROOT/backend"
  if [[ -d dist ]]; then rm -rf dist; fi
  npm ci && npm run build )
if [[ "${MIGRATE_ON_DEPLOY:-0}" == "1" || "${MIGRATE_ON_DEPLOY:-0}" == "true" ]]; then
  (cd "$ROOT/backend" && npm run migrate:sql)
fi
echo "[deploy] web-admin npm ci + build"
( cd "$ROOT/web-admin" && npm ci && npm run build )
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
