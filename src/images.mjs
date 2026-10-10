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
import { esc, attr } from "./util.mjs";

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
  "first-coast": "atlantic",
  "palm-beaches-and-treasure-coast": "atlantic",
  "greater-miami-and-fort-lauderdale": "boardwalk",
  "emerald-coast-and-30a": "gulf",
  "southwest-florida": "gulf",
  "sarasota-and-bradenton": "gulf",
  "tampa-bay": "gulf",
  "the-florida-keys": "keys",
  "orlando-and-central-florida": "trail",
  "north-florida": "trail",
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
export function photoFor(seed, offset = 0) {
  return SCENES[(hashOf(seed) + offset) % SCENES.length];
}

/** A second image for the page body, guaranteed to differ from the featured one. */
export function secondPhotoFor(seed) {
  const first = photoFor(seed);
  const pool = PHOTOS.filter((p) => p.id !== first.id);
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
