#!/usr/bin/env python3
"""Eklenti metinlerinde resmî marka adlarını özgün adlarla değiştirir (brand-names.js ile uyumlu)."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {
    "brand-names.js",
    "apply-brand-names.py",
    "messaging.js",
    "service-worker.js",
}

REPLACEMENTS = [
    ("E-Okul Köprüsü", "Uzaedu Okul Köprüsü"),
    ("e-Okul Köprüsü", "Uzaedu Okul Köprüsü"),
    ("E-Okul&apos;a", "OkulNet&apos;e"),
    ("E-Okul'a", "OkulNet'e"),
    ("E-Okul'a", "OkulNet'e"),
    ("E-Okul'a", "OkulNet'e"),
    ("e-Okul", "OkulNet"),
    ("E-Okul", "OkulNet"),
    ("e-yoklama", "Sınıf Yoklama"),
    ("MEBBİS", "PersonelNet"),
    ("MEBBIS", "PersonelNet"),
]

# Kod tanımlayıcılarına dokunma: URL, değişken, mesaj sabiti
KBS_SKIP_PREFIX = re.compile(
    r"(https?://|UZA_|uza|mebbis|kbs|BORDRO_|SNAPSHOT_|OTURUM_|/mesaj-merkezi/kbs)",
    re.I,
)


def replace_kbs(text: str) -> str:
    out = []
    last = 0
    for m in re.finditer(r"\bKBS\b", text):
        prefix = text[max(0, m.start() - 40) : m.start()]
        if KBS_SKIP_PREFIX.search(prefix):
            continue
        out.append(text[last : m.start()])
        out.append("MaliNet")
        last = m.end()
    out.append(text[last:])
    return "".join(out)


def process_file(path: Path) -> bool:
    if path.name in SKIP:
        return False
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return False
    orig = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    text = replace_kbs(text)
    if text != orig:
        path.write_text(text, encoding="utf-8", newline="\n")
        return True
    return False


def main() -> None:
    n = 0
    for ext in (".html", ".js", ".md", ".css", ".py"):
        for path in ROOT.rglob(f"*{ext}"):
            if "node_modules" in path.parts:
                continue
            if process_file(path):
                print(path.relative_to(ROOT))
                n += 1
    print(f"done: {n} files")


if __name__ == "__main__":
    main()
