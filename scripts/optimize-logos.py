#!/usr/bin/env python3
"""Write WebP copies of the cached business logos.

For every entry in data/listing-logos.json this writes, beside the original:
  <slug>.webp      same pixel size as the original (logo tiles and marks)
  <slug>-320.webp  at most 320px on the long edge (carousel and finder cards)
and records them in the manifest as "webp" and "webpSmall". The original
PNG/JPEG stays where it is as the fallback and for schema/OG use, so no
existing URL changes. Safe to re-run: files that are newer than their
source are skipped. Run after scripts/cache-photos.mjs adds logos.

Needs Pillow with WebP support (box tooling only; not a site dependency).
"""
import json
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "listing-logos.json"
SMALL = 320


def save_webp(img, dest):
    img.save(dest, "WEBP", quality=82, method=6)


# --missing-only: only write WebP files that do not exist yet. Used in CI,
# where a fresh checkout gives every file the same mtime, so the mtime test
# would rebuild (and re-commit) every WebP for no reason.
MISSING_ONLY = "--missing-only" in sys.argv[1:]


def fresh(dest, src):
    if MISSING_ONLY:
        return dest.exists()
    return dest.exists() and dest.stat().st_mtime >= src.stat().st_mtime


def main():
    manifest = json.loads(MANIFEST.read_text())
    before = after = 0
    for slug, entry in manifest.items():
        src = ROOT / entry["src"].lstrip("/")
        if not src.exists():
            print(f"missing {src}", file=sys.stderr)
            continue
        stem = src.with_suffix("")
        full, small = Path(f"{stem}.webp"), Path(f"{stem}-{SMALL}.webp")
        with Image.open(src) as im:
            im.load()
            mode = "RGBA" if im.mode in ("RGBA", "LA", "P") and ("transparency" in im.info or im.mode != "P") else "RGB"
            img = im.convert(mode)
        if not fresh(full, src):
            save_webp(img, full)
        if not fresh(small, src):
            s = img.copy()
            s.thumbnail((SMALL, SMALL), Image.LANCZOS)
            save_webp(s, small)
        with Image.open(small) as s:
            sw, sh = s.size
        entry["webp"] = f"/assets/img/logos/{full.name}"
        entry["webpSmall"] = f"/assets/img/logos/{small.name}"
        entry["webpSmallWidth"], entry["webpSmallHeight"] = sw, sh
        before += src.stat().st_size
        after += full.stat().st_size
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"{len(manifest)} logos: originals {before/1e6:.1f} MB, full-size WebP {after/1e6:.1f} MB")


if __name__ == "__main__":
    main()
