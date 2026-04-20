#!/usr/bin/env bash
set -euo pipefail
# Hetzner / prod: MEB Mebbis (Playwright) için Chromium + bağımlılıklar
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND_DIR"
export DEBIAN_FRONTEND=noninteractive
npx playwright install-deps chromium 2>/dev/null || true
npx playwright install chromium
