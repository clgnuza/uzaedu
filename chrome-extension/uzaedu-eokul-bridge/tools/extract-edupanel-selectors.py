#!/usr/bin/env python3
import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[2] / "_edupanel-ref-unpack" / "src"
for p in sorted(root.rglob("*.js")):
    if "xlsx" in p.name or "min.js" in p.name:
        continue
    s = p.read_text(encoding="utf-8", errors="replace")
    if len(s) > 50000:
        continue
    ids = sorted(set(re.findall(r'#[A-Za-z][A-Za-z0-9_$]*', s)))
    names = sorted(set(re.findall(r'name=["\']([^"\']+)["\']', s)))
    gets = sorted(set(re.findall(r'getElementById\(["\']([^"\']+)["\']', s)))
    parses = sorted(set(re.findall(r'parse[A-Za-z0-9_]+', s)))
    if ids or gets or parses:
        print("===", p.relative_to(root), "===")
        if parses:
            print("parse:", ", ".join(parses[:20]))
        if gets:
            print("getElementById:", ", ".join(gets[:30]))
        if ids:
            print("ids:", ", ".join(ids[:40]))
