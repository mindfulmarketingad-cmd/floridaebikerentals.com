#!/usr/bin/env node
/**
 * Downloads the boundary of every town with a /cities/ page, plus Florida's
 * outline, for the clickable map on /cities/.
 *
 *   node scripts/fetch-city-boundaries.mjs
 *
 * Town boundaries are US Census TIGER "places" (public domain), as GeoJSON from
 * github.com/generalpiston/geojson-us-city-boundaries. Unincorporated beach
 * communities often have no Census boundary; those are drawn as a pin at the
 * centre of their shops instead. Florida's outline is the Census state shape
 * from the us-atlas package. Everything is simplified and written to
 * data/city-boundaries.json.
 */
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ROOT, loadListings, buildIndex } from "../src/data.mjs";

const RAW = "https://raw.githubusercontent.com/generalpiston/geojson-us-city-boundaries/master/cities/fl/";
const round = (n) => Math.round(n * 1e4) / 1e4;

/** Drop points closer than `tol` degrees to the last kept one (enough for a state-scale map). */
function thin(ring, tol) {
  const out = [];
  for (const [x, y] of ring) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(x - last[0], y - last[1]) >= tol) out.push([round(x), round(y)]);
  }
  return out.length >= 4 ? out : ring.map(([x, y]) => [round(x), round(y)]);
}

function rings(geometry, tol) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polys.map((p) => thin(p[0], tol)).filter((r) => r.length >= 4);
}

function names(city) {
  const base = city.name.toLowerCase();
  const kebab = (t) => t.replace(/\s+/g, "-");
  return [...new Set([city.slug, kebab(base), kebab(base.replace(/^st\.? /, "st. ")), kebab(base.replace(/^st\.? /, "saint ")), kebab(base.replace(/-/g, " "))])];
}

const index = buildIndex(loadListings());
const towns = {};
let found = 0;
for (const city of index.cities) {
  let shape = null;
  for (const n of names(city)) {
    const res = await fetch(RAW + encodeURIComponent(n) + ".json");
    if (!res.ok) continue;
    const fc = await res.json();
    const f = (fc.features || []).find((x) => x.geometry) || null;
    if (f) { shape = rings(f.geometry, 0.0015); break; }
  }
  towns[city.slug] = shape && shape.length ? { rings: shape } : null;
  if (shape) found++;
  process.stdout.write(shape ? "." : "o");
}
console.log(`\n${found} of ${index.cities.length} towns have a Census boundary`);

// Florida outline from us-atlas (Census cartographic boundary, TopoJSON).
const dir = mkdtempSync(join(tmpdir(), "us-atlas-"));
execFileSync("npm", ["pack", "us-atlas@3.0.1", "--pack-destination", dir], { stdio: "ignore" });
execFileSync("tar", ["-xzf", join(dir, "us-atlas-3.0.1.tgz"), "-C", dir]);
const topo = JSON.parse(readFileSync(join(dir, "package", "states-10m.json"), "utf8"));
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => [(x += dx) * scale[0] + translate[0], (y += dy) * scale[1] + translate[1]]);
});
const arcPts = (i) => (i >= 0 ? arcs[i] : arcs[~i].slice().reverse());
const fl = topo.objects.states.geometries.find((g) => g.properties.name === "Florida");
const polys = fl.type === "Polygon" ? [fl.arcs] : fl.arcs;
const outline = polys
  .map((p) => thin(p[0].flatMap((i, k) => (k ? arcPts(i).slice(1) : arcPts(i))), 0.01))
  .filter((r) => r.length >= 4);

writeFileSync(join(ROOT, "data", "city-boundaries.json"), JSON.stringify({ source: "US Census TIGER places (2019) and us-atlas 3.0.1 states", florida: outline, towns }));
console.log("wrote data/city-boundaries.json");
