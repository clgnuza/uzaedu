#!/usr/bin/env python3
"""Eklenti kaynak dosyalarını UTF-8'e çevirir; bozuk ? ve cp1254 mojibake düzeltir."""
from __future__ import annotations

import re
from pathlib import Path

REPL = [
    ("Öð", "Öğ"),
    ("öð", "öğ"),
    ("Ð", "Ğ"),
    ("ð", "ğ"),
    ("ý", "ı"),
    ("Ý", "İ"),
    ("þ", "ş"),
    ("Þ", "Ş"),
    ("â€™", "'"),
    ("â€œ", '"'),
    ("â€", '"'),
    ("\ufffd", ""),
    # ogrenci-dosya.html ve benzeri bozuk UTF-8 kayıpları (? = ı/ğ/ş/İ)
    ("Ö?renci", "Öğrenci"),
    ("ö?renci", "öğrenci"),
    ("dosyas?", "dosyası"),
    ("iste?e ba?l?", "isteğe bağlı"),
    ("aktar?r", "aktarır"),
    ("aktar?lacak", "aktarılacak"),
    ("D??a", "Dışa"),
    ("ilkö?retim", "ilköğretim"),
    ("sonras?", "sonrası"),
    ("?ndirilen", "İndirilen"),
    ("dosyay?", "dosyayı"),
    ("s?n?flar?", "sınıfları"),
    ("s?n?f", "sınıf"),
    ("g?r", "gör"),
    ("y?kle", "yükle"),
    ("d?nem", "dönem"),
    ("i?in", "için"),
    ("a?ı", "açı"),
]

ROOT = Path(__file__).resolve().parents[1]
GLOBS = (
    "menus/*.html",
    "menus/*.js",
    "app/*.html",
    "app/*.js",
    "gate/*.html",
    "gate/*.js",
    "shared/*.js",
    "content/*.js",
    "modules/**/*.js",
)


def decode_bytes(raw: bytes) -> str:
    for enc in ("utf-8", "cp1254", "iso-8859-9", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def fix_text(s: str) -> str:
    for a, b in REPL:
        s = s.replace(a, b)
    return s


def convert_file(path: Path) -> bool:
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = decode_bytes(raw)
    fixed = fix_text(text)
    out = fixed.encode("utf-8")
    if out != raw:
        path.write_bytes(out)
        return True
    return False


def main() -> None:
    changed: list[str] = []
    for pattern in GLOBS:
        for path in sorted(ROOT.glob(pattern)):
            if path.is_file() and convert_file(path):
                changed.append(path.relative_to(ROOT).as_posix())
    for path in sorted(changed):
        print("fixed", path)
    if not changed:
        print("no changes")


if __name__ == "__main__":
    main()
