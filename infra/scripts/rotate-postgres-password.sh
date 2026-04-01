#!/usr/bin/env bash
# Sunucuda (root): Postgres (Docker) + backend/.env ayni DB_PASSWORD.
# Yerelde sifre uret: pwsh scripts/security/generate-db-password.ps1
# Sunucu: export NEW_DB_PASSWORD='...' && bash infra/scripts/rotate-postgres-password.sh
set -euo pipefail
REPO="${UZAEDU_REPO_ROOT:-/opt/uzaedu}"
ENV_FILE="$REPO/backend/.env"
CONTAINER="${POSTGRES_CONTAINER:-ogretmenpro-db}"

if [[ -z "${NEW_DB_PASSWORD:-}" ]]; then
  echo "export NEW_DB_PASSWORD='....' ile calistir."
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Yok: $ENV_FILE"
  exit 1
fi

DB_USERNAME="$(grep -E '^DB_USERNAME=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | tr -d '"')"
DB_USERNAME="${DB_USERNAME:-ogretmenpro}"
ESC="${NEW_DB_PASSWORD//\'/\'\'}"

docker exec "$CONTAINER" psql -U "$DB_USERNAME" -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER USER ${DB_USERNAME} WITH PASSWORD '$ESC';"

TMP="$(mktemp)"
grep -v -E '^[[:space:]]*DB_PASSWORD=' "$ENV_FILE" > "$TMP"
printf '%s\n' "DB_PASSWORD=$NEW_DB_PASSWORD" >> "$TMP"
mv "$TMP" "$ENV_FILE"
chmod 600 "$ENV_FILE" 2>/dev/null || true

echo "Tamam: Postgres + $ENV_FILE. pm2 restart uzaedu-api"