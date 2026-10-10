import { esc, attr, formatReviews, commaList, plural, clamp } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import {
  listicle, faqBlock, faqSchema, linkCard, linkCloud,
  adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema, summaryFor,
} from "../components.mjs";
import { statsFor } from "../data.mjs";
import { photoFor, secondPhotoFor, figure, sceneForRegion } from "../images.mjs";
import { findHero, resultsHead, NEAR_ME_URL } from "../find-hero.mjs";

/**
 * /find/ is the directory by what you need: a grid of categories (e-bike
 * tours, delivery, family-friendly and so on), each with a statewide page at
 * /find/<category>/ and a page per town at /find/<category>/<town>/ where the
 * town has enough matching shops. The categories themselves are defined, with
 * the data field behind each one, in CATEGORIES in src/data.mjs.
 */

const HOME_CRUMB = { href: "/", label: "Home" };
const FIND_CRUMB = { href: "/find/", label: "Find" };

/**
 * Guides written about a place: blog posts tagged with one of these town names.
 * Town and region pages link to them, so a guide such as the Orlando or 30A one
 * is linked from the directory pages that carry the most weight for that place,
 * not only from the blog index.
 */
export function guidesFor(names, blog) {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return blog.filter((post) => (post.tags || []).some((t) => wanted.has(String(t).toLowerCase())));
}

export function filterBar(cities, tags, noun = "listings") {
  return `<form class="filterbar" data-filter-form>
  <div class="field">
    <label for="f-q">Search this list</label>
    <input type="search" id="f-q" name="q" placeholder="Shop name, town or service" autocomplete="off">
  </div>
  ${
    cities && cities.length > 1
      ? `<div class="field">
    <label for="f-city">Town</label>
    <select id="f-city" name="city">
      <option value="">All towns</option>
      ${cities.map((c) => `<option value="${attr(c)}">${esc(c)}</option>`).join("")}
    </select>
  </div>`
      : ""
  }
  <div class="field">
    <label for="f-tag">Service</label>
    <select id="f-tag" name="tag">
      <option value="">All services</option>
      ${tags.map((t) => `<option value="${attr(t)}">${esc(t)}</option>`).join("")}
    </select>
  </div>
  <div class="field">
    <label for="f-sort">Sort by</label>
    <select id="f-sort" name="sort">
      <option value="">Our ranking</option>
      <option value="rating">Star rating</option>
      <option value="reviews">Review count</option>
      <option value="name">Name A-Z</option>
    </select>
  </div>
</form>
<p class="result-count" data-filter-count data-noun="${attr(noun)}" aria-live="polite"></p>`;
}

export function tagsIn(listings) {
  const counts = new Map();
  for (const l of listings) for (const t of l.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}

/** One tile in a category grid. */
export function categoryTile({ href, name, count, blurb }) {
  return `<a class="category-tile" href="${attr(href)}">
  <span class="category-tile__name">${esc(name)}</span>
  ${count ? `<span class="category-tile__count">${esc(String(count))} ${plural(count, "shop")}</span>` : ""}
  ${blurb ? `<span class="category-tile__blurb">${esc(blurb)}</span>` : ""}
</a>`;
}

/* ------------------------------------------------------------ find hub */

export function findHub(site, { index, stats }) {
  const scene = photoFor("find");
  const body = `
${findHero({
  crumbs: [HOME_CRUMB, FIND_CRUMB],
  h1: "Find Bike & E-Bike Rentals in Florida",
  lead: `Choose what you need, and we will show you every Florida shop that offers it, ranked by Google rating and review count. ${stats.total} shops across ${stats.cities} towns.`,
  scene,
  index,
  current: "/find/",
  filters: false,
})}

<section class="section">
  <div class="wrap">
    <h2>Browse by category</h2>
    <div class="category-grid mt-2">
      ${index.categories
        .map((c) => categoryTile({ href: c.url, name: c.name, count: c.listings.length, blurb: c.blurb }))
        .join("")}
      ${categoryTile({ href: NEAR_ME_URL, name: "Near me", blurb: "Every shop sorted by distance from where you are." })}
      ${categoryTile({ href: "/cities/", name: "By city", blurb: `All ${index.cities.length + index.thinCities.length} Florida towns we list.` })}
    </div>
  </div>
</section>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap grid grid--2 find-guide">
    ${figure(secondPhotoFor("find"), { alt: secondPhotoFor("find").alt })}
    <div class="prose">
    <h2>How we sort shops into categories</h2>
    <p>Each category comes from a specific field in a shop's public Google profile, not from our own
    guesswork. A shop is listed under "E-bike tours" only if its profile says it runs tours, and under
    "Delivery" only if its profile lists delivery. Profiles can be out of date, so we always suggest
    calling the shop to confirm before you book.</p>
    <p>Some things renters ask about, such as child seats, trailers and tag-along bikes, are not
    recorded in public profiles. We don't list categories we can't verify. For those, the
    <a href="/find/family-friendly/">family-friendly</a> shops are a good place to start your calls.</p>
    </div>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `Find E-Bike Rentals in Florida by Category - ${stats.total} Shops`,
    description: clamp(
      `Find Florida e-bike rentals by what you need: guided tours, delivery, beach rentals, family-friendly shops, scooters and more. ${stats.total} shops ranked by Google rating.`
    ),
    path: "/find/",
    body,
    ogImage: scene.og,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, [HOME_CRUMB, FIND_CRUMB]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Find e-bike rentals in Florida by category",
        url: `${site.url}/find/`,
        isPartOf: { "@id": `${site.url}/#website` },
      },
    ],
  });
}

/** Links from one category to the others, and to its towns. */
function categoryLinks(index, category, { exclude = "" } = {}) {
  return `<div class="category-grid category-grid--compact mt-2">${index.categories
    .filter((c) => c.slug !== exclude)
    .map((c) => categoryTile({ href: c.url, name: c.name, count: c.listings.length }))
    .join("")}</div>`;
}

/* ------------------------------------------------------ category page */

export function categoryPage(site, category, { index }) {
  const stats = statsFor(category.listings);
  const shown = category.listings.slice(0, 40);
  const crumbs = [HOME_CRUMB, FIND_CRUMB, { href: category.url, label: category.name }];
  const scene = photoFor(category.slug);
  const towns = category.towns;

  const body = `
${findHero({
  crumbs,
  h1: category.h1,
  lead: category.intro,
  scene,
  index,
  current: category.url,
  category,
  tags: tagsIn(shown),
  placeholder: "Shop, town or service",
})}

<section class="section section--results">
  <div class="wrap">
    ${resultsHead(
      shown.length < stats.total ? `Top ${shown.length} of ${stats.total} shops` : `${stats.total} shops`,
      shown.length,
      "shops"
    )}
    ${listicle(shown)}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>${esc(category.name)} by town</h2>
    <p class="muted">We list ${esc(category.name.toLowerCase())} in ${towns.length} Florida ${plural(
      towns.length,
      "town"
    )}.</p>
    <ul class="pagelink-cloud">${towns
      .map(
        (t) =>
          `<li><a href="${attr(t.url)}">${esc(t.city.name)} <span class="count">${t.listings.length}</span></a></li>`
      )
      .join("")}</ul>
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    ${figure(secondPhotoFor(category.slug), { alt: secondPhotoFor(category.slug).alt })}
    <h2>Other categories</h2>
    ${categoryLinks(index, category, { exclude: category.slug })}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `${category.title} - ${stats.total} Shops Compared`,
    description: clamp(category.intro),
    path: category.url,
    body,
    ogImage: scene.og,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      itemListSchema(site, shown, { name: category.title, url: category.url }),
    ],
  });
}

/* ------------------------------------------- category + town page */

const listNames = (names) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * Facts about one set of shops in one town, in plain sentences, drawn only
 * from the listing data: who leads and on what rating, how many reviews the
 * set carries, which neighbourhoods they sit in, and who delivers or opens
 * every day. Every town's set is different, so every page's copy is too.
 */
export function townFacts(city, local) {
  const n = local.length;
  const best = local[0];
  const rated = local.filter((l) => l.rating > 0);
  const reviews = local.reduce((s, l) => s + (l.reviews || 0), 0);
  const avg = rated.length ? rated.reduce((s, l) => s + l.rating, 0) / rated.length : 0;
  const hoods = [...new Set(local.map((l) => l.neighborhood).filter((h) => h && h !== city.name))].slice(0, 3);
  const delivers = local.filter((l) => (l.tags || []).includes("Delivery available"));
  const seven = local.filter((l) => (l.hours || []).filter((h) => !h.closed).length === 7);
  const mostReviewed = [...local].sort((a, b) => (b.reviews || 0) - (a.reviews || 0))[0];
  const out = [];
  out.push(
    best.rating
      ? `${best.name} leads our ranking with ${best.rating.toFixed(1)} stars from ${formatReviews(best.reviews)} Google reviews.`
      : `${best.name} leads our ranking.`
  );
  if (mostReviewed && mostReviewed !== best && mostReviewed.reviews) {
    out.push(`${mostReviewed.name} has the most reviews, at ${formatReviews(mostReviewed.reviews)}.`);
  }
  if (rated.length > 1) out.push(`Together they hold ${formatReviews(reviews)} Google reviews, averaging ${avg.toFixed(1)} stars.`);
  if (hoods.length) out.push(`You will find them in ${listNames(hoods)}${hoods.length < n ? " and elsewhere in town" : ""}.`);
  if (delivers.length && delivers.length < n) out.push(`${listNames(delivers.slice(0, 3).map((l) => l.name))} ${delivers.length === 1 ? "lists" : "list"} delivery.`);
  else if (delivers.length === n && n > 1) out.push(`All ${n} list delivery.`);
  if (seven.length) out.push(`${seven.length === n ? (n === 1 ? "It posts" : `All ${n} post`) : `${listNames(seven.slice(0, 2).map((l) => l.name))} ${seven.length === 1 ? "posts" : "post"}`} hours for all seven days.`);
  return { best, reviews, avg, sentences: out };
}

/** Short, town-specific wording for each category's title and heading. */
const TOWN_PHRASE = {
  "ebike-rentals": (t) => `E-Bike Rentals in ${t}`,
  "ebike-tours": (t) => `Guided E-Bike Tours in ${t}`,
  "beach-rentals": (t) => `Beach Bike Rentals in ${t}`,
  delivery: (t) => `${t} Bike Rentals That Deliver`,
  "family-friendly": (t) => `Family-Friendly Bike Rentals in ${t}`,
  "ebike-shops": (t) => `Electric Bike Shops in ${t}`,
  "scooter-rentals": (t) => `Bike and Scooter Rentals in ${t}`,
  "open-7-days": (t) => `${t} Bike Rentals Open 7 Days`,
  "top-rated": (t) => `Top Rated Bike Rentals in ${t}`,
};

export function categoryTownPage(site, category, town, { index }) {
  const { city, listings: local } = town;
  const n = local.length;
  const phrase = (TOWN_PHRASE[category.slug] || ((t) => `${category.name} in ${t}`))(city.name);
  const crumbs = [
    HOME_CRUMB,
    FIND_CRUMB,
    { href: category.url, label: category.name },
    { href: town.url, label: city.name },
  ];
  const scene = sceneForRegion(city.regionSlug);
  const best = local[0];
  const others = city.categories.filter((c) => c.category.slug !== category.slug);
  const facts = townFacts(city, local);

  const body = `
${findHero({
  crumbs,
  h1: `${phrase}, Florida`,
  lead: `${n === city.listings.length ? (n === 1 ? "The one shop" : `All ${n} shops`) : `${n === 1 ? "One" : n} of the ${city.listings.length} shops`} we list in ${city.name} ${n === 1 ? "is" : "are"} in this category: ${listNames(local.slice(0, 3).map((l) => l.name))}${n > 3 ? ` and ${n - 3} more` : ""}. ${facts.sentences[0]}`,
  scene,
  index,
  current: town.url,
  category,
  tags: tagsIn(local),
  placeholder: `Search ${city.name} shops`,
})}

<section class="section section--results">
  <div class="wrap">
    ${resultsHead(`${n} ${plural(n, "shop")} in ${city.name}`, n, "shops")}
    ${listicle(local)}
    <p class="mt-2"><a class="btn btn--outline" href="${attr(city.url)}">All ${city.listings.length} shops in ${esc(
      city.name
    )}</a> <a class="btn btn--outline" href="${attr(category.url)}">${esc(category.name)} across Florida</a></p>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap wrap-narrow prose">
    <h2>${esc(phrase)}: what we found</h2>
    <p>${esc(facts.sentences.join(" "))}</p>
    <p>${esc(category.intro)} We rank by Google rating weighted against review count, and we don't accept payment for placement.</p>
  </div>
</section>

${adSlot(site, "")}

${
  others.length
    ? `<section class="section">
  <div class="wrap">
    <h2>More ways to search ${esc(city.name)}</h2>
    <div class="category-grid category-grid--compact mt-2">${others
      .map((c) => categoryTile({ href: c.url, name: c.category.name, count: c.count }))
      .join("")}</div>
  </div>
</section>`
    : ""
}
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `${phrase}, FL - ${n} ${plural(n, "Shop")}`,
    description: clamp(
      `${phrase}, FL: ${n} ${plural(n, "shop")} compared. ${facts.best.name} leads${
        facts.best.rating ? ` (${facts.best.rating.toFixed(1)} stars, ${formatReviews(facts.best.reviews)} reviews)` : ""
      }. Hours, phones and directions.`,
      160
    ),
    path: town.url,
    noindex: !town.indexable,
    body,
    ogImage: best && best.photo ? best.photo : scene.og,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      itemListSchema(site, local, { name: `${phrase}, Florida`, url: town.url }),
    ],
  });
}
