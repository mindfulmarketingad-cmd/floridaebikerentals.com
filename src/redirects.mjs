/**
 * Permanent redirects the site needs, derived from the data rather than kept
 * by hand, so a data refresh that pushes a town below the page threshold
 * produces its redirect automatically.
 *
 * Two families:
 *
 *  1. Thin towns. A town with fewer than MIN_TOWN_LISTINGS shops no longer gets
 *     a /find/ page. Its old URL goes to the homepage.
 *
 *  2. Legacy listicles. Before this build went live the domain served posts at
 *     /blog/5-best-ebike-rental-shops-in-<town>-florida/. Those URLs still hold
 *     impressions in Search Console but now 404, so each goes to the town page
 *     that replaced it -- or to the homepage when that town has no page either,
 *     so nothing is ever sent through two redirects.
 *
 * The same list is written to vercel.json (the live host) by
 * `npm run redirects`, and to dist/_redirects for Netlify and Cloudflare Pages.
 * `npm run verify` fails if vercel.json has drifted from it.
 */

export const THIN_TOWN_DESTINATION = "/";

export function computeRedirects(index) {
  const withPage = new Map(index.cities.map((c) => [c.slug, c.url]));
  const allTowns = [...index.cities, ...index.thinCities];
  const out = [];

  for (const town of index.thinCities) {
    out.push({ source: `/find/ebike-rentals-in-${town.slug}/`, destination: THIN_TOWN_DESTINATION });
  }

  for (const town of allTowns) {
    out.push({
      source: `/blog/5-best-ebike-rental-shops-in-${town.slug}-florida/`,
      destination: withPage.get(town.slug) || THIN_TOWN_DESTINATION,
    });
  }

  return out.sort((a, b) => a.source.localeCompare(b.source));
}

/** Netlify / Cloudflare Pages format. `!` forces it even if a file exists there. */
export function netlifyRedirects(list) {
  return `${list.map((r) => `${r.source}  ${r.destination}  301!`).join("\n")}\n`;
}

/** vercel.json format. */
export function vercelRedirects(list) {
  return list.map((r) => ({ source: r.source, destination: r.destination, permanent: true }));
}
