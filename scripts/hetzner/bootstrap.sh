#!/usr/bin/env bash
set -euo pipefail
DOMAIN_API="${DOMAIN_API:-api.uzaedu.com}"
DOMAIN_ADMIN="${DOMAIN_ADMIN:-admin.uzaedu.com}"
DOMAIN_SITE="${DOMAIN_SITE:-uzaedu.com}"
REPO_URL="${REPO_URL:-https://github.com/clgnuza/uzaedu.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/uzaedu}"
DB_NAME="${DB_NAME:-ogretmenpro}"
DB_USER="${DB_USER:-ogretmenpro}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ufw curl ca-certificates git nginx certbot python3-certbot-nginx postgresql postgresql-contrib build-essential
ufw allow OpenSSH; ufw allow 80/tcp; ufw allow 443/tcp; yes | ufw enable || true
if ! command -v node >/dev/null 2>&1; then curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs; fi
npm install -g pm2
if [[ ! -f /root/.uzaedu-db-password ]]; then openssl rand -base64 24 | tr -d '/+=' | head -c 32 > /root/.uzaedu-db-password; chmod 600 /root/.uzaedu-db-password; fi
DB_PASS="$(cat /root/.uzaedu-db-password)"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
mkdir -p "$(dirname "${INSTALL_DIR}")"
[[ ! -d "${INSTALL_DIR}/.git" ]] && git clone --depth 1 "${REPO_URL}" "${INSTALL_DIR}" || git -C "${INSTALL_DIR}" pull --ff-only || true
[[ ! -f /root/.uzaedu-jwt-secret ]] && openssl rand -base64 48 | tr -d '\n' > /root/.uzaedu-jwt-secret && chmod 600 /root/.uzaedu-jwt-secret
JWT_SECRET="$(cat /root/.uzaedu-jwt-secret)"
cat > "${INSTALL_DIR}/backend/.env" << EOF
APP_ENV=production
APP_DEBUG=false
APP_PORT=4000
APP_URL=https://${DOMAIN_API}
TYPEORM_SYNC=false
TRUST_PROXY=true
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=${DB_NAME}
DB_USERNAME=${DB_USER}
DB_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT_SECRET}
CORS_ORIGINS=https://${DOMAIN_SITE},https://www.${DOMAIN_SITE},https://${DOMAIN_ADMIN}
FRONTEND_URL=https://${DOMAIN_SITE}
# OPENAI_API_KEY= (opsiyonel; Optik/GPT — sınav görevi için panel app_config veya bu satır)
EOF
chmod 600 "${INSTALL_DIR}/backend/.env"
cat > /etc/nginx/sites-available/uzaedu.conf << NGINX
server { listen 80; listen [::]:80; server_name ${DOMAIN_API};
location / { proxy_pass http://127.0.0.1:4000; proxy_http_version 1.1;
proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr;
proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; } }
server { listen 80; listen [::]:80; server_name ${DOMAIN_ADMIN};
location / { proxy_pass http://127.0.0.1:3000; proxy_http_version 1.1;
proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr;
proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; } }
NGINX
ln -sf /etc/nginx/sites-available/uzaedu.conf /etc/nginx/sites-enabled/uzaedu.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "OK. DB pass: /root/.uzaedu-db-password  Edit: ${INSTALL_DIR}/backend/.env"
echo "Sonra: certbot; ardından infra/nginx/uzaedu.conf ile HTTPS + kök alanlar (localhost ile aynı :4000 /api, :3000)"
