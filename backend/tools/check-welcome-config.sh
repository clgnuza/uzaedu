#!/bin/bash
DB_USER=$(grep -m1 '^DB_USERNAME=' /opt/uzaedu/backend/.env | cut -d= -f2 | tr -d '"')
DB_NAME=$(grep -m1 '^DB_DATABASE=' /opt/uzaedu/backend/.env | cut -d= -f2 | tr -d '"')
echo "DB: $DB_USER @ $DB_NAME"
docker exec ogretmenpro-db psql -U "$DB_USER" -d "$DB_NAME" -t \
  -c "SELECT LEFT(value,800) FROM app_config WHERE key='welcome_module_config';"
