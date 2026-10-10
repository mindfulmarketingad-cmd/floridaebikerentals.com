#!/usr/bin/env node
/**
 * Stock photo search, step 1 of 2: finds candidate photos on Openverse for
 * each slot on the site and saves a small thumbnail of each for review.
 *
 *   node scripts/stock-search.mjs            (runs in the "Stock photos" Action)
 *
 * Only licences that allow commercial use without changing the image are kept
 * (CC0, public domain, CC BY, CC BY-SA), and only landscape photos at least
 * 1200px wide, so nothing is ever stretched. Writes stock/candidates/<slot>/
 * thumbnails plus stock/candidates.json with each photo's source, creator and
 * licence. scripts/stock-fetch.mjs then downloads the ones picked in
 * stock/picks.json at full size.
 */
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const OUT = join(ROOT, "stock", "candidates");
const API = "https://api.openverse.org/v1/images/";
const PER_SLOT = 10;

export const SLOTS = {
  // Regions
  "greater-miami-and-fort-lauderdale": ["miami beach ocean drive", "south beach miami bicycle", "fort lauderdale beach"],
  "emerald-coast-and-30a": ["seaside florida", "destin beach", "30a florida"],
  "tampa-bay": ["st petersburg florida waterfront", "clearwater beach", "tampa riverwalk"],
  "southwest-florida": ["naples florida pier", "fort myers beach", "sanibel island beach"],
  "orlando-and-central-florida": ["winter park florida", "west orange trail", "orlando lake eola"],
  "palm-beaches-and-treasure-coast": ["palm beach florida", "jupiter lighthouse florida", "delray beach"],
  "sarasota-and-bradenton": ["siesta key beach", "anna maria island", "sarasota florida bayfront"],
  "the-florida-keys": ["key west bicycle", "key west duval street", "seven mile bridge florida keys"],
  "daytona-and-the-space-coast": ["daytona beach", "new smyrna beach", "cocoa beach pier"],
  "first-coast": ["st augustine florida", "jacksonville beach pier", "amelia island"],
  "north-florida": ["florida springs", "ichetucknee springs", "tallahassee canopy road"],
  // Categories
  "ebike-rentals": ["electric bicycle", "e-bike beach"],
  "ebike-tours": ["guided bike tour", "group bicycle ride beach"],
  "beach-rentals": ["beach cruiser bicycle", "bicycles beach florida"],
  delivery: ["bicycle rental rack", "rental bikes parked"],
  "family-friendly": ["family bike ride", "children cycling park"],
  "ebike-shops": ["bicycle shop", "bike repair workshop"],
  "scooter-rentals": ["scooter rental", "moped street"],
  "open-7-days": ["bike rental shop", "bicycle rental"],
  "top-rated": ["cycling florida", "bicycle palm trees"],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q) {
  const url = `${API}?${new URLSearchParams({
    q,
    license_type: "commercial",
    license: "cc0,pdm,by,by-sa",
    category: "photograph",
    aspect_ratio: "wide",
    size: "large",
    page_size: "20",
    mature: "false",
  })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "floridaebikerentals.com stock search" } });
    if (res.status === 429) { await sleep(15000); continue; }
    if (!res.ok) throw new Error(`${q}: HTTP ${res.status}`);
    return (await res.json()).results || [];
  }
  return [];
}

async function main() {
  // stock/queries.json, when present, replaces the built-in list, and results
  // are merged into the existing candidates so earlier rounds stay reviewable.
  const QUERIES = join(ROOT, "stock", "queries.json");
  const slots = existsSync(QUERIES) ? JSON.parse(readFileSync(QUERIES, "utf8")) : SLOTS;
  const CANDIDATES = join(ROOT, "stock", "candidates.json");
  const all = existsSync(CANDIDATES) ? JSON.parse(readFileSync(CANDIDATES, "utf8")) : {};
  for (const [slot, queries] of Object.entries(slots)) {
    rmSync(join(OUT, slot), { recursive: true, force: true });
    const seen = new Set();
    const keep = [];
    for (const q of queries) {
      let results = [];
      try { results = await search(q); } catch (e) { console.log(e.message); }
      for (const r of results) {
        if (seen.has(r.id) || (r.width || 0) < 1200 || (r.width || 0) < (r.height || 0) * 1.2) continue;
        seen.add(r.id);
        keep.push({ id: r.id, query: q, title: r.title, creator: r.creator, creator_url: r.creator_url,
          license: r.license, license_version: r.license_version, license_url: r.license_url,
          landing: r.foreign_landing_url, url: r.url, thumbnail: r.thumbnail, width: r.width, height: r.height,
          source: r.source, attribution: r.attribution });
      }
      await sleep(4500);
    }
    const picks = keep.slice(0, PER_SLOT);
    mkdirSync(join(OUT, slot), { recursive: true });
    for (const [i, c] of picks.entries()) {
      try {
        const res = await fetch(c.thumbnail, { signal: AbortSignal.timeout(20000) });
        if (res.ok) {
          writeFileSync(join(OUT, slot, `${i + 1}.jpg`), Buffer.from(await res.arrayBuffer()));
          c.file = `${slot}/${i + 1}.jpg`;
        }
      } catch {}
    }
    all[slot] = picks.filter((c) => c.file);
    console.log(`${slot}: ${all[slot].length} candidates`);
  }
  writeFileSync(join(ROOT, "stock", "candidates.json"), `${JSON.stringify(all, null, 2)}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
