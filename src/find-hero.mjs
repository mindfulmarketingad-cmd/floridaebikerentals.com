/**
 * The top of every /find page: the page title over a full-width illustration,
 * with the search and filter bar directly beneath it, already set to the place
 * the page is about.
 *
 * "Where" is a destination picker: choosing another town or region goes to
 * that page, and "Near me" goes to the location-sorted list. The other fields
 * -- a text search, a service filter and a sort -- act on the list on this page
 * through the shared filter engine in app.js, which is why the form carries
 * data-filter-form. So a visitor landing on the Daytona Beach page sees the
 * Daytona Beach shops with "Daytona Beach" already chosen, and can narrow them
 * or move somewhere else without scrolling.
 */
import { esc, attr, plural } from "./util.mjs";
import { breadcrumbsBare } from "./layout.mjs";
import { stockFor, stockImg, sceneForTown } from "./images.mjs";

/** Lives here, not in near-me.mjs, so pages can link to it without an import cycle. */
export const NEAR_ME_URL = "/find/ebike-rentals-near-me/";

/**
 * Grouped <option>s for every town with a page, by region. On a category page
 * (`category` set) each town points at that category's page for the town when
 * there is one, so changing "Where" keeps the category.
 */
export function destinationOptions(index, currentUrl, category = null) {
  const sel = (url) => (url === currentUrl ? " selected" : "");
  const home = category ? category.url : "/cities/";
  const statewide = `<option value="${attr(home)}"${sel(home)}>All of Florida</option>
    <option value="${NEAR_ME_URL}"${sel(NEAR_ME_URL)}>Near me (use my location)</option>`;
  const townUrl = (city) => {
    if (!category) return city.url;
    const town = category.towns.find((t) => t.city.slug === city.slug);
    return town ? town.url : null;
  };

  const regions = [...index.regions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((region) => {
      const towns = region.cities
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => [c, townUrl(c)])
        .filter(([, url]) => url)
        .map(([c, url]) => `<option value="${attr(url)}"${sel(url)}>${esc(c.name)}</option>`)
        .join("");
      return towns ? `<optgroup label="${attr(region.name)}">${towns}</optgroup>` : "";
    })
    .join("");

  return statewide + regions;
}

/**
 * Wraps hyphenated words ("E-Bike") so a big display heading never breaks at
 * the hyphen and leaves "E-" hanging at the end of a line. The text itself is
 * unchanged, so this has no effect on what search engines read.
 */
function keepHyphenatedWhole(text) {
  return esc(text).replace(/(\S+-\S+)/g, '<span class="nowrap">$1</span>');
}

const SORTS = [
  ["", "Best match"],
  ["rating", "Highest rated"],
  ["reviews", "Most reviewed"],
  ["name", "Name A–Z"],
];

/**
 * @param {object} o
 * @param {Array}  o.crumbs      breadcrumb trail
 * @param {string} o.h1          the page title
 * @param {string} o.lead        one or two sentences under the title
 * @param {object} o.scene       entry from SCENES
 * @param {object} o.index       the directory index, for the destination list
 * @param {string} o.current     URL of this page, preselected in "Where"
 * @param {Array}  o.tags        services present in the list, for the filter
 * @param {string} o.placeholder text-search hint
 */
export function findHero({ crumbs, h1, lead, scene, index, current, category = null, tags = [], placeholder = "Shop name or service", filters = true }) {
  return `<section class="find-hero">
  <img class="find-hero__art" src="${attr(scene.src)}" alt="${attr(scene.alt)}" width="${scene.width}" height="${scene.height}" fetchpriority="high" decoding="async">
  <div class="find-hero__shade" aria-hidden="true"></div>
  <div class="wrap find-hero__inner">
    ${breadcrumbsBare(crumbs)}
    <h1 class="find-hero__title">${keepHyphenatedWhole(h1)}</h1>
    ${lead ? `<p class="find-hero__lead">${esc(lead)}</p>` : ""}
    <form class="find-search${filters ? "" : " find-search--where-only"}"${filters ? " data-filter-form" : ""} data-find-search role="search" aria-label="Search e-bike rentals">
      <div class="find-search__field find-search__field--where">
        <label for="fs-where">Where</label>
        <select id="fs-where" data-destination>${destinationOptions(index, current, category)}</select>
      </div>
      ${filters ? `<div class="find-search__field find-search__field--q">
        <label for="fs-q">Search</label>
        <input id="fs-q" type="search" name="q" placeholder="${attr(placeholder)}" autocomplete="off">
      </div>
      <div class="find-search__field">
        <label for="fs-tag">Service</label>
        <select id="fs-tag" name="tag">
          <option value="">Any service</option>
          ${tags.map((t) => `<option value="${attr(t)}">${esc(t)}</option>`).join("")}
        </select>
      </div>
      <div class="find-search__field">
        <label for="fs-sort">Sort</label>
        <select id="fs-sort" name="sort">${SORTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
      </div>` : ""}
      <button class="btn btn--primary find-search__go" type="submit">${filters ? "Search" : "Go"}</button>
    </form>
  </div>
</section>`;
}

/** Heading row above the results, with the live match count the filter engine fills in. */
export function resultsHead(title, total, noun = "shops") {
  return `<div class="results-head" data-find-results>
  <h2>${esc(title)}</h2>
  <p class="result-count" data-filter-count data-noun="${attr(noun)}" aria-live="polite">${esc(String(total))} ${esc(
    plural(total, noun.replace(/s$/, ""))
  )}</p>
</div>
<p class="muted" data-filter-empty hidden>Nothing matches that search. Clear a filter, or choose another town above.</p>`;
}

/**
 * Picture cards for nearby towns, in the style of a travel site's destination
 * row. Each card shows the top-ranked shop's own photo when it has one, since
 * that is a real picture from that town; otherwise the region's illustration.
 */
export function townCards(towns) {
  return `<div class="town-cards">${towns
    .map((town, i) => {
      // A town card shows the town, never one of its businesses: a stock photo
      // confirmed to be of that town, or else an illustration of its coast.
      const own = stockFor(`town-${town.slug}`);
      const scene = sceneForTown(town.regionSlug, i);
      const media = own
        ? stockImg(own, { alt: `${town.name}, Florida` })
        : `<img src="${attr(scene.src)}" alt="" class="is-illustration" loading="lazy" decoding="async" width="${scene.width}" height="${scene.height}">`;
      return `<a class="town-card" href="${attr(town.url)}">
  <span class="town-card__media">${media}</span>
  <span class="town-card__body">
    <span class="town-card__name">${esc(town.name)}</span>
    <span class="town-card__meta">${esc(String(town.listings.length))} ${plural(town.listings.length, "listing")}${
      typeof town.distance === "number" ? ` · ${town.distance.toFixed(0)} mi away` : ""
    }</span>
  </span>
</a>`;
    })
    .join("")}</div>`;
}

/** A columned grid of every town with a page, grouped by region. */
export function townGrid(index, { exclude = "" } = {}) {
  const regions = [...index.regions].sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="town-grid">${regions
    .map(
      (region) => `<div class="town-grid__group">
    <h3><a href="${attr(region.url)}">${esc(region.name)}</a></h3>
    <ul>${region.cities
      .filter((c) => c.slug !== exclude)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => `<li><a href="${attr(c.url)}">${esc(c.name)}</a> <span class="muted small">${c.listings.length}</span></li>`)
      .join("")}</ul>
  </div>`
    )
    .join("")}</div>`;
}
