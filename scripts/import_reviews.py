#!/usr/bin/env python3
"""
Attach Google reviews from an Outscraper reviews export to the listings they
belong to, matched on Google place_id. Businesses in the export that are not
in data/listings.json are skipped.

    python3 scripts/import_reviews.py path/to/Outscraper-reviews.xlsx

Writes data/listing-reviews.json, keyed by place_id: up to MAX_PER_SHOP
reviews that have text, newest first. Only the reviewer's display name is kept
(first name and last initial); profile photos and IDs are left out.
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
MAX_PER_SHOP = 30
MAX_CHARS = 1500


def clean(text):
    """Outscraper keeps Google's line breaks as <br> tags; turn them back into new lines."""
    return re.sub(r"\n{3,}", "\n\n", re.sub(r"<br\s*/?>", "\n", text or "", flags=re.I)).strip()


def short_name(name):
    parts = (name or "").split()
    if not parts:
        return "Google reviewer"
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0]}."


def main(path):
    listings = json.loads((ROOT / "data" / "listings.json").read_text())["listings"]
    ids = {l["place_id"] for l in listings}
    wb = openpyxl.load_workbook(path, read_only=True)
    rows = wb.active.iter_rows(values_only=True)
    head = next(rows)
    col = {name: i for i, name in enumerate(head)}

    out, skipped, seen = {}, set(), set()
    for r in rows:
        pid = r[col["place_id"]]
        if pid not in ids:
            skipped.add(pid)
            continue
        text = clean(r[col["review_text"]])
        rid = r[col["review_id"]]
        if not text or rid in seen:
            continue
        seen.add(rid)
        ts = r[col["review_timestamp"]]
        answer = clean(r[col["owner_answer"]])
        out.setdefault(pid, []).append({
            "author": short_name(r[col["author_title"]]),
            "rating": r[col["review_rating"]],
            "text": text if len(text) <= MAX_CHARS else text[:MAX_CHARS].rsplit(" ", 1)[0] + "...",
            "date": datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d") if ts else None,
            "reply": answer[:MAX_CHARS] if answer else None,
            "link": r[col["review_link"]],
        })

    for pid in out:
        out[pid].sort(key=lambda x: x["date"] or "", reverse=True)
        out[pid] = out[pid][:MAX_PER_SHOP]

    dest = ROOT / "data" / "listing-reviews.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    total = sum(len(v) for v in out.values())
    print(f"{total} reviews for {len(out)} listings -> {dest.relative_to(ROOT)}; {len(skipped)} businesses not in the directory skipped")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
