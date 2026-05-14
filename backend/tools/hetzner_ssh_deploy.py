#!/usr/bin/env python3
"""
Hetzner / prod: yerelden SSH ile sunucuda `scripts/deploy/server-deploy.sh` çalıştırır.
`tools/hetzner-deploy.ps1` ile aynı ortam değişkenleri ve davranış.

Ortam:
  DEPLOY_SSH_HOST     hedef IP/FQDN (yoksa api.uzaedu.com A kaydı denenir)
  DEPLOY_SSH_USER     varsayılan: root
  DEPLOY_SSH_KEY      varsayılan: ~/.ssh/id_rsa_uzaedu
  DEPLOY_REMOTE_ROOT  varsayılan: /opt/uzaedu

Kullanım:
  cd backend
  python tools/hetzner_ssh_deploy.py
  python tools/hetzner_ssh_deploy.py --playwright-only
  python tools/hetzner_ssh_deploy.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import socket
import subprocess
import sys
from pathlib import Path


def default_ssh_key() -> Path:
    p = os.environ.get("DEPLOY_SSH_KEY", "").strip()
    if p:
        return Path(p)
    return Path.home() / ".ssh" / "id_rsa_uzaedu"


def resolve_host() -> str:
    h = os.environ.get("DEPLOY_SSH_HOST", "").strip()
    if h:
        return h
    try:
        return socket.gethostbyname("api.uzaedu.com")
    except OSError:
        pass
    print("DEPLOY_SSH_HOST yok ve api.uzaedu.com DNS çözülemedi.", file=sys.stderr)
    sys.exit(1)


def ssh_base(key: Path, user: str, host: str) -> list[str]:
    if not key.is_file():
        print(f"SSH anahtar yok: {key}", file=sys.stderr)
        sys.exit(1)
    return [
        "ssh",
        "-i",
        str(key),
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=accept-new",
        f"{user}@{host}",
    ]


def run_remote(cmd: list[str], *, dry_run: bool) -> None:
    if dry_run:
        print("[dry-run]", subprocess.list2cmdline(cmd))
        return
    r = subprocess.run(cmd)
    if r.returncode != 0:
        sys.exit(r.returncode)


def main() -> None:
    ap = argparse.ArgumentParser(description="SSH ile Hetzner deploy / Playwright kurulumu.")
    ap.add_argument("--playwright-only", action="store_true", help="Sadece Playwright kurulum scriptini çalıştır.")
    ap.add_argument("--dry-run", action="store_true", help="SSH komutlarını yazdır, çalıştırma.")
    args = ap.parse_args()

    host = resolve_host()
    user = os.environ.get("DEPLOY_SSH_USER", "root").strip() or "root"
    key = default_ssh_key()
    root = os.environ.get("DEPLOY_REMOTE_ROOT", "/opt/uzaedu").strip() or "/opt/uzaedu"

    deploy_sh = f"{root}/scripts/deploy/server-deploy.sh"
    pw_sh = f"{root}/backend/tools/server-playwright-install.sh"

    def remote_bash(script: str) -> list[str]:
        inner = f"chmod +x {script} 2>/dev/null; bash {script}"
        return ssh_base(key, user, host) + [inner]

    if args.playwright_only:
        print(f"SSH {user}@{host} -> Playwright chromium (MEB Mebbis)")
        run_remote(remote_bash(pw_sh), dry_run=args.dry_run)
    else:
        print(f"SSH {user}@{host} -> bash {deploy_sh}")
        run_remote(remote_bash(deploy_sh), dry_run=args.dry_run)
        print(f"SSH {user}@{host} -> Playwright chromium (MEB Mebbis)")
        run_remote(remote_bash(pw_sh), dry_run=args.dry_run)
    print("Tamam.")


if __name__ == "__main__":
    main()
