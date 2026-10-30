/**
 * Viator experiences: categories, the importer's transforms and API sweep, and
 * the loader the build uses.
 *
 * The live site never calls Viator. Tours are fetched ahead of time and written
 * into static HTML:
 *   - data/tours.json is the committed snapshot every build can fall back on;
 *   - scripts/refresh-tours.mjs rewrites it from the API (run it anywhere the
 *     VIATOR_API_KEY is set);
 *   - a production build on Vercel, where the key lives, refreshes the snapshot
 *     inside the build container before rendering (see build.mjs). That costs a
 *     few dozen API calls once per deploy and nothing per visitor.
 *
 * The API key is only ever read from the environment. It is never written to
 * disk, logged, or stored in data/tours.json.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "./util.mjs";
import { ROOT } from "./data.mjs";

/** Filter order on /tours/: e-bikes lead, as they do everywhere on the site. */
export const TOUR_CATEGORIES = [
  { key: "ebike", name: "E-bike tours", short: "E-bike" },
  { key: "bike", name: "Bike tours", short: "Bike" },
  { key: "boat", name: "Boat & sailing", short: "Boat" },
  { key: "watersports", name: "Kayak, paddle & watersports", short: "Watersports" },
  { key: "jetski", name: "Jet ski & watercraft", short: "Jet ski" },
  { key: "airboat", name: "Airboat & Everglades", short: "Airboat" },
  { key: "other", name: "More experiences", short: "More" },
];
const CATEGORY_KEYS = new Set(TOUR_CATEGORIES.map((c) => c.key));
export const categoryName = (key) => (TOUR_CATEGORIES.find((c) => c.key === key) || {}).name || "Experiences";

/* Tested in order, so the more specific pattern wins. */
const MATCHERS = [
  ["ebike", /\be[ -]?bikes?\b|\belectric (?:bikes?|bicycles?)\b|\bebike\b|\be-?cycling\b|\bfat[- ]tire e/i],
  ["bike", /\bbik(?:e|es|ing)\b|\bbicycl|\bcycling\b|\bcycle tour/i],
  ["jetski", /\bjet ?skis?\b|\bwave ?runners?\b|\bsea-?doo\b|\bpersonal watercraft\b/i],
  ["airboat", /\bair ?boats?\b|\bswamp buggy\b/i],
  ["watersports", /\bswim(?:ming)? (?:with|tour)|\bswim\b|\bparasail|\bkayak|\bpaddle ?board|\bsup\b|\bsnorkel|\bscuba\b|\bdiving\b|\bflyboard|\btubing\b|\bwater ?sports?\b|\bsurf(?:ing|board)|\bhydrofoil/i],
  ["boat", /\btiki\b|\bboats?\b|\bcatamarans?\b|\bsail(?:ing|boat)?\b|\byachts?\b|\bcruises?\b|\bpontoons?\b|\bcharters?\b|\bdolphin watch/i],
];
/* Not what a visitor to an e-bike site is shopping for. */
const EXCLUDE = /\bhelicopter\b|\bseaplane\b|\bskydiv|\bhot air balloon\b|\btheme park ticket|\bairport (?:transfer|shuttle)\b|\bshuttle\b|\btransfer\b|\bbus tour\b|\bday trip to\b|\bfrom orlando to\b|\bticket\b/i;

/** Category from the title first (the strongest signal), then the description. */
export function categorise(title, description = "", { allowOther = true } = {}) {
  if (EXCLUDE.test(title)) return null;
  for (const [key, re] of MATCHERS) if (re.test(title)) return key;
  for (const [key, re] of MATCHERS.slice(0, 2)) if (re.test(description)) return key;
  for (const [key, re] of MATCHERS.slice(2)) if (re.test(description)) return key;
  return allowOther ? "other" : null;
}

export function parseDurationMinutes(text) {
  if (typeof text === "number") return text;
  const s = String(text || "");
  const d = /(\d+)\s*day/i.exec(s);
  const h = /(\d+(?:\.\d+)?)\s*hour/i.exec(s);
  const m = /(\d+)\s*min/i.exec(s);
  const total = (d ? Number(d[1]) * 1440 : 0) + (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  return total || null;
}

export function formatDuration(minutes) {
  if (!minutes) return "";
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} day${minutes > 1440 ? "s" : ""}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${m} min`;
}

/** Rating weighted by review volume, so a 5.0 from 3 reviews does not lead. */
export function tourScore(t) {
  return (t.rating || 0) * Math.log10((t.reviews || 0) + 10);
}

/* ------------------------------------------------------------ affiliate */

/** pid/mcid/medium from the link configured in data/site.json, so tracking lives in one place. */
export function affiliateParams(site) {
  const params = new URLSearchParams();
  try {
    for (const [k, v] of new URL(site.viator?.url || "").searchParams) {
      if (["pid", "mcid", "medium"].includes(k)) params.set(k, v);
    }
  } catch { /* no link configured */ }
  return params;
}

export function withAffiliate(url, params) {
  try {
    const u = new URL(url);
    if (!/(^|\.)viator\.com$/i.test(u.hostname)) return "";
    for (const [k, v] of params) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------ transforms */

function bestImage(product) {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const cover = images.find((i) => i.isCover) || images[0];
  const variants = (cover?.variants || []).filter((v) => v && /^https:\/\//.test(v.url || ""));
  if (!variants.length) return null;
  const sized = variants.filter((v) => Number(v.width) > 0);
  if (!sized.length) return { src: variants[variants.length - 1].url };
  const target = 720;
  const above = sized.filter((v) => Number(v.width) >= target);
  const pool = above.length ? above : sized;
  const pick = pool.reduce((b, v) => (Math.abs(v.width - target) < Math.abs(b.width - target) ? v : b));
  return { src: pick.url, width: Number(pick.width), height: Number(pick.height) || undefined };
}

function trimText(text, max) {
  const clean = String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** Viator /products/search item -> the shape data/tours.json stores. */
export function normaliseProduct(product, place, params, today) {
  const title = product.title || "";
  if (!title) return null;
  const description = product.description || "";
  const category = categorise(title, description);
  if (!category) return null;
  const url = withAffiliate(product.productUrl || "", params);
  if (!url) return null;
  const reviews = product.reviews || {};
  const rating = Number(reviews.combinedAverageRating ?? 0) || null;
  const count = Number(reviews.totalReviews ?? 0) || 0;
  const price = product.pricing?.summary?.fromPrice ?? null;
  const minutes =
    product.duration?.fixedDurationInMinutes ??
    product.duration?.variableDurationFromMinutes ??
    product.duration?.unstructuredDuration ??
    null;
  const flags = Array.isArray(product.flags) ? product.flags : [];
  const features = [];
  if (flags.includes("FREE_CANCELLATION")) features.push("Free cancellation");
  if (product.confirmationType === "INSTANT") features.push("Instant confirmation");
  if (flags.includes("PRIVATE_TOUR")) features.push("Private tour");
  if (flags.includes("LIKELY_TO_SELL_OUT")) features.push("Likely to sell out");
  if (flags.includes("SKIP_THE_LINE")) features.push("Skip the line");
  const img = bestImage(product);
  return {
    name: trimText(title, 140),
    category,
    url,
    productCode: product.productCode || "",
    location: place.name,
    ...(place.citySlug ? { citySlug: place.citySlug } : {}),
    ...(place.region ? { region: place.region } : {}),
    price: price != null ? Math.round(Number(price) * 100) / 100 : undefined,
    priceChecked: today,
    rating: rating ? Math.round(rating * 10) / 10 : undefined,
    reviews: count || undefined,
    durationMin: Number(minutes) > 0 ? Number(minutes) : undefined,
    // Kept for categorising and for picking out what a listing mentions. It is
    // the operator's copy, so pages never print it.
    summary: description ? trimText(description, 400) : undefined,
    features,
    image: img?.src || "",
    ...(img?.width ? { imageWidth: img.width, imageHeight: img.height } : {}),
  };
}

/* ------------------------------------------------------------ API sweep */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Sweeps Viator's Florida destinations that match a town this site covers and
 * returns fresh tours. Bounded by a wall-clock budget so a slow API can never
 * stall a deploy; on any failure it throws, and the caller keeps the snapshot.
 */
export async function fetchViatorTours({ key, site, places, budgetMs = 90_000, pages = 2, perCity = 24, log = console.log }) {
  if (!key) throw new Error("VIATOR_API_KEY is not set");
  const params = affiliateParams(site);
  if (!params.get("pid")) throw new Error("no Viator pid in data/site.json viator.url");
  const BASE = "https://api.viator.com/partner";
  const deadline = Date.now() + budgetMs;
  const today = new Date().toISOString().slice(0, 10);

  async function api(path, body, attempt = 1) {
    if (Date.now() > deadline) throw new Error("time budget reached");
    const res = await fetch(`${BASE}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "exp-api-key": key,
        Accept: "application/json;version=2.0",
        "Accept-Language": "en-US",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(attempt * 1500);
      return api(path, body, attempt + 1);
    }
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return res.json();
  }

  const destJson = await api("/destinations");
  const all = destJson.destinations || [];
  const florida = all.find((d) => /^florida$/i.test(d.name || "") && /STATE|REGION|PROVINCE/i.test(d.type || ""));
  const fid = String(florida?.destinationId ?? 276);
  // lookupId is a dotted lineage ("77.276.663"): match the Florida id as a
  // whole segment, so an unrelated id that merely contains "276" is not taken.
  const inFlorida = all.filter((d) => String(d.lookupId || "").split(".").includes(fid) && String(d.destinationId) !== fid);
  const targets = inFlorida
    .map((d) => ({ id: d.destinationId, place: places(d.name) }))
    .filter((t) => t.place);
  log(`viator: ${inFlorida.length} Florida destinations, ${targets.length} match towns we cover`);

  const seen = new Map();
  const queue = [...targets];
  async function worker() {
    for (let t = queue.shift(); t; t = queue.shift()) {
      const kept = [];
      for (let p = 0; p < pages; p++) {
        let products = [];
        try {
          const json = await api("/products/search", {
            filtering: { destination: String(t.id) },
            sorting: { sort: "TRAVELER_RATING", order: "DESCENDING" },
            pagination: { start: p * 50 + 1, count: 50 },
            currency: "USD",
          });
          products = json.products || [];
        } catch (e) {
          if (/time budget/.test(e.message)) return;
          break;
        }
        for (const product of products) {
          const tour = normaliseProduct(product, t.place, params, today);
          if (tour && !seen.has(tour.productCode || tour.url)) kept.push(tour);
        }
        if (products.length < 50) break;
      }
      // Bikes first, then the best of everything else, capped per town.
      kept.sort((a, b) => Number(["ebike", "bike"].includes(b.category)) - Number(["ebike", "bike"].includes(a.category)) || tourScore(b) - tourScore(a));
      for (const tour of kept.filter((k) => (k.reviews || 0) >= 3).slice(0, perCity)) seen.set(tour.productCode || tour.url, tour);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return [...seen.values()].sort((a, b) => tourScore(b) - tourScore(a));
}

/** Viator destination name -> a town the site knows, or null. */
export function placeResolver(index) {
  const withPage = new Set(index.cities.map((c) => c.slug));
  const norm = (s) => String(s || "").toLowerCase().replace(/^st\.? /, "st ").replace(/^saint /, "st ").trim();
  const byName = new Map([...index.cities, ...index.thinCities].map((c) => [norm(c.name), c]));
  return (name) => {
    const city = byName.get(norm(name));
    if (!city) return null;
    return { name: city.name, region: city.region, ...(withPage.has(city.slug) ? { citySlug: city.slug } : {}) };
  };
}

/* ------------------------------------------------------------ loading */

const FLORIDA_PLACES = /Florida|Everglades|Keys|Cocoa Beach|Vero Beach|Crystal River|Islamorada|Key Largo/i;

/**
 * Reads data/tours.json and prepares it for rendering. Every field is treated
 * as untrusted: URLs must be https viator.com links carrying our pid.
 */
export function loadTours(index, file = join(ROOT, "data", "tours.json")) {
  if (!existsSync(file)) return { tours: [], updated: "", disclosure: "", cities: [] };
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const withPage = new Map(index.cities.map((c) => [c.slug, c]));
  const tours = (raw.tours || [])
    .filter((t) => t && t.name && /^https:\/\/www\.viator\.com\//.test(t.url || "") && /[?&]pid=/.test(t.url))
    .filter((t) => t.citySlug || FLORIDA_PLACES.test(`${t.location} ${t.region || ""}`) || /, FL$/.test(t.location || ""))
    .map((t) => {
      const citySlug = t.citySlug && withPage.has(t.citySlug) ? t.citySlug : "";
      const city = citySlug ? withPage.get(citySlug) : null;
      const durationMin = t.durationMin || parseDurationMinutes(t.duration);
      return {
        ...t,
        category: CATEGORY_KEYS.has(t.category) ? t.category : "other",
        citySlug,
        cityKey: citySlug || slugify(t.location || "florida"),
        cityName: city ? city.name : t.location || "Florida",
        region: t.region || city?.region || "",
        durationMin,
        durationText: formatDuration(durationMin),
        features: Array.isArray(t.features) ? t.features : [],
        score: tourScore(t),
      };
    })
    .sort((a, b) => b.score - a.score);

  // Towns, by tour count; each with its own page when it has enough for a real list.
  const groups = new Map();
  for (const t of tours) {
    if (!groups.has(t.cityKey)) groups.set(t.cityKey, { key: t.cityKey, name: t.cityName, citySlug: t.citySlug, region: t.region, tours: [] });
    groups.get(t.cityKey).tours.push(t);
  }
  const cities = [...groups.values()].sort((a, b) => b.tours.length - a.tours.length || a.name.localeCompare(b.name));
  for (const c of cities) {
    c.page = Boolean(c.citySlug) && c.tours.length >= MIN_CITY_TOURS;
    c.url = c.page ? `/tours/${c.citySlug}/` : `/tours/?city=${c.key}`;
    c.city = c.citySlug ? withPage.get(c.citySlug) : null;
  }
  return {
    tours,
    cities,
    updated: raw.updated || "",
    disclosure: raw.disclosure || "",
    categories: TOUR_CATEGORIES.filter((c) => tours.some((t) => t.category === c.key)),
  };
}

/** A town needs this many tours for its own listicle page; fewer link to /tours/?city=. */
export const MIN_CITY_TOURS = 5;
