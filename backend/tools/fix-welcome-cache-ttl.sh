#!/bin/bash
# welcome_module_config içindeki cache_ttl_welcome'ı 30 saniyeye düşür
DB_USER=$(grep -m1 '^DB_USERNAME=' /opt/uzaedu/backend/.env | cut -d= -f2 | tr -d '"')
DB_NAME=$(grep -m1 '^DB_DATABASE=' /opt/uzaedu/backend/.env | cut -d= -f2 | tr -d '"')

echo "=== Önce ==="
docker exec ogretmenpro-db psql -U "$DB_USER" -d "$DB_NAME" -t \
  -c "SELECT (value::jsonb)->>'cache_ttl_welcome' FROM app_config WHERE key='welcome_module_config';"

docker exec ogretmenpro-db psql -U "$DB_USER" -d "$DB_NAME" -t \
  -c "UPDATE app_config SET value = (value::jsonb || '{\"cache_ttl_welcome\":30}'::jsonb)::text WHERE key='welcome_module_config';"

echo "=== Sonra ==="
docker exec ogretmenpro-db psql -U "$DB_USER" -d "$DB_NAME" -t \
  -c "SELECT (value::jsonb)->>'cache_ttl_welcome' FROM app_config WHERE key='welcome_module_config';"

echo "DONE"
