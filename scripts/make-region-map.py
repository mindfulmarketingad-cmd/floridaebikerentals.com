#!/usr/bin/env python3
"""
Builds the clickable Florida region map used on the homepage.

    python3 scripts/make-region-map.py

Reads the vendored county boundaries in data/source/florida-counties.geo.json
(US Census cartographic boundaries, public domain) and writes
data/region-map.json: one simplified SVG path per directory region, plus the
point each region's label sits on.

Counties are assigned to a region with the same nearest-anchor rule the
importer uses for listings (REGION_ANCHORS in scripts/import_outscraper.py),
so a county is drawn in the region its shops are actually filed under. The
anchors are imported from that module rather than copied, so the two can
never drift apart.
"""
import json
import math
import os
import sys

from shapely.geometry import shape, mapping
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from import_outscraper import REGION_ANCHORS  # noqa: E402

COUNTIES = os.path.join(ROOT, "data", "source", "florida-counties.geo.json")
OUT = os.path.join(ROOT, "data", "region-map.json")

# The state is drawn 1000 units wide; the height follows from Florida's aspect.
WIDTH = 1000.0
# Cutting every vertex closer than this (in degrees) keeps the coastline
# readable at map size while dropping most of the file weight.
SIMPLIFY = 0.006
# Room added on the right for labels that will not fit inside their region.
GUTTER = 290.0

# Where each region's name goes. The Atlantic regions are long thin strips and
# the Gulf ones are narrow, so most names sit outside the shape on a leader
# line - the same thing the paper county maps do. "at" is the leader's anchor
# inside the shape (defaults to the region's representative point); "text" is
# where the label itself sits. Anything not listed is drawn inside the shape.
#   place: "in" - centred in the shape | "left"/"right" - out on a leader line
LABELS = {
    "Emerald Coast & 30A": {"place": "in", "at": (240, 105)},
    "North Florida": {"place": "in", "at": (600, 180)},
    "Orlando & Central Florida": {"place": "in", "at": (785, 292), "lines": ["Orlando &", "Central Florida"]},
    "Southwest Florida": {"place": "in", "at": (800, 640), "lines": ["Southwest", "Florida"]},
    "First Coast": {"place": "right", "at": (790, 120), "text": (1020, 120)},
    "Daytona & The Space Coast": {"place": "right", "at": (900, 330), "text": (1020, 322),
                                  "lines": ["Daytona &", "The Space Coast"]},
    "Palm Beaches & Treasure Coast": {"place": "right", "at": (935, 590), "text": (1020, 582),
                                      "lines": ["Palm Beaches &", "Treasure Coast"]},
    "Greater Miami & Fort Lauderdale": {"place": "right", "at": (945, 780), "text": (1020, 772),
                                        "lines": ["Greater Miami &", "Fort Lauderdale"]},
    "Tampa Bay": {"place": "left", "at": (680, 420), "text": (560, 420)},
    "Sarasota & Bradenton": {"place": "left", "at": (690, 550), "text": (560, 542),
                             "lines": ["Sarasota &", "Bradenton"]},
    "The Florida Keys": {"place": "left", "at": (800, 845), "text": (620, 878)},
}


def region_for(lat, lng):
    """The region whose nearest anchor point is closest - the importer's rule."""
    best, best_d = None, float("inf")
    for name, anchors in REGION_ANCHORS:
        for alat, alng in anchors:
            d = (lat - alat) ** 2 + ((lng - alng) * math.cos(math.radians(lat))) ** 2
            if d < best_d:
                best_d, best = d, name
    return best


def main():
    counties = json.load(open(COUNTIES))["features"]

    grouped = {}
    for feature in counties:
        geom = shape(feature["geometry"])
        point = geom.representative_point()
        grouped.setdefault(region_for(point.y, point.x), []).append(geom)

    merged = {name: unary_union(geoms).simplify(SIMPLIFY) for name, geoms in grouped.items()}

    # Equirectangular projection, x stretched by cos(lat) so the state is not
    # squashed. One state is small enough that nothing fancier is warranted.
    bounds = unary_union(list(merged.values())).bounds
    min_lng, min_lat, max_lng, max_lat = bounds
    k = math.cos(math.radians((min_lat + max_lat) / 2))
    scale = WIDTH / ((max_lng - min_lng) * k)
    height = round((max_lat - min_lat) * scale, 1)

    def project(lng, lat):
        return (
            round((lng - min_lng) * k * scale, 1),
            round((max_lat - lat) * scale, 1),
        )

    def path_of(geom):
        polys = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
        out = []
        for poly in polys:
            for ring in [poly.exterior] + list(poly.interiors):
                pts = [project(x, y) for x, y in ring.coords]
                if len(pts) < 4:
                    continue
                out.append("M" + "L".join(f"{x} {y}" for x, y in pts) + "Z")
        return "".join(out)

    regions = []
    for name, geom in merged.items():
        cfg = LABELS.get(name, {})
        fallback = geom.representative_point()
        anchor = cfg.get("at") or project(fallback.x, fallback.y)
        place = cfg.get("place", "in")
        # Regions are matched to the directory by name, not by a slug computed
        # here - the site owns slug spelling, and a second implementation of it
        # would only drift.
        regions.append({
            "name": name,
            "d": path_of(geom),
            "place": place,
            "anchor": list(anchor),
            "text": list(cfg.get("text") or anchor),
            "lines": cfg.get("lines") or [name],
            "counties": len(grouped[name]),
        })
    regions.sort(key=lambda r: r["name"])

    json.dump(
        {
            "width": WIDTH + GUTTER,
            "height": height,
            # The projection itself, so the browser can place a coordinate on
            # the drawing: x = (lng - minLng) * k * scale, y = (maxLat - lat) * scale.
            "projection": {
                "minLng": round(min_lng, 6),
                "maxLat": round(max_lat, 6),
                "k": round(k, 6),
                "scale": round(scale, 4),
            },
            "regions": regions,
        },
        open(OUT, "w"), separators=(",", ":"),
    )
    print(f"{OUT}: {os.path.getsize(OUT)} bytes, {len(regions)} regions, "
          f"viewBox 0 0 {WIDTH + GUTTER:.0f} {height}")
    for r in regions:
        print(f"  {r['counties']:2} counties  {r['place']:5}  {r['name']}")


if __name__ == "__main__":
    main()
