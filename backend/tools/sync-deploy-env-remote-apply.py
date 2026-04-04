#!/usr/bin/env python3
"""Sunucuda: patch dosyasındaki KEY=val çiftlerini hedef .env içinde günceller veya ekler."""
import re
import sys

if len(sys.argv) != 3:
    print("Kullanım: sync-deploy-env-remote-apply.py <patch.env> <hedef.env>", file=sys.stderr)
    sys.exit(1)

patch_path, target_path = sys.argv[1], sys.argv[2]
updates: dict[str, str] = {}
with open(patch_path, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            updates[k.strip()] = v.strip()

with open(target_path, encoding="utf-8") as f:
    text = f.read()

for k, v in updates.items():
    nl = f"{k}={v}"
    pat = re.compile("^" + re.escape(k) + r"=.*$", re.M)
    if pat.search(text):
        text = pat.sub(nl, text, count=1)
    else:
        text = text.rstrip() + "\n" + nl + "\n"

with open(target_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Güncellendi:", target_path)
