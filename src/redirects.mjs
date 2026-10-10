/**
 * Permanent redirects the site needs, derived from the data rather than kept
 * by hand, so a data refresh that moves a shop or drops a town produces its
 * redirects automatically. Every rule points at a page that exists, in one hop.
 *
 *  1. Towns. Town pages moved from /find/ebike-rentals-in-<town>/ to
 *     /cities/<town>/. A town with fewer than MIN_TOWN_LISTINGS shops has no
 *     page: its old /find/ URL goes to the homepage, and /cities/<town>/ goes
 *     to its one shop.
 *  2. Shops. /partners/<shop>/ and the older /reviews/<shop>/ both go to
 *     /cities/<town>/<shop>/.
 *  3. Regions. Region pages were folded into the /cities/ hub, which groups
 *     every town by region.
 *  4. Categories. The old topic pages moved to /find/<category>/.
 *  5. Legacy listicles: /blog/5-best-ebike-rental-shops-in-<town>-florida/,
 *     from before this build, go to the town page or the homepage.
 *
 * The same list is written to vercel.json (the live host) by
 * `npm run redirects`, and to dist/_redirects for Netlify and Cloudflare Pages.
 * `npm run verify` fails if vercel.json has drifted from it.
 */
import { CATEGORIES } from "./data.mjs";

export const THIN_TOWN_DESTINATION = "/";

export function computeRedirects(index, listings) {
  const allTowns = [...index.cities, ...index.thinCities];
  const out = [];

  for (const town of index.cities) {
    out.push({ source: `/find/ebike-rentals-in-${town.slug}/`, destination: town.url });
  }
  for (const town of index.thinCities) {
    out.push({ source: `/find/ebike-rentals-in-${town.slug}/`, destination: THIN_TOWN_DESTINATION });
    out.push({ source: `/cities/${town.slug}/`, destination: town.listings[0].url });
  }
  for (const town of allTowns) {
    out.push({
      source: `/blog/5-best-ebike-rental-shops-in-${town.slug}-florida/`,
      destination: index.citiesBySlug.has(town.slug) ? town.url : THIN_TOWN_DESTINATION,
    });
  }

  for (const listing of listings) {
    out.push({ source: `/partners/${listing.slug}/`, destination: listing.url });
    out.push({ source: `/reviews/${listing.slug}/`, destination: listing.url });
  }

  for (const region of index.regions) {
    out.push({ source: `/find/ebike-rentals-in-${region.slug}/`, destination: "/cities/" });
  }

  const live = new Set(index.categories.map((c) => c.slug));
  for (const cat of CATEGORIES) {
    if (cat.legacy) out.push({ source: cat.legacy, destination: live.has(cat.slug) ? `/find/${cat.slug}/` : "/find/" });
  }

  out.push(...RETIRED_PAGES);
  out.sort((a, b) => a.source.localeCompare(b.source));
  return [...out, ...MERGED_SECTIONS];
}

/** Pages that were removed, each pointing at the page that replaced it. */
export const RETIRED_PAGES = [
  { source: "/authors/dev-okafor/", destination: "/authors/editorial-team/" },
  { source: "/authors/marisa-donnelly/", destination: "/authors/editorial-team/" },
  { source: "/authors/priya-raman/", destination: "/authors/editorial-team/" },
];

/**
 * The /reviews/ section was merged into /partners/. Its individual pages have
 * their own rules above; these catch the hub, its pagination, and any review
 * URL for a shop no longer listed. Kept last so the specific rules win.
 */
export const MERGED_SECTIONS = [
  { source: "/reviews/", destination: "/partners/" },
  { source: "/reviews/page/:n/", destination: "/partners/" },
  { source: "/reviews/:slug/", destination: "/partners/" },
];

/** Exact (non-pattern) rules as a map, for rewriting internal links at build time. */
export function redirectMap(list) {
  return new Map(list.filter((r) => !isPattern(r)).map((r) => [r.source, r.destination]));
}

/** A rule with a path parameter, which is checked by shape rather than against dist/. */
export const isPattern = (r) => r.source.includes(":");

/** Netlify / Cloudflare Pages format. `!` forces it even if a file exists there. */
export function netlifyRedirects(list) {
  return `${list.map((r) => `${r.source}  ${r.destination}  301!`).join("\n")}\n`;
}

/** vercel.json format. */
export function vercelRedirects(list) {
  return list.map((r) => ({ source: r.source, destination: r.destination, permanent: true }));
}
