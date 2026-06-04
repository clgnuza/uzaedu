#!/usr/bin/env python3
import re
from pathlib import Path

menus = Path(__file__).resolve().parents[1] / "menus"
body_pat = re.compile(r'(<body class="uza-body")(.*?)(>)', re.DOTALL)
chunk_pat = re.compile(
    r'\s+data-uza-platform="[^"]*"\s+data-uza-icon="[^"]*"'
    r'\s+data-uza-title="[^"]*"\s+data-uza-lead="[^"]*"(?:\s+data-uza-wide="1")?'
)

for path in sorted(menus.glob("*.html")):
    text = path.read_text(encoding="utf-8")
    if text.count("data-uza-platform") < 2:
        continue

    def sub(m: re.Match[str]) -> str:
        chunk = chunk_pat.match(m.group(2))
        if not chunk:
            return m.group(0)
        return m.group(1) + chunk.group(0) + m.group(3)

    fixed = body_pat.sub(sub, text, count=1)
    if fixed != text:
        path.write_text(fixed, encoding="utf-8", newline="\n")
        print("deduped", path.name)
