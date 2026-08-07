"""Generate Comb PWA icons (192/512 + maskable + apple-touch)."""
from __future__ import annotations

import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "public")
BG = (10, 8, 6, 255)
GOLD = (244, 196, 48, 255)
GOLD_DEEP = (138, 100, 20, 255)


def hex_points(cx: float, cy: float, r: float):
    pts = []
    for i in range(6):
        a = math.radians(-90 + i * 60)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def make(size: int, maskable: bool = False) -> Image.Image:
    im = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(im)
    r = size * (0.32 if maskable else 0.38)
    cx = cy = size / 2
    d.polygon(hex_points(cx, cy, r), fill=GOLD_DEEP)
    d.polygon(hex_points(cx, cy, r * 0.78), fill=GOLD)
    d.polygon(hex_points(cx, cy, r * 0.42), fill=BG)
    d.polygon(hex_points(cx, cy, r * 0.18), fill=GOLD)
    return im.convert("RGB")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    specs = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-192-maskable.png", 192, True),
        ("icon-512-maskable.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ]
    for name, size, maskable in specs:
        path = os.path.join(OUT, name)
        make(size, maskable).save(path, optimize=True)
        print(name, size, os.path.getsize(path))


if __name__ == "__main__":
    main()
