/**
 * The site's image library.
 *
 * Featured images are illustrations drawn by scripts/make-scenes.mjs: vector
 * art, sharp at any width. The photographs that used to fill that role were
 * 499-800px wide and stretched across a 1,180px banner, so every featured image
 * on the site looked soft, so they are no longer used.
 *
 * Nothing here is a photograph of a listed business or of a specific town.
 * Illustrations are captioned as illustrations, and photos beside a specific
 * shop are captioned as stock.
 */
import { readFileSync, existsSync } from "node:fs";
import { esc, attr } from "./util.mjs";

/**
 * Openverse stock photos picked for specific places and categories, keyed by
 * slot (a region slug, "town-<slug>", or a category slug). Written by
 * scripts/stock-fetch.mjs; each carries its creator and licence.
 */
const STOCK_FILE = new URL("../data/stock-photos.json", import.meta.url);
const STOCK = existsSync(STOCK_FILE) ? JSON.parse(readFileSync(STOCK_FILE, "utf8")) : {};

export function stockFor(slot) {
  return STOCK[slot] || null;
}

/** A stock photo as an <img>, the 800px file by default, never wider than its file. */
export function stockImg(photo, { alt, large = false, eager = false } = {}) {
  const [src, w, h] = large ? [photo.src, photo.width, photo.height] : [photo.small, photo.smallWidth, photo.smallHeight];
  return `<img src="${attr(src)}" alt="${attr(alt || photo.title || "")}" width="${w}" height="${h}" loading="${eager ? "eager" : "lazy"}" decoding="async">`;
}

const LICENCE_NAMES = { cc0: "CC0", pdm: "Public domain", by: "CC BY", "by-sa": "CC BY-SA" };

/** "Photo credits" list for the stock photos a page shows. */
export function stockCredits(photos) {
  const list = [...new Set(photos.filter(Boolean))];
  if (!list.length) return "";
  return `<details class="photo-credits"><summary>Photo credits</summary><ul>${list
    .map((p) => {
      const who = p.creator ? (p.creatorUrl ? `<a href="${attr(p.creatorUrl)}" rel="nofollow noopener" target="_blank">${esc(p.creator)}</a>` : esc(p.creator)) : "Unknown";
      const lic = LICENCE_NAMES[p.license] || String(p.license || "").toUpperCase();
      const licLink = p.licenseUrl ? `<a href="${attr(p.licenseUrl)}" rel="nofollow noopener" target="_blank">${esc(lic)}${p.licenseVersion && !["cc0", "pdm"].includes(p.license) ? ` ${esc(p.licenseVersion)}` : ""}</a>` : esc(lic);
      const title = p.landing ? `<a href="${attr(p.landing)}" rel="nofollow noopener" target="_blank">${esc(p.title || "Photo")}</a>` : esc(p.title || "Photo");
      return `<li>${title} by ${who}, ${licLink}, via Openverse</li>`;
    })
    .join("")}</ul></details>`;
}

/** Drawn scenes. `og` is a 1200x630 JPEG for social cards, which do not render SVG. */
export const SCENES = [
  {
    id: "atlantic",
    src: "/assets/img/scenes/atlantic.svg",
    og: "/assets/img/scenes/atlantic.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of two riders on fat-tyre e-bikes along a wide Atlantic beach at sunrise, with a fishing pier behind",
    caption: "Illustration: Florida's Atlantic beaches are wide and firm enough to ride at low tide.",
    themes: ["beach", "coast", "atlantic"],
  },
  {
    id: "gulf",
    src: "/assets/img/scenes/gulf.svg",
    og: "/assets/img/scenes/gulf.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of riders on e-bikes crossing Gulf coast dunes at sunset, with palms and sea oats",
    caption: "Illustration: a sunset ride along the Gulf coast.",
    themes: ["beach", "coast", "gulf", "sunset"],
  },
  {
    id: "keys",
    src: "/assets/img/scenes/keys.svg",
    og: "/assets/img/scenes/keys.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of riders on e-bikes crossing a long, low bridge over turquoise water",
    caption: "Illustration: island-hopping by e-bike over the water.",
    themes: ["keys", "bridge", "island"],
  },
  {
    id: "trail",
    src: "/assets/img/scenes/trail.svg",
    og: "/assets/img/scenes/trail.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of riders on e-bikes on a paved trail under live oaks hung with Spanish moss",
    caption: "Illustration: inland Florida's paved rail-trails run under live oak canopy.",
    themes: ["trail", "inland", "tour"],
  },
  {
    id: "boardwalk",
    src: "/assets/img/scenes/boardwalk.svg",
    og: "/assets/img/scenes/boardwalk.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of a family on e-bikes riding a wooden boardwalk through the dunes to the beach",
    caption: "Illustration: a family ride over the dunes to the beach.",
    themes: ["family", "beach", "boardwalk"],
  },
  {
    id: "miami",
    src: "/assets/img/scenes/miami.svg",
    og: "/assets/img/scenes/miami.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of riders on e-bikes passing pastel Art Deco buildings on a palm-lined Miami Beach promenade at dusk",
    caption: "Illustration: Miami Beach's Art Deco promenade by e-bike.",
    themes: ["city", "miami", "beach"],
  },
  {
    id: "emerald",
    src: "/assets/img/scenes/emerald.svg",
    og: "/assets/img/scenes/emerald.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of riders on e-bikes passing pastel beach cottages beside emerald water and white sand",
    caption: "Illustration: pastel cottages and emerald water along 30A.",
    themes: ["beach", "gulf", "30a"],
  },
  {
    id: "tampa",
    src: "/assets/img/scenes/tampa.svg",
    og: "/assets/img/scenes/tampa.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of riders on e-bikes on a bayside path with a cable-stayed bridge across Tampa Bay behind",
    caption: "Illustration: a bayside ride with the Sunshine Skyway on the horizon.",
    themes: ["bay", "bridge", "city"],
  },
  {
    id: "lighthouse",
    src: "/assets/img/scenes/lighthouse.svg",
    og: "/assets/img/scenes/lighthouse.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of riders on e-bikes on an inlet path below a red lighthouse",
    caption: "Illustration: an inlet ride on Florida's southeast coast.",
    themes: ["coast", "atlantic", "lighthouse"],
  },
  {
    id: "lifeguard",
    src: "/assets/img/scenes/lifeguard.svg",
    og: "/assets/img/scenes/lifeguard.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of riders on e-bikes on a white Gulf beach past a lifeguard stand",
    caption: "Illustration: white Gulf sand and a lifeguard stand.",
    themes: ["beach", "gulf"],
  },
  {
    id: "spiral",
    src: "/assets/img/scenes/spiral.svg",
    og: "/assets/img/scenes/spiral.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of riders on e-bikes on a marsh path below a black-and-white spiral lighthouse",
    caption: "Illustration: marsh paths below a striped lighthouse in northeast Florida.",
    themes: ["coast", "marsh", "lighthouse"],
  },
  {
    id: "springs",
    src: "/assets/img/scenes/springs.svg",
    og: "/assets/img/scenes/springs.jpg",
    width: 1600,
    height: 900,
    alt: "Illustration of riders on e-bikes beside a clear blue spring under cypress trees",
    caption: "Illustration: a clear spring under cypress in north Florida.",
    themes: ["springs", "inland", "trail"],
  },
];


/**
 * Every image a page can feature. Only the drawn scenes: the stock photos that
 * used to sit here were 750-800px files shown at up to 1,180px, which is what
 * made them look stretched and soft.
 */
export const PHOTOS = [...SCENES];

/**
 * The scene that suits a region, so a town page shows the kind of place it is:
 * the Atlantic surf, the Gulf at sunset, the Keys bridges, or inland oaks.
 */
const REGION_SCENE = {
  "daytona-and-the-space-coast": "atlantic",
  "first-coast": "spiral",
  "palm-beaches-and-treasure-coast": "lighthouse",
  "greater-miami-and-fort-lauderdale": "miami",
  "emerald-coast-and-30a": "emerald",
  "southwest-florida": "gulf",
  "sarasota-and-bradenton": "lifeguard",
  "tampa-bay": "tampa",
  "the-florida-keys": "keys",
  "orlando-and-central-florida": "trail",
  "north-florida": "springs",
};

export function sceneForRegion(regionSlug) {
  return SCENES.find((s) => s.id === REGION_SCENE[regionSlug]) || SCENES[0];
}

const BY_ID = new Map(PHOTOS.map((p) => [p.id, p]));

function hashOf(text) {
  let value = 0;
  for (let i = 0; i < String(text).length; i++) value = (value * 31 + String(text).charCodeAt(i)) >>> 0;
  return value;
}

/**
 * Deterministic featured image for a page, so a rebuild never reshuffles the
 * site. Always a scene: those are the only images sharp at banner width.
 */
/** Scenes that suit any page; the place-specific ones are kept for their region. */
const GENERAL = SCENES.filter((s) => ["atlantic", "gulf", "keys", "trail", "boardwalk"].includes(s.id));

export function photoFor(seed, offset = 0) {
  return GENERAL[(hashOf(seed) + offset) % GENERAL.length];
}

/** A second image for the page body, guaranteed to differ from the featured one. */
export function secondPhotoFor(seed) {
  const first = photoFor(seed);
  const pool = GENERAL.filter((p) => p.id !== first.id);
  return pool[(hashOf(`${seed}:2`)) % pool.length];
}

export function photoById(id) {
  return BY_ID.get(id) || PHOTOS[0];
}

/**
 * Renders a photo. `alt` should be page-specific; it falls back to the
 * library's generic description, which never names a business.
 */
export function figure(photo, { alt, caption, className = "", eager = false, sizes = "" } = {}) {
  const text = alt || photo.alt;
  return `<figure class="figure ${attr(className)}">
  <img src="${attr(photo.src)}" alt="${attr(text)}" width="${photo.width}" height="${photo.height}"
    loading="${eager ? "eager" : "lazy"}"${eager ? ' fetchpriority="high"' : ""} decoding="async"${
    sizes ? ` sizes="${attr(sizes)}"` : ""
  }>
  ${caption === null ? "" : `<figcaption>${esc(caption || photo.caption)}</figcaption>`}
</figure>`;
}

/** Wide banner used as the featured image at the top of a page. */
export function banner(photo, { alt, eager = true, className = "" } = {}) {
  return `<div class="page-banner ${attr(className)}">
  <img src="${attr(photo.src)}" alt="${attr(alt || photo.alt)}" width="${photo.width}" height="${photo.height}"
    loading="${eager ? "eager" : "lazy"}"${eager ? ' fetchpriority="high"' : ""} decoding="async">
</div>`;
}
