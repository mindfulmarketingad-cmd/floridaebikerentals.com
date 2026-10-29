/**
 * The clickable Florida map on /cities/: the state outline and each town's
 * Census boundary (data/city-boundaries.json, from scripts/fetch-city-boundaries.mjs),
 * every town a link to its page. Towns without a Census boundary (unincorporated
 * beach communities) are drawn as a pin at the centre of their shops. Zoom and
 * pan live in assets/js/app.js.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { esc, attr, plural } from "./util.mjs";
import { ROOT } from "./data.mjs";

const W = 1000;

function loadBoundaries() {
  const file = join(ROOT, "data", "city-boundaries.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

/** Douglas-Peucker in screen units, so the outline keeps its shape at map scale. */
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let far = -1, dist = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > dist) { dist = d; far = i; }
    }
    if (far !== -1 && dist > tol) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** A closed ring starts and ends on the same point, so split it at its far side first. */
function simplifyRing(pts, tol) {
  let far = 0, dist = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > dist) { dist = d; far = i; }
  }
  if (!far) return pts;
  return [...simplify(pts.slice(0, far + 1), tol), ...simplify(pts.slice(far), tol).slice(1)];
}

export function floridaMap(index) {
  const data = loadBoundaries();
  if (!data) return "";
  const all = data.florida.flat();
  const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const PAD = 16;
  const scale = (W - PAD * 2) / ((maxX - minX) * k);
  const H = Math.round((maxY - minY) * scale + PAD * 2);
  const project = ([lon, lat]) => [PAD + (lon - minX) * k * scale, PAD + (maxY - lat) * scale];
  const path = (rings, tol) =>
    rings
      .map((r) => simplifyRing(r.map(project), tol))
      .filter((r) => r.length >= 3)
      .map((r) => `M${r.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`)
      .join("");

  const towns = [...index.cities, ...(index.thinCities || [])]
    .map((city) => {
      // Smaller towns carry no centre of their own; use the middle of their shops.
      const shops = city.listings.filter((l) => typeof l.lat === "number" && typeof l.lng === "number");
      const lat = typeof city.lat === "number" ? city.lat : shops.reduce((s, l) => s + l.lat, 0) / shops.length;
      const lng = typeof city.lng === "number" ? city.lng : shops.reduce((s, l) => s + l.lng, 0) / shops.length;
      return { city, lat, lng };
    })
    .filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng))
    .map(({ city, lat, lng }) => {
      const [cx, cy] = project([lng, lat]);
      const shape = data.towns[city.slug];
      return { city, cx, cy, d: shape ? path(shape.rings, 0.35) : "" };
    })
    .sort((a, b) => a.city.listings.length - b.city.listings.length);
  // Label the biggest towns, skipping any that would sit on top of one already labelled.
  const labels = [];
  for (const t of [...towns].sort((a, b) => b.city.listings.length - a.city.listings.length)) {
    if (labels.length === 14) break;
    if (labels.every((l) => Math.hypot(l.cx - t.cx, (l.cy - t.cy) * 3) > 60)) labels.push(t);
  }
  // The centre of the peninsula's towns, where the + button zooms first (the map's own centre is the Gulf).
  const focus = [towns.reduce((s, t) => s + t.cx, 0) / towns.length, towns.reduce((s, t) => s + t.cy, 0) / towns.length];

  return `<div class="fl-map" data-fl-map>
  <div class="fl-map__tools" role="group" aria-label="Map zoom">
    <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
    <button type="button" data-zoom="out" aria-label="Zoom out">&minus;</button>
    <button type="button" data-zoom="reset">Reset</button>
  </div>
  <svg class="fl-map__svg" viewBox="0 0 ${W} ${H}" data-w="${W}" data-h="${H}" data-focus="${focus.map((n) => n.toFixed(0)).join(" ")}" role="img" aria-label="Map of Florida with each town we list. Select a town to see its rental shops.">
    <path class="fl-map__state" d="${path(data.florida, 0.6)}"/>
    <g class="fl-map__towns">${towns
      .map(
        ({ city, cx, cy, d }) => `<a class="fl-map__town${d ? "" : " is-pin"}" href="${attr(city.url)}" data-name="${attr(city.name)}" data-count="${city.listings.length}">
        <title>${esc(city.name)}: ${city.listings.length} ${plural(city.listings.length, "shop")}</title>
        ${d ? `<path class="fl-map__area" d="${d}"/>` : ""}
        <circle class="fl-map__dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${d ? 3.2 : city.listings.length > 2 ? 4.2 : 3.4}"/>
      </a>`
      )
      .join("")}</g>
    <g class="fl-map__labels" aria-hidden="true">${labels
      .map((t) =>
        // East-coast labels go to the left of the dot so they stay on the map.
        t.cx > W * 0.8
          ? `<text x="${(t.cx - 7).toFixed(1)}" y="${(t.cy + 4).toFixed(1)}" text-anchor="end">${esc(t.city.name)}</text>`
          : `<text x="${(t.cx + 7).toFixed(1)}" y="${(t.cy + 4).toFixed(1)}">${esc(t.city.name)}</text>`
      )
      .join("")}</g>
  </svg>
  <p class="fl-map__tip" data-fl-tip aria-live="polite">Tap a town to see its shops. Zoom in for the smaller towns.</p>
  <p class="fl-map__credit small muted">Town boundaries: US Census Bureau TIGER places. Smaller towns, and towns with no Census boundary, are shown as a dot.</p>
</div>`;
}
