/**
 * Homepage carousels: five shop categories, each a swipeable row of shops with
 * a "See all" link to the category page. The build renders the best shops in
 * Florida for each; assets/js/app.js swaps in the shops nearest the visitor
 * once their location is known (shared location, or the town they last
 * searched), and points "See all" at their town's own category page.
 */
import { esc, attr, formatReviews } from "./util.mjs";
import { facetsOf } from "./facets.mjs";
import { bikeIcon } from "./bike-icons.mjs";
import { webpPicture } from "./components.mjs";

export const CAROUSELS = [
  { key: "ebike", title: "Ebike Rentals Near Me", category: "ebike-rentals", seeAll: "/find/ebike-rentals-near-me/", test: (f) => f.includes("ebike") },
  { key: "top", title: "Top Rated Ebike Rentals Near Me", category: "top-rated", seeAll: "/find/top-rated/", test: (f, l) => f.includes("ebike") && l.rating >= 4.5 && (l.reviews || 0) >= 25 },
  { key: "delivery", title: "Ebike Rentals That Deliver Near Me", category: "delivery", seeAll: "/find/delivery/", test: (f) => f.includes("delivery") && f.includes("bike") },
  { key: "tours", title: "Guided Ebike Tours Near Me", category: "ebike-tours", seeAll: "/find/ebike-tours/", test: (f) => f.includes("tours") },
  { key: "repair", title: "Ebike Repair and Battery Shops Near Me", category: "ebike-shops", seeAll: "/find/ebike-shops/", test: (f) => f.includes("repairs") || f.includes("battery") },
];

const PER_ROW = 12;

/** A card's logo (small WebP, original as fallback) or photo, with its real size. */
function cardImg(l) {
  if (l.logo) {
    const w = l.logoSmallWidth || l.logoWidth;
    const h = l.logoSmallHeight || l.logoHeight;
    return webpPicture(l.logoSmall, `<img src="${attr(l.logo)}" alt="" loading="lazy" decoding="async" width="${w}" height="${h}">`);
  }
  return `<img src="${attr(l.photo)}" alt="" loading="lazy" decoding="async"${
    l.photoWidth ? ` width="${l.photoWidth}" height="${l.photoHeight}"` : ""
  }>`;
}

/** One shop card. The browser builds the same markup when it personalises a row. */
function card(l) {
  const img = l.logo || l.photo;
  return `<li class="carousel-card">
  <a class="carousel-card__link" href="${attr(l.url)}">
    <span class="carousel-card__media${l.logo ? " is-logo" : ""}">${
      img ? cardImg(l) : bikeIcon("cruiser")
    }</span>
    <span class="carousel-card__body">
      <span class="carousel-card__name">${esc(l.name)}</span>
      ${l.rating ? `<span class="carousel-card__rating"><b>&#9733; ${esc(l.rating.toFixed(1))}</b> (${esc(formatReviews(l.reviews || 0))})</span>` : ""}
      <span class="carousel-card__town">${esc(l.city)}</span>
    </span>
  </a>
</li>`;
}

/** Town slugs that have their own page for each category, so "See all" can go straight there. */
function townPages(index) {
  const out = {};
  for (const c of index.categories || []) out[c.slug] = c.towns.filter((t) => t.ownPage && t.indexable).map((t) => t.city.slug);
  return out;
}

export function homeCarousels(listings, index, { dataUrl }) {
  const rows = CAROUSELS.map((c) => {
    const shops = listings
      .filter((l) => c.test(facetsOf(l), l))
      .sort((a, b) => b.score - a.score)
      .slice(0, PER_ROW);
    return { ...c, shops };
  }).filter((r) => r.shops.length);

  return `<section class="section home-carousels" data-carousels data-src="${attr(dataUrl)}">
  <div class="wrap">
    <div class="home-carousels__bar">
      <p class="home-carousels__where" data-carousel-where>Showing the best shops across Florida.</p>
      <button class="btn btn--outline btn--sm" type="button" data-carousel-locate>&#128205; Use my location</button>
    </div>
    ${rows
      .map(
        (r) => `<div class="carousel-row" data-carousel="${attr(r.key)}" data-category="${attr(r.category)}">
      <div class="carousel-row__head">
        <h2>${esc(r.title)}</h2>
        <div class="carousel-row__nav">
          <button type="button" class="carousel-row__arrow" data-carousel-prev aria-label="Scroll ${attr(r.title)} back">&#8249;</button>
          <button type="button" class="carousel-row__arrow" data-carousel-next aria-label="Scroll ${attr(r.title)} forward">&#8250;</button>
          <a class="carousel-row__all" href="${attr(r.seeAll)}" data-see-all data-base="${attr(r.seeAll)}">See all</a>
        </div>
      </div>
      <ul class="carousel-row__track" data-carousel-track>${r.shops.map(card).join("")}</ul>
    </div>`
      )
      .join("")}
  </div>
  <script type="application/json" data-carousel-towns>${JSON.stringify(townPages(index)).replace(/</g, "\\u003c")}</script>
</section>`;
}
