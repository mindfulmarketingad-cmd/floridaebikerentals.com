/**
 * Shortcodes for editorial content.
 *
 * Written in Markdown as a line of its own, pipe-delimited so that quotes never
 * need escaping through the renderer:
 *
 *   {{LISTICLE|city:Panama City Beach|count:10|radius:25}}
 *   {{MAP|city:Destin|radius:20}}
 *   {{PHOTO|id:beach|alt:Riders on the sand at Destin}}
 *
 * Each one is replaced after the Markdown is rendered, so a shortcode always
 * resolves against live directory data rather than a hand-written snapshot.
 */
import { esc, miles, slugify } from "./util.mjs";
import { listicle, mapPanel } from "./components.mjs";
import { photoById, figure } from "./images.mjs";

function parseArgs(raw) {
  const args = {};
  for (const part of raw.split("|")) {
    const at = part.indexOf(":");
    if (at === -1) continue;
    args[part.slice(0, at).trim().toLowerCase()] = part.slice(at + 1).trim();
  }
  return args;
}

/** Listings within `radius` miles of a town, best first. */
export function listingsNear(cityName, ctx, { radius = 25, count = 10 } = {}) {
  const city = ctx.index.citiesBySlug.get(slugify(cityName));
  if (!city || typeof city.lat !== "number") {
    const region = ctx.index.regions.find((r) => r.name.toLowerCase().includes(String(cityName).toLowerCase()));
    return (region ? region.listings : ctx.listings).slice(0, count);
  }
  return ctx.listings
    .filter((l) => typeof l.lat === "number")
    .map((l) => ({ ...l, distance: miles(city.lat, city.lng, l.lat, l.lng) }))
    .filter((l) => l.distance <= radius)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

export function expandShortcodes(html, ctx, seed = "page") {
  return html.replace(/<p>\s*\{\{([A-Z]+)((?:\|[^}]*)?)\}\}\s*<\/p>/g, (match, name, rest) => {
    const args = parseArgs(rest.replace(/^\|/, ""));

    if (name === "LISTICLE") {
      const rows = listingsNear(args.city || "", ctx, {
        radius: Number(args.radius || 25),
        count: Number(args.count || 10),
      });
      if (!rows.length) return "";
      const id = `map-${slugify(seed)}-${slugify(args.city || "list")}`;
      return `<div class="shortcode-listicle">
  ${args.map === "false" ? "" : mapPanel(rows, { id, zoom: 10, buttonLabel: "Show these on a map" })}
  ${listicle(rows)}
</div>`;
    }

    if (name === "MAP") {
      const rows = listingsNear(args.city || "", ctx, {
        radius: Number(args.radius || 25),
        count: Number(args.count || 30),
      });
      if (!rows.length) return "";
      return mapPanel(rows, { id: `map-${slugify(seed)}-${slugify(args.city || "map")}`, zoom: 10 });
    }

    if (name === "PHOTO") {
      return figure(photoById(args.id || "beach"), { alt: args.alt, caption: args.caption });
    }

    if (name === "CTA") {
      return `<div class="cta-inline">
  <p><strong>${esc(args.title || "Ready to ride?")}</strong> ${esc(args.text || "")}</p>
  <a class="btn btn--primary" href="${esc(args.href || "/partners/")}">${esc(args.label || "Rent Now")}</a>
</div>`;
    }

    return "";
  });
}
