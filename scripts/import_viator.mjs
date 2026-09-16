#!/usr/bin/env node
/**
 * Viator -> data/tours.json importer.
 *
 *   VIATOR_API_KEY=xxxxxxxx node scripts/import_viator.mjs
 *   VIATOR_API_KEY=xxxxxxxx node scripts/import_viator.mjs --limit 40 --dry-run
 *
 * Finds bookable e-bike experiences across Florida destinations, appends your
 * affiliate parameters to every product URL, and writes them into the shape
 * /tours/ renders.
 *
 * The API key is read from the environment and is never written to disk or to
 * data/tours.json. Do not pass it as a literal in a committed file.
 *
 * Flags:
 *   --limit N     maximum tours to keep (default 40)
 *   --min N       fail if fewer than N are found (default 25)
 *   --dry-run     print what would be written, change nothing
 *   --sandbox     use api.sandbox.viator.com instead of production
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOURS_PATH = resolve(ROOT, "data", "tours.json");
const SITE_PATH = resolve(ROOT, "data", "site.json");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at !== -1 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const LIMIT = Number(flag("limit", 40));
const MIN = Number(flag("min", 25));
const DRY = has("dry-run");
const BASE = has("sandbox") ? "https://api.sandbox.viator.com/partner" : "https://api.viator.com/partner";

const KEY = process.env.VIATOR_API_KEY;
if (!KEY) {
  console.error("VIATOR_API_KEY is not set.\n\n  VIATOR_API_KEY=your-key node scripts/import_viator.mjs\n");
  process.exit(1);
}

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

const PARAMS = affiliateParams();

function withAffiliate(url) {
  try {
    const parsed = new URL(url);
    for (const [k, v] of PARAMS) parsed.searchParams.set(k, v);
    return parsed.toString();
  } catch {
    return "";
  }
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "exp-api-key": KEY,
      Accept: "application/json;version=2.0",
      "Accept-Language": "en-US",
      ...(body ? { "Content-Type": "application/json;version=2.0" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}\n${text.slice(0, 600)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${method} ${path} returned non-JSON:\n${text.slice(0, 600)}`);
  }
}

/* ------------------------------------------------------------ transforms */

const EBIKE = /\be-?bikes?\b|\belectric bikes?\b|\belectric bicycles?\b|\bebike\b/i;
const EXCLUDE = /\bhelicopter\b|\bairboat\b|\bjet ?ski\b|\bparasail\b/i;

/** Viator product -> the shape /tours/ renders. Defensive about field names. */
export function normaliseProduct(product, destinationName) {
  const title = product.title || product.productName || "";
  if (!title) return null;

  const description = product.description || product.shortDescription || "";
  if (!EBIKE.test(`${title} ${description}`)) return null;
  if (EXCLUDE.test(title)) return null;

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

  const image =
    product.images?.[0]?.variants?.slice(-1)[0]?.url ||
    product.images?.[0]?.variants?.[0]?.url ||
    product.primaryPhotoURL ||
    "";

  const flags = Array.isArray(product.flags) ? product.flags : [];
  const features = [];
  if (product.confirmationType === "INSTANT" || flags.includes("INSTANT_CONFIRMATION")) {
    features.push("Instant confirmation");
  }
  if (flags.includes("FREE_CANCELLATION")) features.push("Free cancellation");
  if (flags.includes("SKIP_THE_LINE")) features.push("Skip the line");
  if (flags.includes("PRIVATE_TOUR")) features.push("Private tour");
  if (product.ticketInfo?.ticketTypes?.includes("MOBILE_ONLY")) features.push("Mobile ticket");

  return {
    name: title,
    url,
    productCode: product.productCode || "",
    location: destinationName || "",
    price: price != null ? Math.round(Number(price) * 100) / 100 : undefined,
    priceUnit: "per person",
    priceChecked: new Date().toISOString().slice(0, 10),
    rating: rating ? Math.round(rating * 10) / 10 : undefined,
    reviews: count || undefined,
    duration: durationMin ? formatDuration(durationMin) : undefined,
    summary: description ? trim(description, 260) : undefined,
    features,
    image,
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

/* ----------------------------------------------------------------- main */

async function main() {
  console.log(`Viator import via ${BASE}`);

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
  console.log(`  ${inFlorida.length} Florida destinations`);

  const seen = new Map();
  for (const destination of inFlorida) {
    const id = destination.destinationId ?? destination.ref;
    if (id == null) continue;
    let products = [];
    try {
      const search = await api("/products/search", {
        method: "POST",
        body: {
          filtering: { destination: String(id) },
          sorting: { sort: "TRAVELER_RATING", order: "DESCENDING" },
          pagination: { start: 1, count: 50 },
          currency: "USD",
        },
      });
      products = search.products || search.data || [];
    } catch (error) {
      console.warn(`  ${destination.name}: ${String(error.message).split("\n")[0]}`);
      continue;
    }

    let kept = 0;
    for (const product of products) {
      const tour = normaliseProduct(product, destination.name);
      if (!tour) continue;
      if (seen.has(tour.productCode || tour.url)) continue;
      seen.set(tour.productCode || tour.url, tour);
      kept++;
    }
    if (kept) console.log(`  ${destination.name}: ${kept} e-bike ${kept === 1 ? "tour" : "tours"}`);
    await new Promise((r) => setTimeout(r, 120)); // stay well under the rate limit
  }

  const tours = [...seen.values()].sort((a, b) => score(b) - score(a)).slice(0, LIMIT);
  console.log(`\nfound ${seen.size} unique e-bike tours, keeping ${tours.length}`);

  if (tours.length < MIN) {
    console.error(
      `\nOnly ${tours.length} found, below the --min of ${MIN}. ` +
        `Widen the search or lower --min; not writing a short list over your existing one.`
    );
    process.exit(1);
  }

  const existing = JSON.parse(readFileSync(TOURS_PATH, "utf8"));
  const pinned = (existing.tours || []).filter((t) => t.pinned);
  const codes = new Set(tours.map((t) => t.productCode));
  const merged = [...pinned.filter((t) => !codes.has(t.productCode)), ...tours];

  const payload = { ...existing, tours: merged };

  if (DRY) {
    console.log("\n--dry-run, nothing written. First three:\n");
    console.log(JSON.stringify(merged.slice(0, 3), null, 2));
    return;
  }

  writeFileSync(TOURS_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`wrote ${merged.length} tours to data/tours.json`);
  console.log("now run:  npm run build");
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
