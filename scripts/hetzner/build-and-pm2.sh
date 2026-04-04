#!/usr/bin/env bash
# İlk kurulum / el ile build: localhost ile aynı — NEXT_PUBLIC_API_BASE_URL=https://api.../api (Nest global prefix api).
# Günlük güncelleme: repo kökünde scripts/deploy/server-deploy.sh (git pull, npm ci, build, pm2 restart).
# npm ci öncesi NODE_ENV=production vermeyin (devDependencies gerekir).
set -euo pipefail
INSTALL_DIR="${INSTALL_DIR:-/opt/uzaedu}"
DOMAIN_API="${DOMAIN_API:-api.uzaedu.com}"
DOMAIN_ADMIN="${DOMAIN_ADMIN:-admin.uzaedu.com}"
DOMAIN_SITE="${DOMAIN_SITE:-uzaedu.com}"
cd "${INSTALL_DIR}"
GIT_SHA_SHORT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
if [ -f backend/.env ]; then
  sed -i '/^DEPLOY_GIT_SHA=/d' backend/.env
  echo "DEPLOY_GIT_SHA=${GIT_SHA_SHORT}" >> backend/.env
fi
(cd backend && npm ci && npm run build)
(cd web-admin && printf "%s\n" "NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN_API}/api" "NEXT_PUBLIC_SITE_URL=https://${DOMAIN_SITE}" > .env.production && npm ci && npm run build)
export NODE_ENV=production
pm2 delete uzaedu-api 2>/dev/null || true
pm2 delete uzaedu-web 2>/dev/null || true
pm2 start "${INSTALL_DIR}/backend/dist/main.js" --name uzaedu-api
cd "${INSTALL_DIR}/web-admin"
pm2 start npm --name uzaedu-web -- start
pm2 save
echo "OK. SSL: certbot --nginx -d ${DOMAIN_API} -d ${DOMAIN_ADMIN}; tam site: infra/nginx/uzaedu.conf"
