#!/usr/bin/env python3
"""Menü HTML: font/gate kaldır, style= → class (tek geçiş, güvenli)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "menus"

STYLE_TO_CLASS = {
    "max-width: 480px; margin: 2rem auto": "uza-page-main",
    "width: 100%; margin-bottom: 0.5rem": "uza-input uza-w-full uza-mb-05",
    "width: 100%; margin-bottom: 0.75rem": "uza-input uza-w-full uza-mb-075",
    "width: 100%; margin-bottom: 1rem": "uza-input uza-w-full uza-mb-1",
    "width: 100%; margin-bottom: 1.25rem": "uza-input uza-w-full uza-mb-125",
    "width: 100%; margin: 0.5rem 0 1rem": "uza-input uza-w-full uza-mb-1",
    "width: 100%; margin: 0.5rem 0": "uza-input uza-w-full uza-mb-05",
    "width: 100%; margin-top: 1rem": "btn-primary uza-w-full uza-mt-1",
    "width: 100%; margin-top: 0.85rem": "btn-primary uza-w-full uza-mt-1",
    "width: 100%; margin-top: 0.4rem": "bordro-btn secondary uza-mt-1",
    "width: 100%": "uza-w-full",
    "font-size: 1rem; margin: 0 0 0.5rem": "uza-h2",
    "margin: 0 0 0.5rem": "uza-mb-05",
    "margin: 0.5rem 0 1rem": "uza-mb-1",
    "display: flex; gap: 8px; align-items: center; margin-bottom: 0.75rem": "uza-flex-check uza-mb-075",
    "display: flex; gap: 8px; align-items: center": "uza-flex-check",
    "display: flex; gap: 0.5rem; margin: 0.75rem 0": "uza-flex-check uza-mb-075",
    "display: block; text-align: center; text-decoration: none": "bordro-btn primary uza-w-full",
}

TAG_RE = re.compile(r"<(input|select|textarea|button|a|main|label|h2|p|div)([^>]*?)>", re.I | re.S)


def add_classes(attrs: str, extra: str) -> str:
    extra_parts = extra.split()
    m = re.search(r'\bclass="([^"]*)"', attrs)
    if m:
        existing = m.group(1).split()
        merged: list[str] = []
        for p in existing + extra_parts:
            if p not in merged:
                merged.append(p)
        return re.sub(r'\bclass="[^"]*"', f'class="{" ".join(merged)}"', attrs, count=1)
    return attrs + f' class="{extra}"'


def fix_tag(match: re.Match[str]) -> str:
    tag = match.group(1).lower()
    attrs = match.group(2)
    sm = re.search(r'\bstyle="([^"]*)"', attrs)
    if sm:
        mapped = STYLE_TO_CLASS.get(sm.group(1))
        attrs = re.sub(r'\s*\bstyle="[^"]*"', "", attrs)
        if mapped:
            attrs = add_classes(attrs, mapped)
    if tag in ("input", "select", "textarea") and "btn-primary" in attrs:
        attrs = attrs.replace("btn-primary", "uza-input")
        attrs = re.sub(r"uza-input\s+uza-input", "uza-input", attrs)
    if tag == "button" and "uza-input" in attrs:
        attrs = attrs.replace("uza-input", "btn-primary")
    return f"<{tag}{attrs}>"


def strip_fonts(text: str) -> str:
    lines = []
    for line in text.splitlines():
        if "fonts.googleapis" in line or "fonts.gstatic" in line:
            continue
        if "../gate/gate.css" in line:
            continue
        lines.append(line)
    return "\n".join(lines)


def fix_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    orig = text
    text = strip_fonts(text)
    text = text.replace('content="#070b14"', 'content="#2563eb"')
    text = text.replace('charset="UTF-8"', 'charset="utf-8"')
    if "kelebek.css" not in text:
        text = text.replace("</head>", '    <link rel="stylesheet" href="kelebek.css" />\n  </head>', 1)
    text = TAG_RE.sub(fix_tag, text)
    if text != orig:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    n = sum(1 for h in sorted(ROOT.glob("*.html")) if fix_file(h))
    print("done,", n, "files")


if __name__ == "__main__":
    main()
