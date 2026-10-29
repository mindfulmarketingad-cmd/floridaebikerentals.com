/**
 * Filters for the town pages and the homepage finder, every one read from a
 * field of the Google import (tags, categories, the "about" attributes, hours,
 * rating) or from the owner's confirmed bike styles. A filter only appears on
 * a page when at least one shop there has it, with the count beside it.
 */
import { esc, attr } from "./util.mjs";
import { STYLE_LABELS } from "./bike-types.mjs";
import { parseHours } from "./finder.mjs";

const subtypes = (l) => String(l.subtypes || "").split(/,\s*/).filter(Boolean);
const hasSub = (l, ...names) => subtypes(l).some((s) => names.includes(s));
const hasTag = (l, t) => (l.tags || []).includes(t);
const about = (l, group, item) =>
  (l.about || []).some((g) => (group instanceof RegExp ? group.test(g.group) : g.group === group) && (g.items || []).some((i) => (item instanceof RegExp ? item.test(i) : i === item)));

const openDays = (l) => (l.hours || []).filter((h) => !h.closed && h.hours && !/closed/i.test(h.hours));
const windows = (l) => openDays(l).map((h) => parseHours(h.hours)).filter(Array.isArray).flat();
const opensBy = (l, mins) => windows(l).some(([o]) => o <= mins);
const openAfter = (l, mins) => windows(l).some(([, c]) => c >= mins);

/** Battery replacement uses the same rule as the battery pages. */
const battery = (l) =>
  hasSub(l, "Battery store") || (hasSub(l, "Electric bicycle store") && hasSub(l, "Bicycle repair shop", "Electric motor repair shop"));

export const FACET_GROUPS = [
  {
    title: "Rentals and services",
    facets: [
      { key: "ebike", label: "E-bike rentals", test: (l) => l.is_rental && hasTag(l, "Electric bikes") },
      { key: "bike", label: "Bike rentals", test: (l) => l.is_rental },
      { key: "tours", label: "Guided tours", test: (l) => hasTag(l, "Guided tours") || hasSub(l, "Tour operator", "Tour agency", "Sightseeing tour agency") },
      { key: "delivery", label: "Delivers to you", test: (l) => hasTag(l, "Delivery available") || about(l, "Service options", "Delivery") },
      { key: "repairs", label: "Repairs", test: (l) => hasSub(l, "Bicycle repair shop", "Electric motor repair shop", "Scooter repair shop") || about(l, "Offerings", "Repair services") },
      { key: "battery", label: "Battery replacement", test: battery },
      { key: "sales", label: "Sells e-bikes", test: (l) => hasSub(l, "Electric bicycle store", "Electric motorcycle dealer") },
      { key: "used", label: "Used bikes", test: (l) => hasSub(l, "Used bicycle shop") || about(l, "Offerings", "Used goods") },
      { key: "scooters", label: "Scooters and mopeds", test: (l) => hasTag(l, "Scooters") || hasSub(l, "Scooter rental service", "Moped dealer", "Motor scooter dealer") },
      { key: "golf", label: "Golf carts", test: (l) => hasTag(l, "Golf carts") || hasSub(l, "Golf cart dealer") },
      { key: "water", label: "Kayaks and paddleboards", test: (l) => hasTag(l, "Watersports") || hasSub(l, "Canoe & kayak rental service", "Water sports equipment rental service") },
    ],
  },
  {
    title: "Bike styles listed",
    facets: Object.entries(STYLE_LABELS).map(([style, label]) => ({
      key: `style-${style}`,
      label,
      test: (l) => (l.bikeTypes || []).some((t) => !t.general && t.style === style),
    })),
  },
  {
    title: "Hours",
    facets: [
      { key: "open-now", label: "Open now", test: (l) => openDays(l).length > 0, live: true },
      { key: "open-7", label: "Open 7 days", test: (l) => openDays(l).length === 7 },
      { key: "sunday", label: "Open Sunday", test: (l) => openDays(l).some((h) => h.day === "Sunday") },
      { key: "early", label: "Opens by 9 AM", test: (l) => opensBy(l, 540) },
      { key: "late", label: "Open after 6 PM", test: (l) => openAfter(l, 1080) },
    ],
  },
  {
    title: "Ratings",
    facets: [
      { key: "r45", label: "4.5+ stars", test: (l) => l.rating >= 4.5 },
      { key: "r48", label: "4.8+ stars", test: (l) => l.rating >= 4.8 },
      { key: "rv100", label: "100+ reviews", test: (l) => (l.reviews || 0) >= 100 },
    ],
  },
  {
    title: "Booking and payment",
    facets: [
      { key: "online", label: "Online booking", test: (l) => Boolean(l.booking_link) || about(l, "Service options", "Online appointments") },
      { key: "website", label: "Has a website", test: (l) => Boolean(l.website) },
      { key: "cards", label: "Takes credit cards", test: (l) => about(l, "Payments", "Credit cards") },
      { key: "tap", label: "Tap to pay", test: (l) => about(l, "Payments", "NFC mobile payments") },
    ],
  },
  {
    title: "Access and amenities",
    facets: [
      { key: "wheelchair", label: "Wheelchair accessible", test: (l) => about(l, "Accessibility", "Wheelchair accessible entrance") },
      { key: "parking", label: "Free parking", test: (l) => about(l, "Parking", /^Free /) },
      { key: "restroom", label: "Restroom", test: (l) => about(l, /Amenities|Accessibility/, /restroom/i) },
      { key: "kids", label: "Kid and family friendly", test: (l) => about(l, "Children", /./) },
      { key: "lgbtq", label: "LGBTQ+ friendly", test: (l) => about(l, /Crowd|Other/, "LGBTQ+ friendly") },
    ],
  },
  {
    title: "Owned by",
    facets: [
      { key: "small", label: "Small business", test: (l) => about(l, "From the business", "Small business") },
      { key: "women", label: "Women-owned", test: (l) => about(l, /From the business|Other/, "Identifies as women-owned") },
      { key: "veteran", label: "Veteran-owned", test: (l) => about(l, /From the business|Other/, "Identifies as veteran-owned") },
      { key: "black", label: "Black-owned", test: (l) => about(l, /From the business|Other/, "Identifies as Black-owned") },
      { key: "latino", label: "Latino-owned", test: (l) => about(l, /From the business|Other/, "Identifies as Latino-owned") },
    ],
  },
];

const ALL = FACET_GROUPS.flatMap((g) => g.facets);

/** Facet keys a listing has, for data-f on cards and "f" in the finder data. */
export function facetsOf(listing) {
  return ALL.filter((f) => f.test(listing)).map((f) => f.key);
}

/** Opening hours as "Mon-first" pairs for the live "Open now" filter: [[open, close], ...] per day, 0 closed, null unknown. */
export function hoursAttr(listing) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  if (!(listing.hours || []).length) return "";
  return JSON.stringify(
    days.map((d) => {
      const h = listing.hours.find((x) => x.day === d);
      return !h ? null : h.closed ? 0 : parseHours(h.hours);
    })
  );
}

/**
 * The filter panel for a page's listings: every facet at least one of them
 * has, grouped, with counts. Checkboxes named "f"; a shop must have them all.
 */
export function facetPanel(listings, { open = false } = {}) {
  const groups = FACET_GROUPS.map((g) => ({
    title: g.title,
    facets: g.facets
      .map((f) => ({ ...f, count: listings.filter((l) => f.test(l)).length }))
      .filter((f) => f.count > 0 && !(f.count === listings.length && !f.live && listings.length > 1)),
  })).filter((g) => g.facets.length);
  if (!groups.length) return "";
  return `<details class="facets"${open ? " open" : ""}>
  <summary><span>Filters</span> <span class="facets__on" data-facet-count hidden></span></summary>
  <div class="facets__body">
    ${groups
      .map(
        (g) => `<fieldset class="facets__group">
      <legend>${esc(g.title)}</legend>
      ${g.facets
        .map(
          (f) => `<label class="facet"><input type="checkbox" name="f" value="${attr(f.key)}"> <span>${esc(f.label)}</span> <span class="facet__n">${f.count}</span></label>`
        )
        .join("")}
    </fieldset>`
      )
      .join("")}
    <p class="facets__note small">From each shop's public Google listing. Bike styles show only where a shop's listing names them.</p>
    <button class="btn btn--outline btn--sm" type="button" data-facet-clear>Clear filters</button>
  </div>
</details>`;
}

/** The same groups for the homepage finder, without counts (it covers the whole state). */
export function finderFacets() {
  return `<details class="facets facets--finder">
  <summary><span>More filters</span> <span class="facets__on" data-facet-count hidden></span></summary>
  <div class="facets__body">
    ${FACET_GROUPS.filter((g) => g.title !== "Bike styles listed")
      .map(
        (g) => `<fieldset class="facets__group">
      <legend>${esc(g.title)}</legend>
      ${g.facets
        .filter((f) => !["ebike", "bike", "tours", "open-now", "delivery", "repairs", "online", "r45"].includes(f.key))
        .map((f) => `<label class="facet"><input type="checkbox" name="f" value="${attr(f.key)}"> <span>${esc(f.label)}</span></label>`)
        .join("")}
    </fieldset>`
      )
      .join("")}
    <button class="btn btn--outline btn--sm" type="button" data-facet-clear>Clear filters</button>
  </div>
</details>`;
}
