#!/usr/bin/env node
/**
 * Viator -> data/tours.json importer.
 *
 *   VIATOR_API_KEY=xxxxxxxx node scripts/import_viator.mjs
 *   VIATOR_API_KEY=xxxxxxxx node scripts/import_viator.mjs --limit 250 --dry-run
 *
 * Sweeps every Florida destination Viator knows about, keeps the experiences
 * this site is about -- guided e-bike rides first, then jet ski and waverunner
 * hire, boat charters, watersports and airboat trips -- appends the site's
 * affiliate parameters to every product URL, and writes them in the shape
 * /tours/ renders. Each kept tour gets its own page at /tours/<slug>/.
 *
 * The API key is read from the environment. It is never written to disk, never
 * echoed, and never stored in data/tours.json. Do not paste it into a committed
 * file: use the VIATOR_API_KEY repository secret and the "Refresh tours"
 * GitHub Action, or export it in your own shell.
 *
 * Flags:
 *   --limit N      maximum tours to keep (default 250)
 *   --min N        fail if fewer than N are found (default 25)
 *   --pages N      result pages per destination, 50 per page (default 3)
 *   --category K   restrict to one category key (repeatable)
 *   --no-details   skip the per-product detail pass (faster, one photo each)
 *   --dry-run      print what would be written, change nothing
 *   --sandbox      use api.sandbox.viator.com instead of production
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadListings, buildIndex, TOUR_CATEGORIES } from "../src/data.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOURS_PATH = resolve(ROOT, "data", "tours.json");
const SITE_PATH = resolve(ROOT, "data", "site.json");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at !== -1 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
};
const flagAll = (name) =>
  args.flatMap((a, i) => (a === `--${name}` && args[i + 1] && !args[i + 1].startsWith("--") ? [args[i + 1]] : []));
const has = (name) => args.includes(`--${name}`);

const LIMIT = Number(flag("limit", 250));
const MIN = Number(flag("min", 25));
const PAGES = Math.max(1, Number(flag("pages", 3)));
const ONLY = new Set(flagAll("category"));
const DETAILS = !has("no-details");
const DRY = has("dry-run");
const BASE = has("sandbox") ? "https://api.sandbox.viator.com/partner" : "https://api.viator.com/partner";

const KEY = process.env.VIATOR_API_KEY;

/* Affiliate parameters are taken from the link already configured for the site,
   so tracking lives in one place. */
function affiliateParams() {
  const site = JSON.parse(readFileSync(SITE_PATH, "utf8"));
  const configured = site.viator?.url || "";
  const params = new URLSearchParams();
  try {
    for (const [k, v] of new URL(configured).searchParams) {
      if (["pid", "mcid", "medium", "campaign"].includes(k)) params.set(k, v);
    }
  } catch { /* no configured link yet */ }
  if (!params.get("pid")) {
    console.error("No affiliate pid found in data/site.json -> viator.url. Add your Viator link there first.");
    process.exit(1);
  }
  return params;
}

/* Resolved on first use, not at import: the transforms below are unit-tested,
   and a test should not need a key or a configured affiliate link. */
let PARAMS = null;

function withAffiliate(url) {
  if (!PARAMS) PARAMS = affiliateParams();
  try {
    const parsed = new URL(url);
    for (const [k, v] of PARAMS) parsed.searchParams.set(k, v);
    return parsed.toString();
  } catch {
    return "";
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One API call, with a bounded retry on the responses that are worth retrying:
 * rate limiting and transient 5xx. Anything else fails loudly, since a silent
 * partial sweep would quietly shrink the page.
 */
async function api(path, { method = "GET", body, attempt = 1, retries = true } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "exp-api-key": KEY,
        Accept: "application/json;version=2.0",
        "Accept-Language": "en-US",
        ...(body ? { "Content-Type": "application/json;version=2.0" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (!retries || attempt >= 4) throw new Error(`${method} ${path} -> ${error.message}`);
    await sleep(attempt * 2000);
    return api(path, { method, body, attempt: attempt + 1 });
  }

  if (retries && (res.status === 429 || res.status >= 500) && attempt < 4) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || attempt * 2000;
    console.warn(`  HTTP ${res.status} on ${path}, retrying in ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return api(path, { method, body, attempt: attempt + 1 });
  }

  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status}\n${text.slice(0, 600)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${method} ${path} returned non-JSON:\n${text.slice(0, 600)}`);
  }
}

/* ------------------------------------------------------------ categories */

/**
 * Tested in order, so the more specific pattern wins: an airboat is not a boat
 * charter, and a "snorkel cruise" is a watersport before it is a sailing trip.
 */
const MATCHERS = [
  ["ebike", /\be-?bikes?\b|\belectric bikes?\b|\belectric bicycles?\b|\bebike\b|\be-?cycling\b/i],
  ["jetski", /\bjet ?skis?\b|\bwave ?runners?\b|\bsea-?doo\b|\bpersonal watercraft\b|\bpwc\b/i],
  ["airboat", /\bair ?boats?\b|\bswamp buggy\b/i],
  [
    "watersports",
    /\bparasail|\bkayak|\bpaddle ?board|\bsup\b|\bsnorkel|\bscuba\b|\bdiving\b|\bflyboard|\bjet ?pack|\btubing\b|\bbanana boat\b|\bwater ?sports?\b|\bwakeboard|\bsurf(?:ing|board)|\bhydrofoil|\bwater ?ski/i,
  ],
  [
    "boat",
    /\bboats?\b|\bcatamarans?\b|\bsail(?:ing|boat)?\b|\byachts?\b|\bcruises?\b|\bpontoons?\b|\bcharters?\b|\bspeedboat|\bdolphin watch|\bsunset sail/i,
  ],
];

/* Things that sometimes carry a matching word but are not what this page is
   for: a helicopter tour of the Keys is not a boat trip. */
const EXCLUDE = /\bhelicopter\b|\bseaplane\b|\bskydiv|\bhot air balloon\b|\bmonster truck\b|\bswamp buggy racing\b/i;

export function categorise(text) {
  if (EXCLUDE.test(text)) return null;
  for (const [key, pattern] of MATCHERS) if (pattern.test(text)) return key;
  return null;
}

/* ------------------------------------------------------------ transforms */

/* Viator serves each photo at several sizes. These are the widths the site
   actually renders an image at, so the variant nearest each is the one worth
   asking for: the card is roughly 400px wide, the detail hero roughly 800. */
const TARGET_WIDTH = 800;
const MAX_GALLERY = 4;

/** The variant closest to a target width, preferring one at or above it. */
function bestVariant(variants, target) {
  const usable = (Array.isArray(variants) ? variants : []).filter((v) => v && v.url);
  if (!usable.length) return null;
  const sized = usable.filter((v) => Number(v.width) > 0);
  if (!sized.length) return { url: usable[usable.length - 1].url };
  const atOrAbove = sized.filter((v) => Number(v.width) >= target);
  const pool = atOrAbove.length ? atOrAbove : sized;
  return pool.reduce((best, v) =>
    Math.abs(Number(v.width) - target) < Math.abs(Number(best.width) - target) ? v : best
  );
}

/**
 * Cover photo first, then up to MAX_GALLERY more for the tour's own page.
 * Viator marks a cover with isCover; when nothing does, the first image wins,
 * which is the order Viator returns them in anyway.
 */
export function pickImages(product) {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const ordered = [...images].sort((a, b) => Number(Boolean(b.isCover)) - Number(Boolean(a.isCover)));

  const picked = [];
  const seen = new Set();
  for (const image of ordered.slice(0, MAX_GALLERY + 1)) {
    const variant = bestVariant(image.variants, TARGET_WIDTH);
    const src = variant?.url || "";
    if (!/^https:\/\//i.test(src) || seen.has(src)) continue;
    seen.add(src);
    picked.push({
      src,
      ...(Number(variant.width) > 0
        ? { width: Number(variant.width), height: Number(variant.height) || undefined }
        : {}),
      ...(image.caption ? { caption: trim(image.caption, 140) } : {}),
    });
  }

  // Older payloads only carry a single flat URL.
  if (!picked.length && /^https:\/\//i.test(product.primaryPhotoURL || "")) {
    picked.push({ src: product.primaryPhotoURL });
  }
  return picked;
}

/** Viator product -> the shape /tours/ renders. Defensive about field names. */
export function normaliseProduct(product, place) {
  const title = product.title || product.productName || "";
  if (!title) return null;

  const description = product.description || product.shortDescription || "";
  const category = categorise(`${title} ${description}`);
  if (!category) return null;
  if (ONLY.size && !ONLY.has(category)) return null;

  const url = withAffiliate(product.productUrl || product.webURL || "");
  if (!url) return null;

  const reviews = product.reviews || {};
  const rating = Number(reviews.combinedAverageRating ?? reviews.averageRating ?? 0) || null;
  const count = Number(reviews.totalReviews ?? reviews.reviewCount ?? 0) || 0;

  const price =
    product.pricing?.summary?.fromPrice ??
    product.pricing?.summary?.fromPriceBeforeDiscount ??
    product.fromPrice ??
    null;

  const durationMin =
    product.duration?.fixedDurationInMinutes ??
    product.duration?.variableDurationFromMinutes ??
    null;

  const photos = pickImages(product);
  const [cover, ...gallery] = photos;

  const flags = Array.isArray(product.flags) ? product.flags : [];
  const features = [];
  if (product.confirmationType === "INSTANT" || flags.includes("INSTANT_CONFIRMATION")) {
    features.push("Instant confirmation");
  }
  if (flags.includes("FREE_CANCELLATION")) features.push("Free cancellation");
  if (flags.includes("SKIP_THE_LINE")) features.push("Skip the line");
  if (flags.includes("PRIVATE_TOUR")) features.push("Private tour");
  if (flags.includes("LIKELY_TO_SELL_OUT")) features.push("Likely to sell out");
  if (product.ticketInfo?.ticketTypes?.includes("MOBILE_ONLY")) features.push("Mobile ticket");

  return {
    name: title,
    category,
    url,
    productCode: product.productCode || "",
    location: place.name || "",
    ...(place.region ? { region: place.region } : {}),
    ...(place.citySlug ? { citySlug: place.citySlug } : {}),
    price: price != null ? Math.round(Number(price) * 100) / 100 : undefined,
    priceUnit: "per person",
    priceChecked: new Date().toISOString().slice(0, 10),
    rating: rating ? Math.round(rating * 10) / 10 : undefined,
    reviews: count || undefined,
    duration: durationMin ? formatDuration(durationMin) : undefined,
    summary: description ? trim(description, 260) : undefined,
    features,
    image: cover?.src || "",
    ...(cover?.width ? { imageWidth: cover.width, imageHeight: cover.height } : {}),
    ...(cover?.caption ? { imageCaption: cover.caption } : {}),
    ...(gallery.length ? { gallery } : {}),
  };
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} hour${h > 1 ? "s" : ""} ${m} minutes`;
  if (h) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${m} minutes`;
}

function trim(text, max) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** Rating weighted by review volume, so a 5.0 from 3 reviews does not lead. */
export function score(tour) {
  return (tour.rating || 0) * Math.log10((tour.reviews || 0) + 10);
}

/**
 * Fills the cap category by category rather than taking the global top N.
 * E-bikes go in first because they are what this site is for; the rest take
 * turns, so one big category cannot crowd the others off the page.
 */
export function balance(tours, limit) {
  const byCategory = new Map();
  for (const tour of tours) {
    if (!byCategory.has(tour.category)) byCategory.set(tour.category, []);
    byCategory.get(tour.category).push(tour);
  }
  for (const list of byCategory.values()) list.sort((a, b) => score(b) - score(a));

  const kept = [...(byCategory.get("ebike") || []).slice(0, limit)];
  byCategory.delete("ebike");

  const queues = [...byCategory.values()];
  let added = true;
  while (kept.length < limit && added) {
    added = false;
    for (const queue of queues) {
      if (kept.length >= limit) break;
      const next = queue.shift();
      if (next) {
        kept.push(next);
        added = true;
      }
    }
  }
  return kept;
}

/**
 * The search endpoint returns one photo per product. The full set only comes
 * from the product's own record, so the kept tours -- and only those, not every
 * product matched -- need one extra call each to fill in their gallery.
 *
 * Those lookups are slow: a full first pass over 250 of them takes around 25
 * minutes. The thing that makes that acceptable is that photo sets barely
 * change, so a tour whose gallery we already have is skipped. The first run
 * pays the cost once and every refresh afterwards only looks up what is new.
 *
 * It is still best-effort: every tour already has its cover from the sweep, so
 * a gallery must never hold up an import that is otherwise done. A few run at a
 * time, none retry, a rate limit stops the pass, and a wall-clock budget ends
 * it whatever is left. Anything not reached keeps its cover and is tried again
 * on the next run.
 */
const DETAIL_BUDGET_MS = 15 * 60 * 1000;
const DETAIL_POOL = 3;

/** Photo sets already in data/tours.json, by product code. */
function knownPhotos(existing) {
  const map = new Map();
  for (const tour of existing.tours || []) {
    if (tour.productCode && (tour.gallery || []).length) {
      map.set(tour.productCode, {
        image: tour.image,
        imageWidth: tour.imageWidth,
        imageHeight: tour.imageHeight,
        imageCaption: tour.imageCaption,
        gallery: tour.gallery,
      });
    }
  }
  return map;
}

function applyPhotos(tour, photos) {
  const [cover, ...gallery] = photos;
  tour.image = cover.src;
  if (cover.width) {
    tour.imageWidth = cover.width;
    tour.imageHeight = cover.height;
  }
  if (cover.caption) tour.imageCaption = cover.caption;
  tour.gallery = gallery;
}

async function addGalleries(tours, known) {
  let reused = 0;
  const queue = [];
  for (const tour of tours) {
    if (!tour.productCode) continue;
    const have = known.get(tour.productCode);
    if (have) {
      Object.assign(tour, have);
      reused++;
    } else {
      queue.push(tour);
    }
  }
  if (reused) console.log(`  ${reused} photo sets carried over from the existing file`);
  if (!queue.length) return;

  const deadline = Date.now() + DETAIL_BUDGET_MS;
  let at = 0;
  let improved = 0;
  let failed = 0;
  let stopped = "";

  async function worker() {
    while (!stopped) {
      if (Date.now() > deadline) {
        stopped = "time budget reached";
        return;
      }
      const tour = queue[at++];
      if (!tour) return;

      let detail;
      try {
        // No retries: retrying into a rate limit is what makes a pass like this
        // slow, not what fixes it.
        detail = await api(`/products/${encodeURIComponent(tour.productCode)}`, { retries: false });
      } catch (error) {
        if (/HTTP 429/.test(error.message)) {
          stopped = "rate limited";
          return;
        }
        failed++;
        continue;
      }

      const photos = pickImages(detail);
      if (photos.length > 1) {
        applyPhotos(tour, photos);
        improved++;
      }
    }
  }

  await Promise.all(Array.from({ length: DETAIL_POOL }, worker));

  const tried = Math.min(at, queue.length);
  console.log(
    `  looked up ${tried} of ${queue.length} new tours, ${improved} with extra photos` +
      (failed ? `, ${failed} failed` : "") +
      (stopped ? ` (stopped early: ${stopped}; the rest keep their cover and are retried next run)` : "")
  );
}

/* ----------------------------------------------------------------- main */

/** Viator destination -> the town and region this site already knows about. */
function placeResolver() {
  const index = buildIndex(loadListings());
  const cities = new Map(index.cities.map((c) => [c.name.toLowerCase(), c]));
  return (name) => {
    const city = cities.get(String(name || "").toLowerCase());
    return city
      ? { name: city.name, citySlug: city.slug, region: city.region }
      : { name: name || "" };
  };
}

async function main() {
  if (!KEY) {
    console.error(
      "VIATOR_API_KEY is not set.\n\n" +
        "  VIATOR_API_KEY=your-key node scripts/import_viator.mjs\n\n" +
        "In CI it comes from the repository secret of the same name.\n"
    );
    process.exit(1);
  }
  console.log(`Viator import via ${BASE}`);
  if (ONLY.size) console.log(`restricted to: ${[...ONLY].join(", ")}`);

  const resolvePlace = placeResolver();

  console.log("fetching destinations…");
  const destResponse = await api("/destinations");
  const destinations = destResponse.destinations || destResponse || [];

  const florida = destinations.find(
    (d) => /^florida$/i.test(d.name || "") && /STATE|REGION/i.test(d.type || "")
  );
  const floridaId = florida?.destinationId ?? florida?.ref;

  const inFlorida = destinations.filter((d) => {
    if (floridaId && (d.parentDestinationId === floridaId || d.destinationId === floridaId)) return true;
    const lineage = Array.isArray(d.lookupId) ? d.lookupId.join(".") : String(d.lookupId || "");
    return floridaId ? lineage.includes(String(floridaId)) : false;
  });

  if (!inFlorida.length) {
    throw new Error(
      `Found no Florida destinations in ${destinations.length} returned. ` +
        `Re-run with --dry-run and check the destination schema.`
    );
  }
  console.log(`  ${inFlorida.length} Florida destinations, up to ${PAGES * 50} products each\n`);

  const seen = new Map();
  for (const destination of inFlorida) {
    const id = destination.destinationId ?? destination.ref;
    if (id == null) continue;
    const place = resolvePlace(destination.name);

    let kept = 0;
    for (let pageNumber = 0; pageNumber < PAGES; pageNumber++) {
      let products = [];
      try {
        const search = await api("/products/search", {
          method: "POST",
          body: {
            filtering: { destination: String(id) },
            sorting: { sort: "TRAVELER_RATING", order: "DESCENDING" },
            pagination: { start: pageNumber * 50 + 1, count: 50 },
            currency: "USD",
          },
        });
        products = search.products || search.data || [];
      } catch (error) {
        console.warn(`  ${destination.name}: ${String(error.message).split("\n")[0]}`);
        break;
      }
      if (!products.length) break;

      for (const product of products) {
        const tour = normaliseProduct(product, place);
        if (!tour) continue;
        const key = tour.productCode || tour.url;
        if (seen.has(key)) continue;
        seen.set(key, tour);
        kept++;
      }
      await sleep(150); // stay well under the rate limit
    }
    if (kept) console.log(`  ${destination.name.padEnd(28)} ${kept}`);
  }

  const all = [...seen.values()];
  const tours = balance(all, LIMIT).sort((a, b) => score(b) - score(a));

  const tally = new Map();
  for (const tour of tours) tally.set(tour.category, (tally.get(tour.category) || 0) + 1);
  console.log(`\nmatched ${all.length} experiences, keeping ${tours.length}:`);
  for (const category of TOUR_CATEGORIES) {
    const n = tally.get(category.key) || 0;
    if (n) console.log(`  ${category.name.padEnd(24)} ${n}`);
  }

  const existing = JSON.parse(readFileSync(TOURS_PATH, "utf8"));

  if (DETAILS && tours.length) {
    console.log(`\nfilling in photo sets…`);
    await addGalleries(tours, knownPhotos(existing));
  }

  if (tours.length < MIN) {
    console.error(
      `\nOnly ${tours.length} found, below the --min of ${MIN}. ` +
        `Widen the search or lower --min; not writing a short list over your existing one.`
    );
    process.exit(1);
  }

  const pinned = (existing.tours || []).filter((t) => t.pinned);
  const codes = new Set(tours.map((t) => t.productCode));
  const merged = [...pinned.filter((t) => !codes.has(t.productCode)), ...tours];

  const payload = { ...existing, updated: new Date().toISOString().slice(0, 10), tours: merged };

  if (DRY) {
    console.log("\n--dry-run, nothing written. First three:\n");
    console.log(JSON.stringify(merged.slice(0, 3), null, 2));
    return;
  }

  writeFileSync(TOURS_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`\nwrote ${merged.length} tours to data/tours.json`);
  console.log("now run:  npm run verify");
}

/* Only sweep the API when run as a command. Imported (by the test suite, say)
   this file is just its transforms. */
const RUN_DIRECTLY = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (RUN_DIRECTLY) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
