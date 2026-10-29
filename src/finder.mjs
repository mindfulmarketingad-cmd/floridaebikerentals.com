/**
 * The e-bike finder: the homepage search that matches a rider's town, bike
 * style, day, start time and rental length against every shop we list.
 *
 * The build writes a compact copy of the directory (finderData) that the
 * browser loads when someone searches; assets/js/app.js does the matching.
 * Every filter uses data we hold, and nothing is guessed:
 *   - a specific bike style matches shops whose Google profile names it, or
 *     that the owner confirmed (data/shop-bike-types.json); other e-bike shops
 *     are shown after them, labelled "ask about" the style;
 *   - day, start time and length use the shop's published hours, and a shop
 *     with no published hours is kept but labelled so.
 */
import { esc, attr, trackedUrl } from "./util.mjs";
import { facetsOf, finderFacets } from "./facets.mjs";
import { bikeIcon } from "./bike-icons.mjs";

export const FINDER_STYLES = [
  { value: "ebike", label: "Any e-bike" },
  { value: "cruiser", label: "Beach cruiser e-bike" },
  { value: "fat-tire", label: "Fat-tire e-bike" },
  { value: "step-through", label: "Step-through e-bike" },
  { value: "hybrid", label: "Commuter e-bike" },
  { value: "cargo", label: "Cargo / family e-bike" },
  { value: "trike", label: "Electric trike" },
  { value: "pedal", label: "Regular bike (no motor)" },
  { value: "tour", label: "Guided e-bike tour" },
];

export const FINDER_LENGTHS = [
  { value: "2h", label: "1 to 2 hours", minutes: 120 },
  { value: "half", label: "Half day", minutes: 240 },
  { value: "full", label: "Full day", minutes: 480 },
  { value: "multi", label: "2 to 6 days", minutes: 0 },
  { value: "week", label: "A week or more", minutes: 0 },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "9:30AM" -> minutes after midnight; a bare "12" is resolved by the caller. */
function clock(text) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(text.trim());
  if (!m) return null;
  return { h: +m[1] % 12, min: +(m[2] || 0), mer: m[3] ? m[3].toUpperCase() : "" };
}
const minutes = (c, mer) => c.h * 60 + c.min + (mer === "PM" ? 720 : 0);

/** "9AM - 5:30PM", "12 - 5PM", "Open 24 hours", "Closed" -> [[open, close], ...] in minutes, 0 if closed, null if unknown. */
export function parseHours(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  if (/^closed$/i.test(t)) return 0;
  if (/24 hours/i.test(t)) return [[0, 1440]];
  const out = [];
  for (const part of t.split(",")) {
    const [a, b] = part.split(/\s*[-–]\s*/);
    if (!a || !b) return null;
    const s = clock(a), e = clock(b);
    if (!s || !e) return null;
    const endMer = e.mer || s.mer || "PM";
    let close = minutes(e, endMer);
    if (endMer === "AM" && close === 0) close = 1440; // closes at midnight
    let open = minutes(s, s.mer || endMer);
    if (!s.mer && open > close) open = minutes(s, "AM");
    if (close <= open) close += 1440; // closes after midnight
    out.push([open, close]);
  }
  return out.length ? out : null;
}

/** Monday-first week of parsed hours, or null when the shop publishes none. */
function weekHours(listing) {
  if (!listing.hours || !listing.hours.length) return null;
  return DAYS.map((d) => {
    const h = listing.hours.find((x) => x.day === d);
    if (!h) return null;
    return h.closed ? 0 : parseHours(h.hours);
  });
}

/** The compact directory the browser searches. Short keys keep the file small. */
export function finderData(listings) {
  return listings.map((l) => {
    const styles = (l.bikeTypes || []).filter((t) => !t.general).map((t) => t.style);
    return {
      s: l.slug,
      n: l.name,
      c: l.city,
      cs: l.citySlug,
      u: l.url,
      la: typeof l.lat === "number" ? Math.round(l.lat * 1e5) / 1e5 : null,
      lo: typeof l.lng === "number" ? Math.round(l.lng * 1e5) / 1e5 : null,
      ra: l.rating || 0,
      rv: l.reviews || 0,
      sc: Math.round((l.score || 0) * 1000) / 1000,
      e: (l.tags || []).includes("Electric bikes") ? 1 : 0,
      r: l.is_rental ? 1 : 0,
      d: (l.tags || []).includes("Delivery available") ? 1 : 0,
      g: (l.tags || []).includes("Guided tours") ? 1 : 0,
      b: styles,
      ph: l.phone || "",
      w: l.website ? trackedUrl(l.website, "finder") : "",
      bk: l.booking_link && l.booking_link !== l.website ? trackedUrl(l.booking_link, "finder", "booking") : "",
      f: facetsOf(l),
      a: l.address || `${l.city}, FL`,
      m: l.maps_link || "",
      im: l.logo || l.photo || "",
      lg: l.logo ? 1 : 0,
      h: weekHours(l),
      hs: (l.hours || []).length ? DAYS.map((d) => (l.hours.find((x) => x.day === d) || {}).hours || "") : null,
    };
  });
}

/** Towns for the "Where" picker, grouped by region, every town with a shop. */
function townOptions(index, selected = "") {
  return [...index.regions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => {
      const towns = [...r.cities, ...(r.thinCities || [])].sort((a, b) => a.name.localeCompare(b.name));
      return `<optgroup label="${attr(r.name)}">${towns
        .map((t) => `<option value="${attr(t.slug)}"${t.slug === selected ? " selected" : ""}>${esc(t.name)}</option>`)
        .join("")}</optgroup>`;
    })
    .join("");
}

/** Every town with a shop, for the type-ahead: [slug, name, region, shops]. */
function townList(index) {
  const towns = index.regions.flatMap((r) => [...r.cities, ...(r.thinCities || [])].map((t) => [t.slug, t.name, r.name, t.listings.length]));
  return towns.sort((a, b) => b[3] - a[3] || a[1].localeCompare(b[1]));
}

function startTimes() {
  const out = ['<option value="">Any time</option>'];
  for (let h = 7; h <= 18; h++) {
    const label = `${h % 12 || 12}${h < 12 ? " AM" : " PM"}`;
    out.push(`<option value="${h * 60}">${label}</option>`);
  }
  return out.join("");
}

/** The full finder form for the homepage hero. */
export function finderForm(index, { dataUrl }) {
  return `<form class="finder" id="finder" data-finder data-src="${attr(dataUrl)}" role="search" aria-label="Find an e-bike rental shop">
  <p class="finder__title">Your Next Ride Starts Here</p>
  <div class="finder__grid">
    <div class="finder__field finder__field--where town-pick" data-town-pick>
      <label for="finder-town"><span>Where</span></label>
      <input id="finder-town" type="text" data-town-input placeholder="Type your town, e.g. Destin" autocomplete="off" spellcheck="false"
        role="combobox" aria-autocomplete="both" aria-expanded="false" aria-controls="finder-town-list">
      <input type="hidden" name="town">
      <ul id="finder-town-list" class="town-pick__list" role="listbox" hidden></ul>
      <script type="application/json" data-town-data>${JSON.stringify(townList(index)).replace(/</g, "\\u003c")}</script>
    </div>
    <label class="finder__field">
      <span>Bike</span>
      <select name="type">${FINDER_STYLES.map((s) => `<option value="${attr(s.value)}">${esc(s.label)}</option>`).join("")}</select>
    </label>
    <label class="finder__field">
      <span>Day</span>
      <input type="date" name="date">
    </label>
    <label class="finder__field">
      <span>Start time</span>
      <select name="time">${startTimes()}</select>
    </label>
    <label class="finder__field">
      <span>How long</span>
      <select name="length">${FINDER_LENGTHS.map((l, i) => `<option value="${attr(l.value)}"${i === 1 ? " selected" : ""}>${esc(l.label)}</option>`).join("")}</select>
    </label>
    <button class="btn btn--primary finder__go" type="submit">Find E-bike Shops</button>
  </div>
  <fieldset class="finder__extras">
    <legend>Must have</legend>
    <label><input type="checkbox" name="f" value="delivery"> Delivers to you</label>
    <label><input type="checkbox" name="f" value="repairs"> Repairs</label>
    <label><input type="checkbox" name="f" value="online"> Online booking</label>
    <label><input type="checkbox" name="f" value="r45"> 4.5+ stars</label>
  </fieldset>
  ${finderFacets()}
  <p class="finder__error" data-finder-error role="alert" hidden></p>
</form>`;
}

/** Where results appear, with the loading animation and the icons the cards use. */
export function finderResults() {
  const icons = ["cruiser", "fat-tire", "step-through", "hybrid", "cargo", "trike", "mountain", "folding", "lightweight", "pedal"]
    .map((s) => `<template data-bike-icon="${s}">${bikeIcon(s)}</template>`)
    .join("");
  return `<section class="finder-results" id="results" data-finder-results hidden aria-live="polite">
  <div class="wrap">
    <div class="finder-loading" data-finder-loading hidden>
      <div class="finder-loading__road" aria-hidden="true">
        <span class="finder-loading__bike">${bikeIcon("fat-tire")}</span>
      </div>
      <p class="finder-loading__text" data-finder-step>Searching shops...</p>
    </div>
    <div data-finder-output></div>
  </div>
  ${icons}
</section>`;
}

/**
 * A short finder for content pages: town and day, with the bike style set by
 * the page. It opens the homepage finder with those filled in and searches.
 */
export function quickFind(index, { type = "ebike", heading = "Find an e-bike shop", town = "" } = {}) {
  return `<form class="quick-rent" action="/" method="get">
  <p class="quick-rent__title">${esc(heading)}</p>
  <input type="hidden" name="type" value="${attr(type)}">
  <label class="field"><span>Where</span><select name="town" required><option value="">Choose a town</option>${townOptions(index, town)}</select></label>
  <label class="field"><span>Day</span><input type="date" name="date"></label>
  <button class="btn btn--primary" type="submit">Find Shops</button>
  <p class="quick-rent__note small muted">We match your town, bike and day against every shop's listing and opening hours.</p>
</form>`;
}

/** Link into the homepage finder with fields filled in, e.g. finderHref({ town: "sarasota", type: "fat-tire" }). */
export function finderHref(params = {}) {
  const q = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  if (!q) return "/#finder";
  // With a town the finder searches straight away; without one it waits for the rider to pick.
  return `/?${q}${params.town ? "#results" : "#finder"}`;
}
