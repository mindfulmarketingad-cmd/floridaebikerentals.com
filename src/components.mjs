import {
  esc, attr, ratingBlock, formatRating, formatReviews, phoneHref, hostOf,
  commaList, plural, clamp, todayIndex,
} from "./util.mjs";

/* ------------------------------------------------------- copy helpers */

/** "a" or "an", decided by the sound the next word starts with. */
function article(word) {
  return /^[aeiou]/i.test(String(word).trim()) ? "an" : "a";
}

const OPENERS = [
  (l) => `${l.name} is ${article(l.kind)} ${l.kind} in ${l.city}, Florida`,
  (l) => `Based in ${l.city}, ${l.name} is ${article(l.kind)} ${l.kind}`,
  (l) => `${l.name} serves riders around ${l.city} as ${article(l.kind)} ${l.kind}`,
  (l) => `Riders in ${l.city} use ${l.name}, ${article(l.kind)} ${l.kind}`,
];

function kindOf(listing) {
  const tags = listing.tags || [];
  if (tags.includes("Electric bikes") && tags.includes("Guided tours")) return "electric bike rental and tour operator";
  if (tags.includes("Electric bikes") && tags.includes("Rentals")) return "electric bike rental shop";
  if (tags.includes("Electric bikes")) return "electric bike shop";
  if (tags.includes("Guided tours")) return "bike rental and guided tour company";
  if (tags.includes("Rentals")) return "bike rental shop";
  return "bicycle shop";
}

function hashOf(text) {
  let value = 0;
  for (let i = 0; i < text.length; i++) value = (value * 31 + text.charCodeAt(i)) >>> 0;
  return value;
}

/** A unique, data-driven paragraph for each listing (no boilerplate cloning). */
export function summaryFor(listing) {
  const kind = kindOf(listing);
  const seed = hashOf(listing.slug || listing.name);
  const opener = OPENERS[seed % OPENERS.length]({ ...listing, kind });

  const bits = [];
  if (listing.rating && listing.reviews >= 5) {
    bits.push(
      `It holds a ${formatRating(listing.rating)}-star Google rating from ${formatReviews(listing.reviews)} ${plural(
        listing.reviews,
        "review"
      )}`
    );
  } else if (listing.rating) {
    bits.push(`Google reviewers rate it ${formatRating(listing.rating)} stars so far`);
  } else {
    bits.push("It has not gathered enough Google reviews to show a star rating yet");
  }

  const features = (listing.tags || []).filter((t) => t !== "Beach town" && t !== "Electric bikes");
  if (features.length) {
    bits.push(`Listed services include ${commaList(features.map((f) => f.toLowerCase()))}`);
  }

  const openDays = (listing.hours || []).filter((h) => !h.closed).length;
  if (openDays === 7) bits.push("The shop posts hours seven days a week");
  else if (openDays) bits.push(`Google shows opening hours on ${openDays} ${plural(openDays, "day")} a week`);

  if (listing.neighborhood && listing.neighborhood !== listing.city) {
    bits.push(`You will find it in the ${listing.neighborhood} area`);
  }

  return `${opener}. ${bits.slice(0, 3).join(". ")}.`;
}

export function metaDescriptionFor(listing) {
  const parts = [`${listing.name} in ${listing.city}, FL`];
  if (listing.rating) parts.push(`rated ${formatRating(listing.rating)} from ${formatReviews(listing.reviews)} Google reviews`);
  parts.push("See hours, phone, address, services and directions before you book your e-bike rental.");
  return clamp(parts.join(" — "));
}

/* -------------------------------------------------------------- atoms */

/**
 * Where each listing tag leads. Every tag a listing can carry has a landing
 * page: eight are topic pages under /find/, and "Rentals" points at the full
 * partner directory rather than a topic page that would duplicate it.
 */
export const TAG_LINKS = {
  "Guided tours": "/find/guided-ebike-tours-in-florida/",
  "Beach town": "/find/beach-ebike-rentals-in-florida/",
  "Electric bikes": "/find/electric-bike-shops-in-florida/",
  "Delivery available": "/find/ebike-rentals-with-delivery-in-florida/",
  Scooters: "/find/ebike-and-scooter-rentals-in-florida/",
  "Repairs & service": "/find/ebike-repair-and-service-in-florida/",
  "Golf carts": "/find/golf-cart-and-ebike-rentals-in-florida/",
  Watersports: "/find/bike-and-watersports-rentals-in-florida/",
  Rentals: "/partners/",
};

export function tagList(tags, limit = 5) {
  if (!tags || !tags.length) return "";
  return `<ul class="tag-row">${tags
    .slice(0, limit)
    .map((t) => {
      const href = TAG_LINKS[t];
      return `<li>${
        href ? `<a class="tag tag--link" href="${attr(href)}">${esc(t)}</a>` : `<span class="tag">${esc(t)}</span>`
      }</li>`;
    })
    .join("")}</ul>`;
}

export function photo(listing, { className = "", sizes = "", eager = false } = {}) {
  if (!listing.photo) return "";
  return `<img src="${attr(listing.photo)}" alt="${attr(`${listing.name} — e-bike rentals in ${listing.city}, Florida`)}"${
    className ? ` class="${attr(className)}"` : ""
  } loading="${eager ? "eager" : "lazy"}" decoding="async" referrerpolicy="no-referrer" data-fallback="1"${
    sizes ? ` sizes="${attr(sizes)}"` : ""
  } width="800" height="500">`;
}

export function adSlot(site, slotId) {
  if (!site.adsense?.enabled || !site.adsense.publisherId) return "";
  return `<div class="ad-slot wrap">
  <ins class="adsbygoogle" data-ad-client="ca-${attr(site.adsense.publisherId)}"${
    slotId ? ` data-ad-slot="${attr(slotId)}"` : ""
  } data-ad-format="auto" data-full-width-responsive="true"></ins>
</div>`;
}

export const ADSENSE_INLINE = "(adsbygoogle=window.adsbygoogle||[]).push({});";

export function adSlotScript(site, count) {
  if (!site.adsense?.enabled || !count) return "";
  return `<script>${ADSENSE_INLINE.repeat(count)}</script>`;
}

/* ------------------------------------------------------------- cards */

export function listingCard(listing) {
  return `<a class="card card--link" href="/partners/${attr(listing.slug)}/">
  <h3>${esc(listing.name)}</h3>
  <p class="card__count">${esc(listing.city)}, FL · ${esc(listing.region)}</p>
  ${ratingBlock(listing, { href: `/reviews/${listing.slug}/` })}
  ${tagList(listing.tags, 3)}
  <span class="card__more">View listing</span>
</a>`;
}

export function linkCard({ href, title, text, meta, more = "Explore" }) {
  return `<a class="card card--link" href="${attr(href)}">
  <h3>${esc(title)}</h3>
  ${meta ? `<p class="card__count">${esc(meta)}</p>` : ""}
  ${text ? `<p>${esc(text)}</p>` : ""}
  <span class="card__more">${esc(more)}</span>
</a>`;
}

/* ---------------------------------------------------------- listicle */

function hoursToday(listing) {
  const row = (listing.hours || [])[todayIndex()];
  if (!row) return "";
  return row.closed ? "Closed today" : `Today: ${row.hours}`;
}

export function listicleItem(listing, rank, { showSummary = true } = {}) {
  const url = `/partners/${attr(listing.slug)}/`;
  const facts = [];
  const addressText = listing.address || `${listing.city}, FL`;
  facts.push(
    `<li><b>Address</b> <span>${
      listing.maps_link
        ? `<a href="${attr(listing.maps_link)}" rel="nofollow noopener" target="_blank">${esc(addressText)}</a>`
        : esc(addressText)
    }</span></li>`
  );
  if (listing.phone) {
    const tel = phoneHref(listing.phone);
    facts.push(
      `<li><b>Phone</b> <span>${tel ? `<a href="tel:${attr(tel)}">${esc(listing.phone)}</a>` : esc(listing.phone)}</span></li>`
    );
  }
  const today = hoursToday(listing);
  if (today) facts.push(`<li><b>Hours</b> <span>${esc(today)}</span></li>`);
  if (listing.website) {
    facts.push(
      `<li><b>Website</b> <span><a href="${attr(listing.website)}" rel="nofollow noopener" target="_blank">${esc(
        hostOf(listing.website)
      )}</a></span></li>`
    );
  }
  if (listing.reviews) {
    const count = `${formatReviews(listing.reviews)} on Google`;
    facts.push(
      `<li><b>Reviews</b> <span>${
        listing.reviews_link
          ? `<a href="${attr(listing.reviews_link)}" rel="nofollow noopener" target="_blank">${esc(count)}</a>`
          : `<a href="/reviews/${attr(listing.slug)}/">${esc(count)}</a>`
      }</span></li>`
    );
  }
  if (listing.price_range) facts.push(`<li><b>Price</b> <span>${esc(listing.price_range)}</span></li>`);

  const search = [listing.name, listing.city, listing.region, ...(listing.tags || [])].join(" ");

  return `<li class="listicle__item" data-filter-item data-city="${attr(listing.city)}" data-tags="|${attr(
    (listing.tags || []).join("|")
  )}|" data-search="${attr(search)}" data-rating="${attr(listing.rating || 0)}" data-reviews="${attr(
    listing.reviews || 0
  )}" data-score="${attr(listing.score || 0)}" data-name="${attr(listing.name)}"${
    typeof listing.lat === "number" ? ` data-lat="${attr(listing.lat)}" data-lng="${attr(listing.lng)}"` : ""
  }>
  <div class="listicle__inner">
    <div class="listicle__media">
      <span class="listicle__rank" aria-hidden="true">${rank}</span>
      ${photo(listing)}
    </div>
    <div class="listicle__body">
      <h3 class="listicle__title"><span class="visually-hidden">Number ${rank}: </span><a href="${url}">${esc(
    listing.name
  )}</a></h3>
      <div>${ratingBlock(listing, { href: `/reviews/${listing.slug}/` })}</div>
      ${showSummary ? `<p class="listicle__summary">${esc(summaryFor(listing))}</p>` : ""}
      ${tagList(listing.tags, 4)}
      <ul class="listicle__facts">${facts.join("")}</ul>
      <div class="listicle__actions">
        <a class="btn btn--blue btn--sm" href="${url}">Full details</a>
        <a class="btn btn--outline btn--sm" href="/reviews/${attr(listing.slug)}/">Reviews</a>
        ${
          listing.maps_link
            ? `<a class="btn btn--outline btn--sm" href="${attr(
                listing.maps_link
              )}" rel="nofollow noopener" target="_blank">Directions</a>`
            : ""
        }
      </div>
    </div>
  </div>
</li>`;
}

export function listicle(listings, options = {}) {
  const start = options.start || 1;
  return `<ol class="listicle">${listings
    .map((l, i) => listicleItem(l, start + i, options))
    .join("")}</ol>`;
}

/* --------------------------------------------------------------- map */

export function mapPoints(listings, startRank = 1) {
  return listings
    .filter((l) => typeof l.lat === "number" && typeof l.lng === "number")
    .map((l, i) => ({
      name: l.name,
      city: l.city,
      lat: Number(l.lat.toFixed(5)),
      lng: Number(l.lng.toFixed(5)),
      rating: l.rating || 0,
      reviews: l.reviews || 0,
      url: `/partners/${l.slug}/`,
      rank: startRank + i,
    }));
}

export function mapPanel(listings, { id = "map-panel", zoom = 8, buttonLabel = "Show map view" } = {}) {
  const points = mapPoints(listings);
  if (!points.length) return "";
  return `<div class="maptools">
  <button class="btn btn--outline btn--sm" type="button" data-map-toggle="#${attr(id)}" aria-expanded="false"
    data-label-show="${attr(buttonLabel)}" data-label-hide="Hide map view">${esc(buttonLabel)}</button>
  <span class="small muted">${points.length} mapped ${plural(points.length, "location")}</span>
</div>
<div class="map-panel" id="${attr(id)}" hidden>
  <div class="map" data-zoom="${attr(zoom)}" data-points="${attr(JSON.stringify(points))}"></div>
</div>`;
}

export function singleMap(listing) {
  if (typeof listing.lat !== "number" || typeof listing.lng !== "number") return "";
  const points = mapPoints([listing]);
  return `<div class="map-panel">
  <div class="map" data-map-auto data-zoom="15" data-points="${attr(JSON.stringify(points))}"></div>
</div>`;
}

/* --------------------------------------------------------------- FAQ */

export function faqBlock(items) {
  return `<div class="faq">${items
    .map(
      (item) => `<details class="faq__item">
  <summary>${esc(item.q)}</summary>
  <div class="faq__answer">${item.a}</div>
</details>`
    )
    .join("")}</div>`;
}

export function faqSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() },
    })),
  };
}

/* -------------------------------------------------------------- misc */

export function ctaBand({ title, text, buttons }) {
  return `<div class="cta-band">
  <h2>${esc(title)}</h2>
  <p>${esc(text)}</p>
  <div class="btn-row">${buttons
    .map((b) => `<a class="btn ${attr(b.variant || "btn--primary")}" href="${attr(b.href)}">${esc(b.label)}</a>`)
    .join("")}</div>
</div>`;
}

export function linkCloud(links) {
  return `<ul class="pagelink-cloud">${links
    .map(
      (l) =>
        `<li><a href="${attr(l.href)}">${esc(l.label)}${
          l.count ? ` <span class="count">${l.count}</span>` : ""
        }</a>${l.note ? ` <span class="note">${esc(l.note)}</span>` : ""}</li>`
    )
    .join("")}</ul>`;
}

export function statRow(stats) {
  return `<div class="stat-row">${stats
    .map((s) => `<div class="stat"><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`)
    .join("")}</div>`;
}

export function itemListSchema(site, listings, { name, url }) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: `${site.url}${url}`,
    numberOfItems: listings.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: listings.slice(0, 100).map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${site.url}/partners/${l.slug}/`,
      name: l.name,
    })),
  };
}

export function localBusinessSchema(site, listing) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BicycleStore",
    "@id": `${site.url}/partners/${listing.slug}/#business`,
    name: listing.name,
    url: `${site.url}/partners/${listing.slug}/`,
    address: {
      "@type": "PostalAddress",
      streetAddress: listing.street || undefined,
      addressLocality: listing.city || undefined,
      addressRegion: "FL",
      postalCode: listing.postal_code || undefined,
      addressCountry: "US",
    },
  };
  if (listing.phone) data.telephone = listing.phone;
  if (listing.website) data.sameAs = [listing.website];
  if (listing.photo) data.image = listing.photo;
  if (typeof listing.lat === "number") {
    data.geo = { "@type": "GeoCoordinates", latitude: listing.lat, longitude: listing.lng };
  }
  if (listing.rating && listing.reviews) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: listing.rating,
      reviewCount: listing.reviews,
      bestRating: 5,
      worstRating: 1,
    };
  }
  const hours = (listing.hours || []).filter((h) => !h.closed && /\d/.test(h.hours));
  if (hours.length) {
    data.openingHours = hours.map((h) => `${h.day.slice(0, 2)} ${h.hours.replace(/\s/g, "")}`);
  }
  return data;
}

/* ------------------------------------------------------ product carousel */

/** Only http(s) links leave this file, whatever ends up in products.json. */
function productSafeUrl(url) {
  const value = String(url || "").trim();
  return /^https?:\/\//i.test(value) && !/["<>\s]/.test(value) ? value : "";
}

function productSlide(product) {
  const href = product.affiliate ? productSafeUrl(product.url) : product.url_internal;
  if (!href) return "";
  const external = Boolean(product.affiliate);
  const linkAttrs = external ? ' rel="nofollow sponsored noopener" target="_blank"' : "";
  const src = productSafeUrl(product.image) || (product.image && product.image.startsWith("/") ? product.image : "");
  const alt = `${product.brand ? `${product.brand} ` : ""}${product.name}`;
  return `<a class="slide slide--product" href="${attr(href)}"${linkAttrs}>
  <div class="slide__media">
    ${
      src
        ? `<img src="${attr(src)}" alt="${attr(alt)}" loading="lazy" decoding="async">`
        : ""
    }
    ${product.badge ? `<span class="slide__badge slide__badge--product">${esc(product.badge)}</span>` : ""}
  </div>
  <div class="slide__body">
    ${product.brand ? `<span class="slide__meta">${esc(product.brand)}</span>` : ""}
    <span class="slide__name">${esc(product.name)}</span>
    <span class="slide__foot">${esc(product.cta || "Check price")} &rsaquo;</span>
  </div>
</a>`;
}

/**
 * A horizontally-scrolling row of shop products, for placement on a content
 * page (a light section, not the dark home hero) — "prefer to buy your own?"
 * Renders nothing when the category has no products, so a page never ships
 * an empty carousel, and no caller needs to check first.
 */
export function productCarousel(shop, { category, title, browseHref, browseLabel, id, limit = 8 }) {
  const items = (shop?.products || []).filter((p) => !category || p.categorySlug === category).slice(0, limit);
  if (!items.length) return "";
  const slides = items.map(productSlide).filter(Boolean).join("");
  if (!slides) return "";
  return `<div class="carousel carousel--light" data-carousel id="${attr(id || "shop-carousel")}">
  <div class="carousel__head">
    <span class="carousel__title">${esc(title)}</span>
    <div class="carousel__nav">
      <button class="carousel__btn" type="button" data-carousel-prev aria-label="Previous products">&#8249;</button>
      <button class="carousel__btn" type="button" data-carousel-next aria-label="Next products">&#8250;</button>
    </div>
  </div>
  <div class="carousel__track">${slides}</div>
  <p class="carousel__foot">
    ${browseHref ? `<a class="card__more" href="${attr(browseHref)}">${esc(browseLabel || "Browse all")}</a>` : ""}
    <span class="small muted">${esc(shop?.affiliateDisclosure || "")}</span>
  </p>
</div>`;
}

/* --------------------------------------------------------------- pagination */

/**
 * Prev/next arrows plus a windowed set of page numbers (first, last, and a
 * couple either side of the current page, with an ellipsis for the gap) —
 * for a hub with more pages than anyone should read as a flat list, like the
 * 15-page partner directory. Returns "" for a single page.
 */
export function pagination({ pageNumber, totalPages, urlFor, ariaLabel = "Pagination" }) {
  if (totalPages <= 1) return "";

  const arrow = (dir, target, label) =>
    target
      ? `<a class="pagination__arrow" href="${attr(urlFor(target))}" aria-label="${attr(label)}">${dir}</a>`
      : `<span class="pagination__arrow is-disabled" aria-hidden="true">${dir}</span>`;

  const keep = new Set([1, totalPages, pageNumber, pageNumber - 1, pageNumber + 1]);
  const pages = [...keep].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

  let items = "";
  let last = 0;
  for (const n of pages) {
    if (last && n - last > 1) items += `<li class="pagination__gap" aria-hidden="true">&hellip;</li>`;
    items += `<li><a href="${attr(urlFor(n))}"${
      n === pageNumber ? ' aria-current="page" class="is-current"' : ""
    }>${n}</a></li>`;
    last = n;
  }

  return `<nav class="pagination mt-3" aria-label="${attr(ariaLabel)}">
  <ul class="pagination__list">
    <li>${arrow("&#8249;", pageNumber > 1 ? pageNumber - 1 : null, "Previous page")}</li>
    ${items}
    <li>${arrow("&#8250;", pageNumber < totalPages ? pageNumber + 1 : null, "Next page")}</li>
  </ul>
  <span class="pagination__status small muted">Page ${pageNumber} of ${totalPages}</span>
</nav>`;
}
