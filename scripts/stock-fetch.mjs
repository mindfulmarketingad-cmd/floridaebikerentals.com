#!/usr/bin/env node
/**
 * Stock photo search, step 2 of 2: downloads each photo picked in
 * stock/picks.json ({ slot: candidateId }) at full size, saves it at 1600px
 * and 800px wide (never wider than the original) into assets/img/stock/, and
 * records its credit and licence in data/stock-photos.json for the captions.
 * Clears the review thumbnails afterwards. Needs sharp (installed by the Action).
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const OUT = join(ROOT, "assets", "img", "stock");
const MANIFEST = join(ROOT, "data", "stock-photos.json");
const candidates = JSON.parse(readFileSync(join(ROOT, "stock", "candidates.json"), "utf8"));
const picks = JSON.parse(readFileSync(join(ROOT, "stock", "picks.json"), "utf8"));
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
mkdirSync(OUT, { recursive: true });

for (const [slot, id] of Object.entries(picks)) {
  const c = (candidates[slot] || []).find((x) => x.id === id) || Object.values(candidates).flat().find((x) => x.id === id);
  if (!c) { console.log(`${slot}: candidate ${id} not found`); continue; }
  try {
    const res = await fetch(c.url, { signal: AbortSignal.timeout(60000), headers: { "User-Agent": "floridaebikerentals.com" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if ((meta.width || 0) < 1200) throw new Error(`only ${meta.width}px wide`);
    const big = Math.min(1600, meta.width);
    const out = {};
    for (const [suffix, w] of [["", big], ["-800", Math.min(800, meta.width)]]) {
      const file = `${slot}${suffix}.jpg`;
      const info = await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(join(OUT, file));
      out[suffix || "full"] = { src: `/assets/img/stock/${file}`, width: info.width, height: info.height };
    }
    manifest[slot] = {
      src: out.full.src, width: out.full.width, height: out.full.height,
      small: out["-800"].src, smallWidth: out["-800"].width, smallHeight: out["-800"].height,
      title: c.title, creator: c.creator, creatorUrl: c.creator_url, license: c.license,
      licenseVersion: c.license_version, licenseUrl: c.license_url, landing: c.landing, source: c.source,
    };
    console.log(`${slot}: saved ${out.full.width}x${out.full.height} (${c.license} ${c.license_version || ""})`);
  } catch (e) {
    console.log(`${slot}: failed - ${e.message}`);
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2)}\n`);
rmSync(join(ROOT, "stock", "candidates"), { recursive: true, force: true });
