#!/bin/sh
# Seed + /me testi. Backend ve PostgreSQL çalışır olmalı.
# Kullanım: sh scripts/test-seed-me.sh
set -e
BASE="http://localhost:4000/api"
echo "1. POST $BASE/seed ..."
SEED=$(curl -s -X POST "$BASE/seed")
USER_ID=$(echo "$SEED" | sed -n 's/.*"userId":"\([^"]*\)".*/\1/p')
echo "   userId: $USER_ID"
echo "2. GET $BASE/me (Bearer $USER_ID) ..."
curl -s -H "Authorization: Bearer $USER_ID" "$BASE/me" | head -c 200
echo ""
echo "Test OK."
