#!/usr/bin/env node
/**
 * Downloads each listing's Google photo into assets/img/listings/ so the site
 * serves it from its own domain.
 *
 *   node scripts/cache-photos.mjs [--force]
 *
 * Why: the photo URLs in the Google Maps export are signed links to Google's
 * image CDN. They expire, and Street View links refuse requests from other
 * sites outright, so a hotlinked photo works on import day and turns into an
 * empty box weeks later. Copying the file at import time fixes that for good.
 *
 * Writes data/listing-photos.json, { slug: { src, width, height } }, with the
 * dimensions read from the file itself so pages never stretch an image past
 * its real size. A photo that cannot be fetched is left out, and the page
 * shows the region's illustration instead. Existing files are kept unless
 * --force is passed, so a re-run only fetches what is new.
 *
 * Runs in the "Cache listing photos" GitHub Action; there is no npm dependency.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadListings } from "../src/data.mjs";

const OUT_DIR = join(ROOT, "assets/img/listings");
const MANIFEST = join(ROOT, "data/listing-photos.json");
const force = process.argv.includes("--force");
const POOL = 6;

/** Width and height from a JPEG, PNG or WebP header, or null. */
export function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { type: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { type: "webp", width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { type: "webp", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { type: "webp", width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: "jpg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

async function fetchPhoto(url) {
  const res = await fetch(url, {
    headers: { Accept: "image/jpeg,image/png,image/*;q=0.8", "User-Agent": "Mozilla/5.0 (photo cache)" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return { error: `not an image (${type})` };
  const buf = Buffer.from(await res.arrayBuffer());
  const size = imageSize(buf);
  if (!size) return { error: "unreadable image" };
  // Google answers some dead links with a tiny placeholder rather than an error.
  if (size.width < 200 || size.height < 120) return { error: `too small (${size.width}x${size.height})` };
  return { buf, size };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const listings = loadListings({ raw: true }).filter((l) => l.photo && /^https:\/\//.test(l.photo));
  const live = new Set(listings.map((l) => l.slug));
  const todo = listings.filter((l) => force || !manifest[l.slug] || !existsSync(join(ROOT, manifest[l.slug].src)));
  const failures = {};
  let fetched = 0;

  const queue = [...todo];
  await Promise.all(
    Array.from({ length: POOL }, async () => {
      while (queue.length) {
        const l = queue.shift();
        try {
          const got = await fetchPhoto(l.photo);
          if (got.error) { failures[got.error] = (failures[got.error] || 0) + 1; continue; }
          const file = `${l.slug}.${got.size.type}`;
          writeFileSync(join(OUT_DIR, file), got.buf);
          manifest[l.slug] = { src: `/assets/img/listings/${file}`, width: got.size.width, height: got.size.height };
          fetched++;
        } catch (err) {
          const key = err.name === "TimeoutError" ? "timeout" : err.message;
          failures[key] = (failures[key] || 0) + 1;
        }
      }
    })
  );

  // Drop photos for businesses no longer in the directory.
  for (const slug of Object.keys(manifest)) {
    if (!live.has(slug)) delete manifest[slug];
  }
  const keep = new Set(Object.values(manifest).map((m) => m.src.split("/").pop()));
  for (const file of readdirSync(OUT_DIR)) if (!file.startsWith(".") && !keep.has(file)) unlinkSync(join(OUT_DIR, file));

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Listings with a source photo: ${listings.length}. Tried: ${todo.length}. Saved: ${fetched}. Cached in total: ${Object.keys(sorted).length}.`);
  if (Object.keys(failures).length) console.log("Not saved:", failures);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
