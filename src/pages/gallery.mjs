/**
 * /gallery/: every photo on the site in one place, grouped by what it is, with
 * the same labelled thumbnails and lightbox as the city hub galleries.
 */
import { esc, attr } from "../util.mjs";
import { page, breadcrumbSchema } from "../layout.mjs";
import { SITE_PHOTOS, OWN_PHOTOS, allStock, stockCredits } from "../images.mjs";

export const GALLERY_URL = "/gallery/";

function grid(items) {
  return `<ul class="gallery-grid">${items
    .map(
      (it) => `<li class="gallery-grid__item">
      <a href="${attr(it.full)}" data-lightbox data-caption="${attr(it.caption)}">
        <img src="${attr(it.src)}" alt="${attr(it.alt)}" width="${it.w}" height="${it.h}" loading="lazy" decoding="async">
        <span class="gallery-grid__tag">${esc(it.tag)}</span>
      </a>
      <p class="gallery-grid__caption">${it.href ? `<a href="${attr(it.href)}">${esc(it.caption)}</a>` : esc(it.caption)}</p>
    </li>`
    )
    .join("")}</ul>`;
}

export function galleryPage(site, { listings, index }) {
  const h1 = "Electric Bike Rentals in Florida Gallery";
  const crumbs = [
    { href: "/", label: "Home" },
    { href: GALLERY_URL, label: "Gallery" },
  ];

  const ebikes = [
    { src: "/assets/img/original/hero-ebike-waterfront.jpg", w: 1125, h: 750, alt: "A rider in a helmet on a step-through electric bike beside the water" },
    ...Object.values(SITE_PHOTOS).map((p) => ({ src: p.src, w: p.width, h: p.height, alt: p.alt })),
    ...OWN_PHOTOS.map((p) => ({ src: p.src, w: p.width, h: p.height, alt: p.alt })),
  ].map((p) => ({ ...p, full: p.src, caption: p.alt, tag: "E-bike photo" }));

  const shops = listings
    .filter((l) => l.photo)
    .sort((a, b) => a.city.localeCompare(b.city) || b.score - a.score)
    .map((l) => ({
      src: l.photo, w: l.photoWidth, h: l.photoHeight, full: l.photo,
      alt: `${l.name} in ${l.city}, Florida`, caption: `${l.name}, ${l.city}`, tag: "Shop photo", href: l.url,
    }));

  const stock = allStock();
  const places = stock.map((s) => ({
    src: s.photo.small || s.photo.src, w: s.photo.smallWidth || s.photo.width, h: s.photo.smallHeight || s.photo.height,
    full: s.photo.src, alt: s.caption, caption: s.caption, tag: "Stock photo",
  }));

  const townsWithGalleries = index.cities;
  const total = ebikes.length + shops.length + places.length;

  const body = `
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Gallery</li></ol></nav>
    <h1>${esc(h1)}</h1>
    <p class="lede">All ${total} photos on our site in one place: e-bikes, the rental shops we list, and Florida's beach towns
    and trails. Tap a photo to see it full size. Ready to ride? <a href="/#finder">Find an e-bike near you</a>.</p>
    <p class="small muted">Jump to: <a href="#ebikes">E-bikes</a> · <a href="#shops">Rental shops</a> · <a href="#florida">Florida towns and scenery</a> · <a href="#towns">Town galleries</a></p>
  </div>
</section>

<section class="section section--tint" id="ebikes">
  <div class="wrap">
    <h2>E-bikes</h2>
    <p class="muted">The kinds of bikes you can rent. These photos don't show a specific shop or place.</p>
    ${grid(ebikes)}
  </div>
</section>

<section class="section" id="shops">
  <div class="wrap">
    <h2>Rental shops</h2>
    <p class="muted">${shops.length} photos from the shops' own Google listings, by town. Tap a shop name for its hours, ratings and directions.</p>
    ${grid(shops)}
  </div>
</section>

<section class="section section--tint" id="florida">
  <div class="wrap">
    <h2>Florida towns and scenery</h2>
    <p class="muted">Stock photos of the towns and coastlines we cover, used across our town and region pages.</p>
    ${grid(places)}
    ${stockCredits(stock.map((s) => s.photo))}
  </div>
</section>

<section class="section" id="towns">
  <div class="wrap">
    <h2>Town galleries</h2>
    <p class="muted">Every town page ends with its own gallery of local shop photos and nearby scenery.</p>
    <ul class="pagelink-cloud">${townsWithGalleries
      .map((c) => `<li><a href="${attr(c.url)}#photos">${esc(c.name)}</a></li>`)
      .join("")}</ul>
  </div>
</section>
`;

  return page(site, {
    title: h1,
    description: `Photos of electric bike rentals in Florida: ${total} pictures of e-bikes, rental shops and beach towns from 30A to Key West. Book an e-bike in any town.`,
    path: GALLERY_URL,
    body,
    schema: [breadcrumbSchema(site, crumbs)],
  });
}
