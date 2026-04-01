#!/usr/bin/env bash
# Hetzner VPS: UFW (22,80,443), backend/.env 600
# sudo bash infra/scripts/harden-server.sh
set -euo pipefail

REPO="${UZAEDU_REPO_ROOT:-/opt/uzaedu}"
ENV_FILE="$REPO/backend/.env"

if [[ $EUID -ne 0 ]]; then
  echo "root ile calistir: sudo bash $0"
  exit 1
fi

if command -v ufw >/dev/null 2>&1; then
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  ufw status verbose
else
  echo "ufw yok: apt install -y ufw"
fi

if [[ -f "$ENV_FILE" ]]; then
  chmod 600 "$ENV_FILE"
  chown root:root "$ENV_FILE" 2>/dev/null || true
  echo "chmod 600 $ENV_FILE"
fi

echo "Tamam."