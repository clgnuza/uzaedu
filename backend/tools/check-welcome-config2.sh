#!/bin/bash
DB_USER=$(grep -m1 '^DB_USERNAME=' /opt/uzaedu/backend/.env | cut -d= -f2 | tr -d '"')
DB_NAME=$(grep -m1 '^DB_DATABASE=' /opt/uzaedu/backend/.env | cut -d= -f2 | tr -d '"')
echo "=== welcome_module_config by_day keys ==="
docker exec ogretmenpro-db psql -U "$DB_USER" -d "$DB_NAME" -t \
  -c "SELECT jsonb_object_keys((value::jsonb)->'by_day') FROM app_config WHERE key='welcome_module_config' ORDER BY 1;"
echo ""
echo "=== fallback_message ==="
docker exec ogretmenpro-db psql -U "$DB_USER" -d "$DB_NAME" -t \
  -c "SELECT (value::jsonb)->>'fallback_message' FROM app_config WHERE key='welcome_module_config';"
echo ""
echo "=== local welcome-today API ==="
curl -s http://localhost:4000/api/content/welcome-today | head -c 300
