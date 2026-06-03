#!/usr/bin/env python3
"""Uzaedu Uzaedu Okul Köprüsü — özgün eklenti simgeleri (16/32/48/128)."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SIZES = (16, 32, 48, 128)

BG = (7, 11, 20, 255)
BG_EDGE = (20, 184, 166, 90)
PANEL = (129, 140, 248, 255)
PANEL_GLOW = (129, 140, 248, 60)
EOKUL = (45, 212, 191, 255)
EOKUL_GLOW = (20, 184, 166, 70)
BRIDGE = (20, 184, 166, 255)
KBS_ACCENT = (245, 158, 11, 220)


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _bridge_points(size: int, x0: float, x1: float, y: float) -> list[tuple[float, float]]:
    """Panel → OkulNet kemer köprüsü."""
    n = max(12, size * 2)
    pts: list[tuple[float, float]] = []
    arch = size * (0.22 if size >= 32 else 0.12)
    for i in range(n + 1):
        t = i / n
        x = _lerp(x0, x1, t)
        lift = math.sin(t * math.pi) * arch
        pts.append((x, y - lift))
    return pts


def render_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = max(1, round(size * 0.06))
    radius = max(2, round(size * 0.22))

    d.rounded_rectangle(
        (pad, pad, size - pad - 1, size - pad - 1),
        radius=radius,
        fill=BG,
        outline=BG_EDGE,
        width=max(1, round(size / 32)),
    )

    cx_l = size * 0.27
    cx_r = size * 0.73
    cy = size * 0.5
    node_r = max(2, round(size * 0.11))

    if size >= 24:
        glow_r = node_r + max(1, size // 16)
        d.ellipse(
            (cx_l - glow_r, cy - glow_r, cx_l + glow_r, cy + glow_r),
            fill=PANEL_GLOW,
        )
        d.ellipse(
            (cx_r - glow_r, cy - glow_r, cx_r + glow_r, cy + glow_r),
            fill=EOKUL_GLOW,
        )

    bw = max(2, round(size / 10)) if size >= 16 else 2
    bridge = _bridge_points(size, cx_l + node_r * 0.6, cx_r - node_r * 0.6, cy)
    if size >= 20:
        d.line(bridge, fill=BRIDGE, width=bw, joint="curve")
    else:
        d.line([(cx_l + 2, cy), (cx_r - 2, cy)], fill=BRIDGE, width=2)

    d.ellipse(
        (cx_l - node_r, cy - node_r, cx_l + node_r, cy + node_r),
        fill=PANEL,
    )
    d.ellipse(
        (cx_r - node_r, cy - node_r, cx_r + node_r, cy + node_r),
        fill=EOKUL,
    )

    if size >= 32:
        hi = max(1, node_r // 3)
        d.ellipse(
            (cx_l - hi, cy - node_r + hi, cx_l + hi, cy - node_r + hi * 3),
            fill=(255, 255, 255, 55),
        )

    if size >= 48:
        dot = max(2, round(size * 0.045))
        bx, by = size * 0.5, size * 0.82
        d.ellipse((bx - dot, by - dot, bx + dot, by + dot), fill=KBS_ACCENT)

    return img


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    for s in SIZES:
        out = ASSETS / f"icon{s}.png"
        render_icon(s).save(out, format="PNG", optimize=True)
        print(f"wrote {out} ({s}x{s})")


if __name__ == "__main__":
    main()
