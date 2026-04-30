#!/usr/bin/env bash
set -euo pipefail
SQL="${1:-/tmp/add-plan-submission-author-indexes.sql}"
U=$(grep -m1 '^DB_USERNAME=' /opt/uzaedu/backend/.env | cut -d= -f2- | tr -d '\r' | xargs)
D=$(grep -m1 '^DB_DATABASE=' /opt/uzaedu/backend/.env | cut -d= -f2- | tr -d '\r' | xargs)
cat "$SQL" | docker exec -i ogretmenpro-db psql -v ON_ERROR_STOP=1 -U "${U:-postgres}" -d "${D:-ogretmenpro}"
echo "SQL_OK user=${U:-postgres} db=${D:-ogretmenpro}"
