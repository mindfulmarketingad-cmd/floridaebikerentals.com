/**
 * /trails/e-bike-routes-rules-in-<town>-florida/
 *
 * A riding guide for each town that has mapped bike routes around it. The
 * routes, their lengths, surfaces and types come from OpenStreetMap
 * (data/city-trails.json, refreshed by the "City trails" Action) and are
 * printed as recorded, never estimated. The rules are the statewide points
 * from our Florida e-bike law guide, which cites the statutes; nothing local
 * is stated that we cannot source, so local questions point to the shop.
 */
import { esc, attr, plural, clamp, slugify, formatReviews } from "../util.mjs";
import { page, breadcrumbSchema } from "../layout.mjs";
import { faqBlock, faqSchema, linkCard, adSlot, adSlotScript, ADSENSE_INLINE } from "../components.mjs";
import { sceneForRegion, sceneForTown, stockFor, stockImg, figure } from "../images.mjs";
import { findHero } from "../find-hero.mjs";

/** A town gets a guide when OpenStreetMap shows at least this many named routes around it. */
export const MIN_TRAIL_ROUTES = 3;

export function cityTrailTitle(city) {
  return `E-Bike Routes & Rules in ${city.name}, Florida`;
}

export function cityTrailUrl(city) {
  return `/trails/${slugify(cityTrailTitle(city))}/`;
}

/** Towns with a guide, each paired with its route data, most routes first. */
export function cityTrailGuides(index, trailData) {
  return index.cities
    .map((city) => ({ city, data: trailData?.cities?.[city.slug] }))
    .filter((g) => g.data && g.data.routes.length >= MIN_TRAIL_ROUTES)
    .map((g) => ({ ...g, url: cityTrailUrl(g.city), title: cityTrailTitle(g.city) }))
    .sort((a, b) => b.data.totalMiles - a.data.totalMiles);
}

const LAW = "/blog/florida-ebike-laws/";

export function cityTrailPage(site, guide, { index, trailData, guides }) {
  const { city, data, url, title } = guide;
  const routes = data.routes;
  const top3 = routes.slice(0, 3).map((r) => r.name);
  const paved = routes.filter((r) => r.surface === "Paved").length;
  const crumbs = [
    { href: "/", label: "Home" },
    { href: "/trails/", label: "Trails" },
    { href: url, label: city.name },
  ];
  const shops = city.listings.slice(0, 3);
  const others = guides.filter((g) => g.city.slug !== city.slug);
  const nearby = others
    .filter((g) => g.city.regionSlug === city.regionSlug)
    .concat(others.filter((g) => g.city.regionSlug !== city.regionSlug))
    .slice(0, 8);
  const photo = stockFor(`town-${city.slug}`);

  const faqs = [
    {
      q: `Do I need a licence or registration to ride an e-bike in ${city.name}?`,
      a: `<p>No. Florida law treats an electric bicycle as a bicycle: no driver's licence, no registration and no insurance. That applies to Class 1, 2 and 3 e-bikes with a motor of 750 watts or less and working pedals (Florida Statutes 316.003 and 316.20655). Our <a href="${LAW}">Florida e-bike law guide</a> has the detail.</p>`,
    },
    {
      q: `Is a helmet required on an e-bike in ${city.name}?`,
      a: `<p>For riders and passengers under 16, yes: Florida's bicycle helmet law covers e-bikes, including a child in a seat or trailer. Riders 16 and over are not legally required to wear one. We recommend it anyway.</p>`,
    },
    {
      q: `Can I ride an e-bike on the paths listed here?`,
      a: `<p>State law allows e-bikes on bicycle paths and multi-use paths, but it also lets local governments and path managers restrict them, and many limit Class 3 bikes. We list what is mapped as a bike or shared-use path; check the signs at the path, and ask your ${esc(city.name)} rental shop what applies locally.</p>`,
    },
    {
      q: `Do I need lights to ride at night?`,
      a: `<p>Yes. Between sunset and sunrise Florida requires a white front light and a red rear reflector or light, the same as any bicycle.</p>`,
    },
  ];

  const body = `
${findHero({
  crumbs,
  h1: title,
  lead: `For ${city.name} bike routes, start with ${top3.slice(0, -1).join(", ")}${top3.length > 1 ? " and " : ""}${top3[top3.length - 1]}. We list ${routes.length} named routes mapped within about five miles of town, with distances, surfaces and map links, and the Florida rules that apply when you ride.`,
  scene: sceneForRegion(city.regionSlug),
  index,
  current: url,
  filters: false,
  // "Where" switches between town riding guides, not to the rental lists.
  whereOptions: `<option value="/trails/">All Florida trails</option>${[...guides]
    .sort((a, b) => a.city.name.localeCompare(b.city.name))
    .map((g) => `<option value="${attr(g.url)}"${g.url === url ? " selected" : ""}>${esc(g.city.name)}</option>`)
    .join("")}`,
})}

<section class="section">
  <div class="wrap">
    <nav class="trail-jump" aria-label="On this page">
      <a href="#where-to-ride">Where to ride</a><a href="#rules">Law summary</a><a href="#switch-city">Switch city</a>
    </nav>
    <div class="fact-cards">
      <div class="fact-card"><span class="fact-card__label">Where to ride</span><strong>${routes.length} mapped routes</strong><span>${esc(String(data.totalMiles))} miles of named bike and shared-use paths within about five miles${paved ? `, ${paved} of them paved` : ""}.</span></div>
      <div class="fact-card"><span class="fact-card__label">Paperwork</span><strong>No licence or registration</strong><span>Florida treats an e-bike as a bicycle (F.S. 316.003, 316.20655).</span></div>
      <div class="fact-card"><span class="fact-card__label">Safety</span><strong>Helmets under 16</strong><span>Required for riders and passengers under 16, including children in seats or trailers.</span></div>
    </div>
  </div>
</section>

<section class="section section--tint" id="where-to-ride">
  <div class="wrap">
    <h2>Where to ride e-bikes in ${esc(city.name)}, Florida</h2>
    <div class="quick-answer"><span class="eyebrow">Quick answer</span>
      <p>${esc(city.name)} has ${routes.length} named bike routes mapped within about five miles, covering about ${esc(String(data.totalMiles))} miles in total. The longest is ${esc(routes[0].name)}, at ${esc(String(routes[0].miles))} miles inside that radius.</p>
    </div>
    <div class="route-stats">
      <div><strong>${routes.length}</strong><span>Mapped routes</span></div>
      <div><strong>~${esc(String(data.totalMiles))} mi</strong><span>Combined distance</span></div>
      <div><strong>${paved}/${routes.length}</strong><span>Paved</span></div>
    </div>
    <ol class="route-list">${routes
      .map(
        (r, i) => `<li class="route">
      <span class="route__n">${i + 1}</span>
      <span class="route__name">${esc(r.name)}</span>
      <span class="route__fact"><strong>${esc(String(r.miles))} mi</strong><small>Distance</small></span>
      <span class="route__fact"><strong>${esc(r.surface)}</strong><small>Surface</small></span>
      <span class="route__fact"><strong>${esc(r.type)}</strong><small>Type</small></span>
      <a class="btn btn--primary btn--sm" href="${attr(r.osm)}" rel="nofollow noopener" target="_blank">Open map</a>
    </li>`
      )
      .join("")}</ol>
    <p class="small muted mt-2">Distances are the mapped length of each route within about five miles of ${esc(city.name)},
    so a long trail may continue beyond what we show. Route data © <a href="https://www.openstreetmap.org/copyright" rel="nofollow noopener" target="_blank">OpenStreetMap contributors</a>, checked ${esc(trailData.updated || "")}.</p>
  </div>
</section>

<section class="section" id="rules">
  <div class="wrap">
    <h2>The Florida rules that matter in ${esc(city.name)}</h2>
    <p class="muted">The statewide rules, from our <a href="${LAW}">Florida e-bike law guide</a>. Local rules on sidewalks, beaches and specific paths are set by the city, county or path manager, so check signs and ask your rental shop.</p>
    ${faqBlock(faqs)}
    <p class="mt-2"><a class="btn btn--blue" href="${LAW}">Read the full Florida e-bike law guide</a></p>
  </div>
</section>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap">
    <div class="trail-figure">${
      photo
        ? `<figure class="figure">${stockImg(photo, { alt: `${city.name}, Florida`, large: photo.width >= 1180 })}<figcaption>${esc(city.name)}, Florida. Photo: ${esc(photo.creator || "Openverse")}, ${esc(String(photo.license).toUpperCase())}.</figcaption></figure>`
        : figure(sceneForTown(city.regionSlug, 1), { alt: `Illustration of e-bike riding near ${city.name}, Florida` })
    }</div>
    <h2>Rent an e-bike in ${esc(city.name)}</h2>
    <p class="muted">The top-ranked of the ${city.listings.length} rental shops we list in ${esc(city.name)}, by Google rating and review count.</p>
    <div class="grid grid--3 mt-2">${shops
      .map((l) =>
        linkCard({
          href: l.url,
          title: l.name,
          meta: l.rating ? `${l.rating.toFixed(1)} stars · ${formatReviews(l.reviews)} Google reviews` : "No Google rating yet",
          text: l.address || `${l.city}, FL`,
          more: "View shop",
        })
      )
      .join("")}</div>
    <p class="mt-2"><a class="btn btn--outline" href="${attr(city.url)}">All ${city.listings.length} ${esc(city.name)} rental shops</a></p>
  </div>
</section>

<section class="section" id="switch-city">
  <div class="wrap">
    <h2>More Florida city riding guides</h2>
    <p class="muted">The same format for other towns: mapped routes and the rules that apply.</p>
    <ul class="pagelink-cloud">${nearby
      .map((g) => `<li><a href="${attr(g.url)}">${esc(g.city.name)} <span class="count">${g.data.routes.length}</span></a></li>`)
      .join("")}</ul>
    <p class="mt-2"><a class="btn btn--outline btn--sm" href="/trails/#city-guides">All ${guides.length} city guides</a></p>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title,
    description: clamp(
      `${city.name} e-bike routes: ${routes.length} named bike paths mapped within five miles, starting with ${top3[0]}, with distances, surfaces and Florida e-bike rules.`,
      160
    ),
    path: url,
    body,
    ogImage: photo ? photo.src : sceneForRegion(city.regionSlug).og,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [breadcrumbSchema(site, crumbs), faqSchema(faqs)],
  });
}

/** The "City riding guides" block on the /trails/ hub. */
export function cityTrailHubSection(guides) {
  if (!guides.length) return "";
  return `<section class="section" id="city-guides">
  <div class="wrap">
    <h2>City riding guides</h2>
    <p class="muted">${guides.length} Florida towns with mapped bike routes: where to ride and the rules that apply.</p>
    <div class="grid grid--3 mt-2">${guides
      .map((g) =>
        linkCard({
          href: g.url,
          title: g.title,
          meta: `${g.data.routes.length} routes · ~${g.data.totalMiles} mi`,
          text: `Start with ${g.data.routes.slice(0, 2).map((r) => r.name).join(" and ")}.`,
          more: "Open guide",
        })
      )
      .join("")}</div>
  </div>
</section>`;
}
