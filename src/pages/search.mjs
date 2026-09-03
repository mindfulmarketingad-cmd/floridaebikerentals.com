import { esc, attr, slugify, clamp, plural } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import {
  listicle, linkCard, linkCloud, adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema, mapPanel,
} from "../components.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const SEARCH_CRUMB = { href: "/search/", label: "Search" };

const SEARCH_FORM = `<form class="filterbar" style="grid-template-columns:1fr auto" role="search">
  <div class="field">
    <label for="s-q">Search the directory</label>
    <input type="search" id="s-q" name="q" placeholder="Town, shop name or service" autocomplete="off" enterkeyhint="search">
  </div>
  <div class="field" style="justify-content:flex-end">
    <button class="btn btn--blue" type="submit">Search</button>
  </div>
</form>`;

export function searchHub(site, { queries, index, stats }) {
  const body = `
${breadcrumbs([HOME_CRUMB, SEARCH_CRUMB])}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">Search hub</span>
      <h1>Search Florida E-Bike Rentals</h1>
      <p>One box across every page on the site — ${esc(String(stats.total))} partner listings,
      ${esc(String(stats.cities))} town pages, review breakdowns and guides.</p>
    </div>
    <div data-site-search data-pages="/data/pages.json">
      ${SEARCH_FORM}
      <p class="result-count" data-search-summary aria-live="polite"></p>
      <div data-search-results></div>
    </div>
  </div>
</section>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap">
    <h2>Popular searches</h2>
    <p class="muted">Each of these has its own results page.</p>
    ${linkCloud(queries.map((q) => ({ href: q.url, label: q.query })))}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Or browse instead</h2>
    <div class="grid grid--4">
      ${linkCard({ href: "/find/", title: "Find by town", text: `All ${index.cities.length} Florida towns we cover.`, more: "Open Find" })}
      ${linkCard({ href: "/partners/", title: "All partners", text: "The full rental partner directory.", more: "Open Partners" })}
      ${linkCard({ href: "/reviews/", title: "Reviews", text: "Star breakdowns for every rated shop.", more: "Open Reviews" })}
      ${linkCard({ href: "/blog/", title: "Guides", text: "Laws, pricing, routes and checklists.", more: "Open Blog" })}
    </div>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: "Search Florida E-Bike Rentals - Shops, Towns and Guides",
    description: `Search every page on Florida Ebike Rentals: ${stats.total} rental partners, ${stats.cities} town pages, review breakdowns and riding guides.`,
    path: "/search/",
    body,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, [HOME_CRUMB, SEARCH_CRUMB]),
      {
        "@context": "https://schema.org",
        "@type": "SearchResultsPage",
        name: "Search Florida E-Bike Rentals",
        url: `${site.url}/search/`,
        isPartOf: { "@id": `${site.url}/#website` },
      },
    ],
  });
}

/** Builds the matched result set for a curated query page. */
export function matchQuery(query, { listings, index, blog }) {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2 && !["near", "the", "for", "and", "rental", "rentals", "bike", "bikes", "ebike", "ebikes", "electric", "florida"].includes(t));
  const score = (l) => {
    const hay = [l.name, l.city, l.region, ...(l.tags || []), l.type].join(" ").toLowerCase();
    let total = 0;
    for (const term of terms) if (hay.includes(term)) total += hay.indexOf(term) === 0 ? 4 : 3;
    return total;
  };
  let matched = listings.map((l) => ({ l, s: score(l) })).filter((x) => x.s > 0);
  if (!terms.length || matched.length < 6) {
    const extra = listings.filter((l) => !matched.some((m) => m.l.slug === l.slug)).slice(0, 20);
    matched = matched.concat(extra.map((l) => ({ l, s: 0 })));
  }
  const results = matched
    .sort((a, b) => b.s - a.s || b.l.score - a.l.score)
    .slice(0, 20)
    .map((x) => x.l);

  const pages = [];
  const lower = query.toLowerCase();
  for (const city of index.cities) {
    if (lower.includes(city.name.toLowerCase())) pages.push({ href: city.url, label: `${city.name} e-bike rentals`, count: city.listings.length });
  }
  for (const region of index.regions) {
    if (lower.includes(region.name.toLowerCase().replace(" & ", " and "))) pages.push({ href: region.url, label: region.name, count: region.listings.length });
  }
  for (const topic of index.topics) {
    const words = topic.title.toLowerCase().split(/\s+/);
    if (words.some((w) => w.length > 4 && lower.includes(w))) pages.push({ href: topic.url, label: topic.title, count: topic.listings.length });
  }
  for (const post of blog) {
    const words = post.title.toLowerCase().split(/\s+/);
    if (words.some((w) => w.length > 5 && lower.includes(w))) pages.push({ href: post.url, label: post.title });
  }
  return { results, pages: pages.slice(0, 12) };
}

export function searchQueryPage(site, query, data) {
  const slug = slugify(query);
  const url = `/search/${slug}/`;
  const { results, pages } = matchQuery(query, data);
  const crumbs = [HOME_CRUMB, SEARCH_CRUMB, { href: url, label: query }];
  const titleQuery = query.replace(/\b\w/g, (c) => c.toUpperCase());

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">Search results</span>
      <h1>${esc(titleQuery)}</h1>
      <p>${esc(results.length)} ${plural(results.length, "listing")} on Florida Ebike Rentals match
      this search, ordered by Google rating weighted against review volume. Refine the search below or
      browse the matching directory pages.</p>
    </div>
    <div data-site-search data-pages="/data/pages.json" data-query="${attr(query)}">
      ${SEARCH_FORM}
      <p class="result-count" data-search-summary aria-live="polite"></p>
      <div data-search-results></div>
    </div>
  </div>
</section>

${pages.length ? `<section class="section section--tint"><div class="wrap"><h2>Directory pages for this search</h2>${linkCloud(pages)}</div></section>` : ""}

<section class="section">
  <div class="wrap">
    <h2>Matching rental partners</h2>
    ${mapPanel(results, { id: `map-${attr(slug)}`, zoom: 7 })}
    ${listicle(results)}
  </div>
</section>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap">
    <h2>Other popular searches</h2>
    ${linkCloud(
      data.queries
        .filter((q) => q.slug !== slug)
        .slice(0, 20)
        .map((q) => ({ href: q.url, label: q.query }))
    )}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `${titleQuery} - Florida Ebike Rentals Search`,
    description: clamp(
      `Search results for "${query}" on Florida Ebike Rentals: ${results.length} matching rental partners with hours, ratings, phone numbers and map.`
    ),
    path: url,
    body,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      itemListSchema(site, results, { name: `Search results for ${query}`, url }),
    ],
  });
}
