/**
 * The site's photo library.
 *
 * These are stock e-bike photographs, not photographs of any listed business.
 * Anywhere one appears next to a specific shop it is captioned as such, so a
 * reader never mistakes it for that shop's own premises or equipment.
 */
import { esc, attr } from "./util.mjs";

export const PHOTOS = [
  {
    id: "trail",
    src: "/assets/img/ebike-trail-ride.jpg",
    width: 499,
    height: 400,
    alt: "Rider on a fat-tyre electric bike on a wide gravel trail, with two more riders behind",
    caption: "Fat-tyre e-bikes handle packed trail surfaces that leave a road bike struggling.",
    themes: ["trail", "tour", "inland", "guide"],
  },
  {
    id: "beach",
    src: "/assets/img/fat-tire-ebikes-beach.jpg",
    width: 516,
    height: 387,
    alt: "Two riders on fat-tyre electric bikes on hard-packed sand beside the surf",
    caption: "Beach-town rentals are built for hard-packed sand and seafront paths.",
    themes: ["beach", "coast", "family", "rental"],
  },
  {
    id: "cruiser",
    src: "/assets/img/ebike-cruiser-beachfront.webp",
    width: 800,
    height: 800,
    alt: "Rider on an electric beach cruiser moving along a seafront promenade",
    caption: "The step-through beach cruiser is the most rented e-bike style in Florida.",
    themes: ["cruiser", "town", "rental", "promenade"],
  },
  {
    id: "coastal",
    src: "/assets/img/couple-ebike-coastal-path.avif",
    width: 750,
    height: 1132,
    alt: "Two riders on electric bikes on a sandy coastal path with the ocean behind them",
    caption: "Coastal paths are where an e-bike earns its keep: flat, exposed and windy.",
    themes: ["coast", "couple", "beach", "tour"],
  },
];

const BY_ID = new Map(PHOTOS.map((p) => [p.id, p]));

function hashOf(text) {
  let value = 0;
  for (let i = 0; i < String(text).length; i++) value = (value * 31 + String(text).charCodeAt(i)) >>> 0;
  return value;
}

/** Deterministic photo for a page, so a rebuild never reshuffles the site. */
export function photoFor(seed, offset = 0) {
  return PHOTOS[(hashOf(seed) + offset) % PHOTOS.length];
}

/** A second photo guaranteed to differ from the featured one. */
export function secondPhotoFor(seed) {
  return PHOTOS[(hashOf(seed) + 1 + (hashOf(seed) % (PHOTOS.length - 1))) % PHOTOS.length];
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
