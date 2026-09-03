#!/usr/bin/env python3
"""
Outscraper -> site data importer for FloridaEbikeRentals.com

Usage:
    pip install openpyxl
    python3 scripts/import_outscraper.py path/to/outscraper-export.xlsx

Reads an Outscraper Google Maps export (.xlsx or .csv), keeps only operational
Florida businesses, normalises every field the site templates use, assigns a
region + URL slug, and writes data/listings.json.

The importer is deliberately strict: anything that ends up in data/listings.json
is treated as untrusted text by the build (it is HTML-escaped at render time),
and any URL that is not http/https is dropped here.
"""

import csv
import json
import math
import os
import re
import sys
import unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(ROOT, "data", "listings.json")

KEEP_STATE = "Florida"
KEEP_STATUS = {"OPERATIONAL"}

# Nearest-anchor region assignment. Each region has one or more anchor points;
# a listing joins the region whose closest anchor it is nearest to.
REGION_ANCHORS = [
    ("Emerald Coast & 30A", [(30.36, -86.22), (30.42, -87.22), (30.17, -85.67), (29.94, -85.30)]),
    ("North Florida", [(30.44, -84.28), (29.65, -82.33), (30.19, -82.64)]),
    ("First Coast", [(30.33, -81.66), (29.90, -81.31), (30.67, -81.45)]),
    ("Daytona & The Space Coast", [(29.21, -81.02), (28.61, -80.81), (28.08, -80.60)]),
    ("Orlando & Central Florida", [(28.54, -81.38), (29.19, -82.14), (28.04, -81.95), (28.34, -81.55)]),
    ("Tampa Bay", [(27.95, -82.46), (27.77, -82.64), (27.97, -82.80), (28.22, -82.74)]),
    ("Sarasota & Bradenton", [(27.34, -82.53), (27.50, -82.57), (27.10, -82.45)]),
    ("Southwest Florida", [(26.64, -81.87), (26.14, -81.79), (26.93, -82.05), (26.56, -81.95)]),
    ("Palm Beaches & Treasure Coast", [(26.71, -80.05), (27.19, -80.25), (27.27, -80.35), (26.37, -80.10)]),
    ("Greater Miami & Fort Lauderdale", [(25.77, -80.19), (26.12, -80.14), (25.79, -80.13), (26.01, -80.15)]),
    ("The Florida Keys", [(24.55, -81.78), (24.92, -80.63), (25.09, -80.44), (24.72, -81.05)]),
]

DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

EBIKE_HINTS = (
    "e-bike", "ebike", "e bike", "electric bike", "electric bicycle", "e-bikes",
    "ebikes", "electric-bike", "pedego", "rad power", "lectric", "e-ride",
)
TOUR_HINTS = ("tour", "tours", "guided", "excursion", "adventure")
BEACH_CITY_HINTS = ("beach", "key ", "keys", "island", "isle", "shores", "cay")

# Business types that show up in a Google Maps scrape but have nothing to do with
# renting a bike. They are dropped so the directory stays topically tight.
OFF_TOPIC_TYPES = {
    "cell phone store", "phone repair service", "electronics store",
    "import export company", "men's clothing store", "warehouse",
    "boat rental service", "canoe & kayak rental service", "car rental agency",
    "surfboard shop", "tour agency",
}
BIKE_WORDS = ("bike", "bicycle", "cycle", "cyclery", "pedal", "schwinn", "trek", "spoke")


def norm(value):
    """Collapse whitespace, strip control characters, return '' for empties."""
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() in ("none", "nan", "null", "#n/a"):
        return ""
    text = "".join(ch for ch in text if ch == "\n" or ch == "\t" or ord(ch) >= 32)
    text = re.sub(r"[ \t]+", " ", text)
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


def slugify(text, fallback="listing"):
    text = unicodedata.normalize("NFKD", str(text or ""))
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[’'`]", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    text = re.sub(r"-{2,}", "-", text)
    return text[:80].strip("-") or fallback


def to_float(value):
    try:
        f = float(str(value).strip())
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def to_int(value):
    f = to_float(value)
    return int(round(f)) if f is not None else 0


def load_json_cell(value):
    text = norm(value)
    if not text:
        return None
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        return None


def haversine(lat1, lon1, lat2, lon2):
    r = 3958.7613  # miles
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def assign_region(lat, lng):
    if lat is None or lng is None:
        return "Florida"
    best, best_d = "Florida", float("inf")
    for name, anchors in REGION_ANCHORS:
        for a_lat, a_lng in anchors:
            d = haversine(lat, lng, a_lat, a_lng)
            if d < best_d:
                best, best_d = name, d
    return best


def clean_time(text):
    text = norm(text).replace("–", "-").replace("—", "-")
    return re.sub(r"\s*-\s*", " - ", text)


def parse_hours(raw):
    """Outscraper working_hours -> ordered [{day, hours, closed}]."""
    parsed = load_json_cell(raw)
    if not isinstance(parsed, dict):
        return []
    out = []
    for day in DAY_ORDER:
        value = parsed.get(day)
        if value is None:
            continue
        if isinstance(value, list):
            text = ", ".join(clean_time(v) for v in value if norm(v))
        else:
            text = clean_time(value)
        if not text:
            continue
        out.append({"day": day, "hours": text, "closed": text.lower().startswith("closed")})
    return out


def parse_about(raw):
    """Outscraper about -> [{group, items:[...]}] keeping only enabled features."""
    parsed = load_json_cell(raw)
    if not isinstance(parsed, dict):
        return []
    groups = []
    for group, features in parsed.items():
        if not isinstance(features, dict):
            continue
        items = [norm(k) for k, v in features.items() if v is True and norm(k)]
        if items:
            groups.append({"group": norm(group), "items": sorted(items)[:14]})
    groups.sort(key=lambda g: (g["group"] != "Service options", g["group"]))
    return groups[:8]


def split_list(raw):
    text = norm(raw)
    if not text:
        return []
    return [norm(p) for p in re.split(r"\s*,\s*", text) if norm(p)]


def relevance_score(record, subtypes):
    """How much this business belongs in an e-bike rental directory (0 = drop)."""
    type_text = record["type"].lower()
    sub_text = " ".join(subtypes).lower()
    cat_text = record["category"].lower()
    name_text = record["name"].lower()
    all_text = " ".join([type_text, sub_text, cat_text, name_text, record["about_text"].lower()])

    score = 0
    if any(h in all_text for h in EBIKE_HINTS):
        score += 3
    if "electric bicycle store" in sub_text or "electric bicycle store" in type_text:
        score += 3
    if "bicycle rental" in all_text or "bike rental" in all_text:
        score += 3
    if "bicycle shop" in sub_text or "bicycle store" in cat_text:
        score += 2
    if any(w in name_text for w in BIKE_WORDS):
        score += 2
    if "bicycle repair" in all_text:
        score += 1
    if "scooter" in all_text or "golf cart" in all_text or "moped" in all_text:
        score += 1
    if type_text in OFF_TOPIC_TYPES and not any(w in name_text for w in BIKE_WORDS):
        score -= 4
    return max(0, score)


def build_tags(record, subtypes):
    haystack = " ".join([
        record["name"], record["type"], record["category"], " ".join(subtypes),
        record["about_text"],
    ]).lower()
    tags = []
    if any(h in haystack for h in EBIKE_HINTS):
        tags.append("Electric bikes")
    if "rental" in haystack or "rent" in haystack:
        tags.append("Rentals")
    if any(h in haystack for h in TOUR_HINTS):
        tags.append("Guided tours")
    if "repair" in haystack or "service" in haystack:
        tags.append("Repairs & service")
    if "scooter" in haystack or "moped" in haystack:
        tags.append("Scooters")
    if "golf cart" in haystack or "lsv" in haystack:
        tags.append("Golf carts")
    if "kayak" in haystack or "paddle" in haystack or "surf" in haystack or "water sports" in haystack:
        tags.append("Watersports")
    if "delivery" in haystack:
        tags.append("Delivery available")
    city = record["city"].lower()
    if any(h in city for h in BEACH_CITY_HINTS):
        tags.append("Beach town")
    seen, out = set(), []
    for tag in tags:
        if tag not in seen:
            seen.add(tag)
            out.append(tag)
    return out


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
        sys.exit("usage: python3 scripts/import_outscraper.py <outscraper-export.xlsx|csv>")
    source = sys.argv[1]
    raw_rows = read_rows(source)

    listings = []
    seen_place_ids = set()
    skipped = defaultdict(int)

    for row in raw_rows:
        get = lambda key: row.get(key)
        name = norm(get("name"))
        if not name:
            skipped["no name"] += 1
            continue
        if norm(get("state")) != KEEP_STATE:
            skipped["outside Florida"] += 1
            continue
        status = norm(get("business_status")).upper()
        if status and status not in KEEP_STATUS:
            skipped["not operational"] += 1
            continue
        place_id = norm(get("place_id"))
        if place_id and place_id in seen_place_ids:
            skipped["duplicate"] += 1
            continue
        if place_id:
            seen_place_ids.add(place_id)

        lat = to_float(get("latitude"))
        lng = to_float(get("longitude"))
        subtypes = split_list(get("subtypes"))
        about = parse_about(get("about"))

        record = {
            "place_id": place_id,
            "name": name,
            "city": norm(get("city")),
            "neighborhood": norm(get("county")),
            "state": "FL",
            "postal_code": norm(get("postal_code")),
            "street": norm(get("street")),
            "address": norm(get("address")),
            "phone": norm(get("phone")),
            "website": safe_url(get("website")),
            "lat": lat,
            "lng": lng,
            "rating": to_float(get("rating")) or 0.0,
            "reviews": to_int(get("reviews")),
            "reviews_link": safe_url(get("reviews_link")),
            "maps_link": safe_url(get("location_link")),
            "photo": safe_url(get("photo")),
            "street_view": safe_url(get("street_view")),
            "logo": safe_url(get("logo")),
            "category": norm(get("category")),
            "type": norm(get("type")),
            "subtypes": subtypes,
            "description": norm(get("description")),
            "verified": str(norm(get("verified"))).lower() in ("true", "1", "yes"),
            "booking_link": safe_url(get("booking_appointment_link")),
            "price_range": norm(get("range")),
            "time_spent": norm(get("typical_time_spent")),
            "hours": parse_hours(get("working_hours")),
            "about": about,
            "about_text": " ".join(i for g in about for i in g["items"]),
            "scores": {
                str(score): to_int(get("reviews_per_score_%d" % score)) for score in range(1, 6)
            },
        }

        record["region"] = assign_region(lat, lng)
        record["tags"] = build_tags(record, subtypes)
        record["relevance"] = relevance_score(record, subtypes)
        del record["about_text"]
        if record["relevance"] < 3:
            skipped["not a bike business"] += 1
            continue
        # Bayesian-style quality score: rating pulled toward 4.0 until a shop has
        # enough reviews to have earned it, then weighted by review volume.
        prior, weight = 4.0, 12.0
        blended = ((record["rating"] or prior) * record["reviews"] + prior * weight) / (record["reviews"] + weight)
        record["score"] = round(blended * (1 + math.log10(record["reviews"] + 1)) * (1 + record["relevance"] / 20.0), 4)
        record["is_ebike"] = "Electric bikes" in record["tags"]
        record["is_rental"] = bool(
            "bicycle rental service" in " ".join(subtypes + [record["type"]]).lower()
            or "rental" in record["name"].lower()
            or "rent" in record["name"].lower()
        )
        listings.append(record)

    # Deterministic, quality-first ordering, then collision-free slugs.
    listings.sort(key=lambda l: (-l["score"], l["name"].lower()))
    used = set()
    for item in listings:
        base = slugify(item["name"])
        slug = base
        if slug in used and item["city"]:
            slug = "%s-%s" % (base, slugify(item["city"]))
        counter = 2
        while slug in used:
            slug = "%s-%d" % (base, counter)
            counter += 1
        used.add(slug)
        item["slug"] = slug

    payload = {
        "generated_from": os.path.basename(source),
        "count": len(listings),
        "listings": listings,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=1, ensure_ascii=False)
        fh.write("\n")

    cities = len({l["city"] for l in listings if l["city"]})
    print("  e-bike specialists: %d  rental providers: %d" % (
        sum(1 for l in listings if l["is_ebike"]), sum(1 for l in listings if l["is_rental"])))
    regions = defaultdict(int)
    for l in listings:
        regions[l["region"]] += 1
    print("wrote %s" % os.path.relpath(OUT_PATH, ROOT))
    print("  listings: %d across %d cities" % (len(listings), cities))
    for region, count in sorted(regions.items(), key=lambda kv: -kv[1]):
        print("    %-34s %d" % (region, count))
    for reason, count in sorted(skipped.items(), key=lambda kv: -kv[1]):
        print("  skipped (%s): %d" % (reason, count))


if __name__ == "__main__":
    main()
