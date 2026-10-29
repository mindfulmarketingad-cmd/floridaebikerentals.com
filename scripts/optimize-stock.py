#!/usr/bin/env python3
"""Write a WebP copy beside every JPEG in assets/img/stock and assets/img/original.

The build (src/images.mjs) offers the .webp to browsers through <picture>
when the file exists, and keeps the JPEG as the fallback, so no URL changes.
Safe to re-run; up-to-date files are skipped. Run after scripts/stock-fetch.mjs.
Needs Pillow with WebP support (box tooling only; not a site dependency).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
before = after = n = 0
for folder in ("assets/img/stock", "assets/img/original"):
    for src in sorted((ROOT / folder).glob("*.jp*g")):
        dest = src.with_suffix(".webp")
        if not (dest.exists() and dest.stat().st_mtime >= src.stat().st_mtime):
            with Image.open(src) as im:
                im.convert("RGB").save(dest, "WEBP", quality=78, method=6)
        before += src.stat().st_size
        after += dest.stat().st_size
        n += 1
print(f"{n} JPEGs: {before/1e6:.1f} MB -> WebP {after/1e6:.1f} MB")
