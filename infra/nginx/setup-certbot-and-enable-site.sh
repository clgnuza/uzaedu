#!/usr/bin/env bash
# Sunucuda root: repo /opt/uzaedu altında olmalı.
# 1) HTTP proxy aktif olur 2) Let's Encrypt sertifikası alınır 3) HTTPS + yönlendirmeler yüklenir
set -euo pipefail

EMAIL="${LETSENCRYPT_EMAIL:-admin@uzaedu.com}"
REPO="${UZAEDU_REPO_ROOT:-/opt/uzaedu}"
HTTP_CONF="$REPO/infra/nginx/uzaedu-http-only.conf"
HTTPS_CONF="$REPO/infra/nginx/uzaedu.conf"
NGINX_SITE="/etc/nginx/sites-available/uzaedu"

if [[ ! -f "$HTTPS_CONF" ]]; then
  echo "Dosya yok: $HTTPS_CONF"
  exit 1
fi

apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

cp -a "$HTTP_CONF" "$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/uzaedu
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
# Eski tekil site (uzaedu.conf) çakışma uyarısı verir
rm -f /etc/nginx/sites-enabled/uzaedu.conf 2>/dev/null || true
nginx -t
systemctl reload nginx

certbot certonly --nginx \
  --non-interactive --agree-tos \
  --email "$EMAIL" \
  -d uzaedu.com -d www.uzaedu.com -d admin.uzaedu.com -d api.uzaedu.com

cp -a "$HTTPS_CONF" "$NGINX_SITE"
nginx -t
systemctl reload nginx

echo "Bitti: https://uzaedu.com (panel) | https://api.uzaedu.com | admin.uzaedu.com → uzaedu.com"
