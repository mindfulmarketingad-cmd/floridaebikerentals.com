/**
 * Featured placements (data/featured.json): paid spots that pin a shop to the
 * top of a city's lists with a "Featured" badge. The ranking itself is never
 * changed; city.listings stays in score order so "leads our ranking" copy and
 * the numbered ranks stay honest. Pages call featuredFirst() only for the list
 * they render.
 *
 * Entry: { slug, cities: [citySlug, ...], start: "YYYY-MM-DD", end?: "YYYY-MM-DD",
 *          stripe_customer?, stripe_subscription?, note? }
 * An entry is live when start <= build date <= end (end optional).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./data.mjs";

// FEATURED_FILE points a local build at a test file without touching data/featured.json.
const FILE = process.env.FEATURED_FILE || join(ROOT, "data", "featured.json");

function today() {
  // Build date in Florida time, so a placement starting "2026-11-01" is live on the 1st.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export function loadFeatured(file = FILE) {
  if (!existsSync(file)) return [];
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const date = today();
  return (raw.featured || [])
    .filter((e) => e && e.slug && Array.isArray(e.cities) && e.cities.length)
    .filter((e) => (!e.start || e.start <= date) && (!e.end || e.end >= date));
}

/** citySlug -> [listing slug, ...] in file order, with a warning for any slug or city that does not exist. */
let BY_CITY = null;
export function initFeatured(listings, cities, entries = loadFeatured()) {
  const bySlug = new Map(listings.map((l) => [l.slug, l]));
  BY_CITY = new Map();
  for (const e of entries) {
    if (!bySlug.has(e.slug)) {
      console.warn(`featured.json: no listing "${e.slug}", skipped`);
      continue;
    }
    for (const c of e.cities) {
      if (!cities.has(c)) console.warn(`featured.json: "${e.slug}" lists city "${c}", which has no city page`);
      if (!BY_CITY.has(c)) BY_CITY.set(c, []);
      if (!BY_CITY.get(c).includes(e.slug)) BY_CITY.get(c).push(e.slug);
    }
  }
  BY_CITY.bySlug = bySlug;
  return BY_CITY;
}

/** Slugs of every shop with a live placement anywhere. */
export function featuredSlugs() {
  return new Set([...(BY_CITY || new Map()).values()].flat());
}

/**
 * The list a city page renders: featured shops first (marked `featured: true`),
 * then the rest in their usual order. A shop featured in a city it is not
 * located in is added at the top, provided it passes `accept` (for example the
 * category's match rule on a /find/ page).
 */
export function featuredFirst(list, citySlug, { accept = () => true } = {}) {
  const slugs = (BY_CITY && BY_CITY.get(citySlug)) || [];
  if (!slugs.length) return list;
  const pinned = [];
  for (const slug of slugs) {
    const own = list.find((l) => l.slug === slug);
    const listing = own || BY_CITY.bySlug.get(slug);
    if (listing && (own || accept(listing))) pinned.push({ ...listing, featured: true });
  }
  if (!pinned.length) return list;
  const taken = new Set(pinned.map((l) => l.slug));
  return [...pinned, ...list.filter((l) => !taken.has(l.slug))];
}
