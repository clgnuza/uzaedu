#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${INSTALL_DIR:-/opt/uzaedu}"
DUMP="/root/ogretmenpro-pre-docker.dump"
DB_DATABASE="${DB_DATABASE:-ogretmenpro}"
DB_USERNAME="${DB_USERNAME:-ogretmenpro}"
sudo -u postgres pg_dump -Fc "$DB_DATABASE" > "$DUMP"
systemctl stop postgresql
systemctl disable postgresql || true
cd "$INSTALL_DIR"
docker compose -f docker-compose.server.yml --env-file backend/.env up -d
sleep 5
docker exec -i ogretmenpro-db pg_restore -U "$DB_USERNAME" -d "$DB_DATABASE" --no-owner < "$DUMP" || true
pm2 restart uzaedu-api
echo OK
