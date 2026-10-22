/**
 * Which bike styles each shop offers, for the icon row on listing cards and
 * listing pages. The directory has no bike-type field, so a style is shown only
 * when there is a source for it:
 *   owner   - data/shop-bike-types.json, filled in by the site owner;
 *   profile - the shop's own Google profile names it (the type guides' tests);
 *   tag     - only the general kind: "E-bikes" for shops tagged Electric bikes,
 *             "Bikes" for other rental shops.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { esc, attr } from "./util.mjs";
import { bikeIcon } from "./bike-icons.mjs";
import { ROOT } from "./data.mjs";

export const STYLE_LABELS = {
  cruiser: "Cruiser",
  "fat-tire": "Fat-tire",
  "step-through": "Step-through",
  hybrid: "Commuter",
  cargo: "Cargo",
  trike: "Trike",
  folding: "Folding",
  mountain: "Mountain",
  lightweight: "Lightweight",
  pedal: "Pedal bikes",
};

function loadOverrides() {
  const file = join(ROOT, "data", "shop-bike-types.json");
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, "utf8")).shops || {};
}

/** Sets listing.bikeTypes = [{ style, label, source }] on every listing. */
export function assignBikeTypes(listings, typeEntries = []) {
  const overrides = loadOverrides();
  const tests = typeEntries
    .filter((e) => e.match && e.style && STYLE_LABELS[e.style])
    .map((e) => ({ style: e.style, re: new RegExp(e.match, "i") }));
  for (const l of listings) {
    const found = new Map();
    for (const style of overrides[l.slug] || []) {
      if (STYLE_LABELS[style]) found.set(style, { style, label: STYLE_LABELS[style], source: "owner" });
    }
    const text = [l.name, l.description, l.subtypes, l.category, l.type].filter(Boolean).join(" ");
    for (const t of tests) {
      if (!found.has(t.style) && t.re.test(text)) found.set(t.style, { style: t.style, label: STYLE_LABELS[t.style], source: "profile" });
    }
    const list = [...found.values()];
    const ebike = (l.tags || []).includes("Electric bikes");
    if (ebike && !list.some((t) => t.style !== "pedal")) list.push({ style: "hybrid", label: "E-bikes", source: "tag", general: true });
    if (!ebike && l.is_rental && !list.length) list.push({ style: "pedal", label: "Bikes", source: "tag", general: true });
    l.bikeTypes = list;
  }
}

/** Small icon row for a listing card. */
export function bikeTypeRow(listing) {
  const list = listing.bikeTypes || [];
  if (!list.length) return "";
  return `<ul class="bike-types" aria-label="Bikes offered">${list
    .map(
      (t) => `<li class="bike-types__item" title="${attr(t.general ? `${t.label} (from the shop's listing)` : `${t.label} (${t.source === "owner" ? "confirmed by us" : "named in the shop's Google profile"})`)}">${bikeIcon(t.style)}<span>${esc(t.label)}</span></li>`
    )
    .join("")}</ul>`;
}
