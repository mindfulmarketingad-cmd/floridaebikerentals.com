#!/usr/bin/env python3
"""
Outscraper Google Reviews -> site data importer for FloridaEbikeRentals.com

Usage:
    pip install openpyxl
    python3 scripts/import_outscraper_reviews.py path/to/outscraper-reviews.xlsx

Reads an Outscraper "Google Maps Reviews" export (.xlsx or .csv), keeps the ten
strongest reviews per place, and writes data/reviews.json keyed by place_id so
the build can join them onto data/listings.json.

Like the listings importer this is deliberately strict: everything written here
is treated as untrusted text by the build (HTML-escaped at render time), any URL
that is not http/https is dropped, and reviews with no readable text are skipped
because a page of empty quotes helps nobody.

Export these columns from Outscraper (the defaults include all of them):
    place_id, author_title, author_link, review_rating, review_text,
    review_datetime_utc (or review_timestamp), review_link, owner_answer
"""

import csv
import json
import math
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(ROOT, "data", "reviews.json")

PER_PLACE = 10
MIN_WORDS = 4        # one-word reviews carry no information for a reader
MAX_CHARS = 1200     # long reviews are trimmed on a word boundary at render time


def norm(value):
    """Collapse whitespace, strip control characters, return '' for empties."""
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() in ("none", "nan", "null", "#n/a"):
        return ""
    text = "".join(ch for ch in text if ch == "\n" or ch == "\t" or ord(ch) >= 32)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def safe_url(value):
    """Only http(s) URLs survive; everything else (javascript:, data:) is dropped."""
    url = norm(value)
    if not url:
        return ""
    if not re.match(r"^https?://", url, re.I):
        return ""
    if any(ch in url for ch in ('"', "<", ">", " ")):
        return ""
    return url


def to_float(value):
    try:
        f = float(str(value).strip())
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def to_int(value):
    f = to_float(value)
    return int(round(f)) if f is not None else 0


def review_date(row, get):
    """Outscraper gives either an ISO datetime or a unix timestamp. Take either."""
    iso = norm(get("review_datetime_utc"))
    if iso:
        for fmt in ("%m/%d/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
            try:
                return datetime.strptime(iso[:19], fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        if re.match(r"^\d{4}-\d{2}-\d{2}", iso):
            return iso[:10]
    stamp = to_float(get("review_timestamp"))
    if stamp and stamp > 0:
        if stamp > 1e12:          # milliseconds
            stamp /= 1000.0
        try:
            return datetime.fromtimestamp(stamp, tz=timezone.utc).strftime("%Y-%m-%d")
        except (OverflowError, OSError, ValueError):
            return ""
    return ""


def read_rows(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".csv", ".tsv"):
        delim = "\t" if ext == ".tsv" else ","
        with open(path, newline="", encoding="utf-8-sig") as fh:
            return [dict(r) for r in csv.DictReader(fh, delimiter=delim)]
    try:
        import openpyxl
    except ImportError:
        sys.exit("openpyxl is required for .xlsx imports:  pip install openpyxl")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [norm(h) for h in next(rows)]
    return [dict(zip(header, row)) for row in rows]


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: python3 scripts/import_outscraper_reviews.py <outscraper-reviews.xlsx|csv>")
    source = sys.argv[1]
    if not os.path.exists(source):
        sys.exit("no such file: %s" % source)

    rows = read_rows(source)
    by_place = defaultdict(list)
    seen = set()
    skipped_empty = 0

    for row in rows:
        def get(key):
            return row.get(key, "")

        place_id = norm(get("place_id"))
        text = norm(get("review_text"))
        if not place_id:
            continue
        if len(text.split()) < MIN_WORDS:
            skipped_empty += 1
            continue

        key = (place_id, norm(get("review_id")) or text[:80])
        if key in seen:
            continue
        seen.add(key)

        rating = to_int(get("review_rating"))
        if not 1 <= rating <= 5:
            continue

        by_place[place_id].append({
            "author": norm(get("author_title")) or "A Google reviewer",
            "author_link": safe_url(get("author_link")),
            "rating": rating,
            "text": text[:MAX_CHARS],
            "date": review_date(row, get),
            "link": safe_url(get("review_link")),
            "owner_answer": norm(get("owner_answer"))[:MAX_CHARS],
            "likes": to_int(get("review_likes")),
        })

    # Keep a readable spread rather than ten five-star raves: newest first, but
    # guarantee any critical review (3 stars or below) a place in the ten.
    kept = {}
    for place_id, reviews in by_place.items():
        reviews.sort(key=lambda r: (r["date"], r["likes"]), reverse=True)
        critical = [r for r in reviews if r["rating"] <= 3][:3]
        rest = [r for r in reviews if r not in critical]
        chosen = (critical + rest)[:PER_PLACE]
        chosen.sort(key=lambda r: r["date"], reverse=True)
        kept[place_id] = chosen

    payload = {
        "generated_from": os.path.basename(source),
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "per_place": PER_PLACE,
        "places": len(kept),
        "count": sum(len(v) for v in kept.values()),
        "reviews": kept,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=1, ensure_ascii=False)

    print("rows read:        %d" % len(rows))
    print("skipped (no text):%d" % skipped_empty)
    print("places with text: %d" % len(kept))
    print("reviews kept:     %d" % payload["count"])
    print("wrote %s" % os.path.relpath(OUT_PATH, ROOT))


if __name__ == "__main__":
    main()
