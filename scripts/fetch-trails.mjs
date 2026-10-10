#!/usr/bin/env node
/**
 * Named bike routes around each Florida town in the directory, from
 * OpenStreetMap via the Overpass API (data (c) OpenStreetMap contributors,
 * ODbL). Runs in the "City trails" Action; writes data/city-trails.json.
 *
 * For each town with a page we ask for named bike paths (highway=cycleway) and
 * named paths signed for bicycles (bicycle=designated|yes) within RADIUS
 * metres of the town, group the segments by name, and measure each route's
 * mapped length inside that radius. Nothing is estimated: a route's length,
 * surface and type are exactly what OpenStreetMap records. Elevation is not
 * included because OpenStreetMap does not carry it.
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadListings, buildIndex } from "../src/data.mjs";

const OUT = join(ROOT, "data", "city-trails.json");
const RADIUS = 8000; // metres, about 5 miles
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const MIN_MILES = 0.4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function metres(a, b) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function overpass(query) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "floridaebikerentals.com city trail guides" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(90000),
      });
      if (res.ok) return (await res.json()).elements || [];
      console.log(`  ${url} HTTP ${res.status}, retrying`);
    } catch (e) {
      console.log(`  ${url} ${e.message}, retrying`);
    }
    await sleep(15000 * (attempt + 1));
  }
  throw new Error("Overpass unavailable");
}

const SURFACE = { asphalt: "Paved", concrete: "Paved", paved: "Paved", "concrete:plates": "Paved", paving_stones: "Paved", sett: "Paved", compacted: "Packed gravel", fine_gravel: "Packed gravel", gravel: "Gravel", unpaved: "Unpaved", dirt: "Dirt", ground: "Dirt", sand: "Sand", grass: "Grass", wood: "Boardwalk" };

function routesFrom(elements, centre) {
  const byName = new Map();
  for (const el of elements) {
    if (el.type !== "way" || !el.geometry || !el.tags?.name) continue;
    const name = el.tags.name.trim();
    let m = 0;
    for (let i = 1; i < el.geometry.length; i++) {
      const a = el.geometry[i - 1], b = el.geometry[i];
      // Only count the part of the route inside the radius.
      if (metres(centre, a) <= RADIUS && metres(centre, b) <= RADIUS) m += metres(a, b);
    }
    if (!m) continue;
    const r = byName.get(name) || { name, metres: 0, surfaces: {}, types: {}, longest: { id: el.id, m: 0 } };
    r.metres += m;
    const surface = SURFACE[el.tags.surface] || (el.tags.surface ? "Other" : "Not recorded");
    r.surfaces[surface] = (r.surfaces[surface] || 0) + m;
    const type = el.tags.highway === "cycleway" ? "Bike path" : "Shared-use path";
    r.types[type] = (r.types[type] || 0) + m;
    if (m > r.longest.m) r.longest = { id: el.id, m };
    byName.set(name, r);
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  return [...byName.values()]
    .map((r) => ({
      name: r.name,
      miles: Math.round((r.metres / 1609.344) * 10) / 10,
      surface: top(r.surfaces),
      type: top(r.types),
      osm: `https://www.openstreetmap.org/way/${r.longest.id}`,
    }))
    .filter((r) => r.miles >= MIN_MILES)
    .sort((a, b) => b.miles - a.miles)
    .slice(0, 12);
}

async function main() {
  const index = buildIndex(loadListings());
  const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { cities: {} };
  out.cities ||= {};
  for (const city of index.cities) {
    if (typeof city.lat !== "number") continue;
    const q = `[out:json][timeout:80];
(
  way["highway"="cycleway"]["name"](around:${RADIUS},${city.lat},${city.lng});
  way["highway"~"^(path|footway)$"]["bicycle"~"^(designated|yes)$"]["name"](around:${RADIUS},${city.lat},${city.lng});
);
out tags geom;`;
    try {
      const routes = routesFrom(await overpass(q), { lat: city.lat, lon: city.lng });
      out.cities[city.slug] = { name: city.name, routes, totalMiles: Math.round(routes.reduce((s, r) => s + r.miles, 0) * 10) / 10 };
      console.log(`${city.name}: ${routes.length} routes, ${out.cities[city.slug].totalMiles} mi`);
    } catch (e) {
      console.log(`${city.name}: skipped (${e.message})`);
    }
    await sleep(6000);
  }
  out.updated = new Date().toISOString().slice(0, 10);
  out.source = "OpenStreetMap contributors, via the Overpass API (ODbL)";
  out.radiusMiles = 5;
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
