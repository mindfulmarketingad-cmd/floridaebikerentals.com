import { esc, attr, slugify, clamp, plural } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import {
  listicle, linkCard, linkCloud, adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema, mapPanel,
} from "../components.mjs";
import { photoFor, secondPhotoFor, figure, banner } from "../images.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const SEARCH_CRUMB = { href: "/search/", label: "Search" };

const MAGNIFIER = `<svg class="gsearch__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z"></path>
</svg>`;

/** Google-style search panel: logo, one pill input with live title suggestions, five suggested searches. */
function searchPanel(site, queries) {
  const suggestions = queries.slice(0, 5);
  return `<div class="gsearch" data-site-search data-pages="/data/pages.json" data-idle="">
  <a class="gsearch__logo" href="/" aria-label="${attr(site.name)} home">
    <img src="/assets/img/logo.svg" width="190" height="40" alt="${attr(site.name)}" fetchpriority="high">
  </a>
  <form class="gsearch__form" role="search">
    <div class="gsearch__field">
    <div class="gsearch__box">
      ${MAGNIFIER}
      <input class="gsearch__input" type="search" id="s-q" name="q" autocomplete="off" spellcheck="false"
        enterkeyhint="search" placeholder="Search every page on this site"
        aria-label="Search every page on this site" role="combobox" aria-expanded="false"
        aria-controls="s-suggest" aria-autocomplete="list">
      <button class="gsearch__clear" type="button" data-search-clear aria-label="Clear the search box" hidden>&times;</button>
    </div>
    <ul class="gsearch__suggest" id="s-suggest" role="listbox" aria-label="Page suggestions" data-search-suggest hidden></ul>
    </div>
    <div class="gsearch__actions">
      <button class="gsearch__btn" type="submit">Search this site</button>
      <button class="gsearch__btn" type="button" data-search-lucky>I&rsquo;m feeling lucky</button>
    </div>
  </form>
  <ul class="gsearch__chips">${suggestions
    .map((q) => `<li><a href="${attr(q.url)}">${esc(q.query)}</a></li>`)
    .join("")}</ul>
  <p class="result-count" data-search-summary aria-live="polite"></p>
  <div data-search-results></div>
</div>`;
}

export function searchHub(site, { queries, index, stats }) {
  const body = `
<section class="gsearch-hero">
  <div class="wrap">
    <h1 class="visually-hidden">Search Florida E-Bike Rentals</h1>
    ${searchPanel(site, queries)}
    <p class="gsearch__note">Searching ${esc(String(stats.total))} partner listings,
    ${esc(String(stats.cities))} town pages, review breakdowns and guides.</p>
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
    ${banner(photoFor("search"), { alt: `Search Florida e-bike rentals - ${photoFor("search").alt}` })}
    ${figure(secondPhotoFor("search"), { alt: `Florida e-bike rentals - ${secondPhotoFor("search").alt}` })}
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
    ogImage: photoFor("search").src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
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
    <div class="gsearch gsearch--inline" data-site-search data-pages="/data/pages.json" data-query="${attr(query)}">
      <form class="gsearch__form" role="search">
        <div class="gsearch__field">
        <div class="gsearch__box">
          ${MAGNIFIER}
          <input class="gsearch__input" type="search" id="s-q" name="q" autocomplete="off" spellcheck="false"
            enterkeyhint="search" placeholder="Search every page on this site"
            aria-label="Search every page on this site" role="combobox" aria-expanded="false"
            aria-controls="s-suggest" aria-autocomplete="list">
          <button class="gsearch__clear" type="button" data-search-clear aria-label="Clear the search box" hidden>&times;</button>
        </div>
        <ul class="gsearch__suggest" id="s-suggest" role="listbox" aria-label="Page suggestions" data-search-suggest hidden></ul>
        </div>
        <div class="gsearch__actions">
          <button class="gsearch__btn" type="submit">Search this site</button>
        </div>
      </form>
      <p class="result-count" data-search-summary aria-live="polite"></p>
      <div data-search-results></div>
    </div>
    ${banner(photoFor(slug), { alt: `${titleQuery} - ${photoFor(slug).alt}` })}
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
    ${figure(secondPhotoFor(slug), { alt: `${titleQuery} - ${secondPhotoFor(slug).alt}` })}
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
    ogImage: photoFor(slug).src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      itemListSchema(site, results, { name: `Search results for ${query}`, url }),
    ],
  });
}
