/* Shared helpers for the static build. Everything that touches imported data
   goes through esc()/attr() so scraped text can never inject markup. */

const HTML_ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);
}

export const attr = esc;

/** Escapes a string for use inside a JSON-LD / JSON attribute payload. */
export function jsonAttr(value) {
  return esc(JSON.stringify(value));
}

export function jsonLd(data) {
  const json = JSON.stringify(data, null, 0)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  return `<script type="application/ld+json">${json}</script>`;
}

/**
 * Title Case for page titles and H1s. It only ever raises a lowercase word, so
 * shop names, acronyms (30A, FL), mixed-case brands (eBike) and anything the
 * owner capitalised on purpose ("Near Me In") are left exactly as written.
 * Short articles, conjunctions and prepositions stay lowercase unless they
 * open or close the title or follow a colon or dash. Hyphenated words are
 * capitalised on both sides: "e-bike" becomes "E-Bike".
 */
const SMALL_WORDS = new Set(
  "a an and as at but by en for if in nor of on or per so the to up via vs yet from into onto with".split(" ")
);
export function titleCase(text, { first = true, last = true } = {}) {
  const parts = String(text).split(/(\s+)/);
  const words = parts.map((p, i) => (i % 2 ? null : p));
  // A piece of a longer heading (text either side of a tag) only opens or
  // closes the title when it really is the first or last piece.
  const lastIndex = last ? words.reduce((l, w, i) => (w ? i : l), -1) : -1;
  let afterBreak = first;
  return parts
    .map((part, i) => {
      if (i % 2) return part;
      if (!part) return part;
      const raise = (w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w);
      const bare = part.toLowerCase().replace(/[^a-z]/g, "");
      const keepSmall = !afterBreak && i !== lastIndex && SMALL_WORDS.has(bare) && part === part.toLowerCase();
      afterBreak = /[:\u2014\u2013-]$/.test(part) || part === "-" || part === "|";
      // Leave anything that is not plain lowercase-led text alone (URLs, emails, mixed case).
      if (keepSmall || /[@/]|\.\w/.test(part) || /^[a-z]+[A-Z]/.test(part)) return part;
      return part.split("-").map(raise).join("-");
    })
    .join("");
}

export function slugify(text, fallback = "page") {
  return (
    String(text || "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/['’`]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || fallback
  );
}

export function unique(list) {
  return Array.from(new Set(list));
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function plural(count, singular, pluralWord) {
  return count === 1 ? singular : pluralWord || `${singular}s`;
}

export function commaList(items, joiner = "and") {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} ${joiner} ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} ${joiner} ${list[list.length - 1]}`;
}

export function miles(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => typeof v !== "number")) return Infinity;
  const R = 3958.7613;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatRating(rating) {
  return rating ? Number(rating).toFixed(1) : "";
}

export function formatReviews(count) {
  return Number(count || 0).toLocaleString("en-US");
}

export function phoneHref(phone) {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  return digits.length >= 10 ? digits : "";
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function stars(rating) {
  const value = Number(rating) || 0;
  let out = '<span class="stars" aria-hidden="true">';
  for (let i = 1; i <= 5; i++) {
    const filled = value >= i - 0.25;
    out +=
      `<svg viewBox="0 0 20 20" width="16" height="16"><path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" fill="${
        filled ? "currentColor" : "#dbe3f5"
      }"/></svg>`;
  }
  return `${out}</span>`;
}

export function ratingBlock(listing) {
  if (!listing.rating) return '<span class="rating rating--none muted small">No Google rating yet</span>';
  return (
    `<span class="rating">${stars(listing.rating)}` +
    `<span>${formatRating(listing.rating)}</span>` +
    `<span class="rating__count">(${formatReviews(listing.reviews)} ${plural(listing.reviews, "review")})</span></span>`
  );
}

export function todayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

export function isoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function prettyDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** Deterministic shuffle so "related" blocks vary between pages but not between builds. */
export function seededPick(list, count, seed) {
  const out = [];
  const pool = list.slice();
  let value = 0;
  for (let i = 0; i < String(seed).length; i++) value = (value * 31 + String(seed).charCodeAt(i)) >>> 0;
  while (pool.length && out.length < count) {
    value = (value * 1664525 + 1013904223) >>> 0;
    out.push(pool.splice(value % pool.length, 1)[0]);
  }
  return out;
}

/** Trims a sentence to a clean length for meta descriptions (<=160 chars). */
export function clamp(text, max = 158) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(", "), cut.lastIndexOf(" "));
  return `${cut.slice(0, stop > 60 ? stop : cut.length).replace(/[,.\s]+$/, "")}…`;
}

/**
 * Trims a scraped business name down to something that fits in a title tag.
 * Scraped names frequently carry a whole tagline after a pipe or a dash.
 */
export function shortName(name, max = 40) {
  let text = String(name || "").trim();
  const split = text.split(/\s+[|•·]\s+|\s+[-–—]\s+/)[0].trim();
  if (split.length >= 6) text = split;
  text = text.replace(/\s*\([^)]*\)\s*$/, "").trim();
  text = text.replace(/[,.\s]+$/, "");
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > 12 ? cut.slice(0, space) : cut).replace(/[,\-–—:|&\s]+$/, "");
}

/** Builds "<name> <suffix>" so the whole title stays inside the SERP budget. */
export function fitTitle(name, suffix, budget = 62) {
  return `${shortName(name, Math.max(18, budget - suffix.length))}${suffix}`;
}

/**
 * A shop's website or booking link tagged with UTM parameters, so the shop's
 * analytics (and ours, via the partner_click event) can attribute the visit.
 * `campaign` says where on the site the click came from: finder, directory or
 * listing; `content` which link it was: website or booking.
 */
export function trackedUrl(url, campaign, content = "website") {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return url;
    u.searchParams.set("utm_source", "floridaebikerentals.com");
    u.searchParams.set("utm_medium", "referral");
    u.searchParams.set("utm_campaign", campaign);
    u.searchParams.set("utm_content", content);
    return u.toString();
  } catch {
    return url;
  }
}
