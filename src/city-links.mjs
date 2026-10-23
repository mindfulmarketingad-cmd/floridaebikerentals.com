/**
 * Everything on the site about one town, gathered in one place, so each town's
 * pages link to each other: the town hub (/cities/<town>/), its bike type
 * pages, its /find/ category pages, its trail guide, trail and cost guides that
 * name it, blog posts about it, its region roundup, battery shops and nearby
 * towns. The town hub shows the full set; the town's other pages show it as a
 * compact "More about <town>" block.
 */
import { esc, attr } from "./util.mjs";
import { nearbyCities } from "./data.mjs";
import { cityTrailUrl } from "./pages/city-trails.mjs";
import { guidesFor } from "./pages/find.mjs";

/** A town's name as a whole-word pattern, with "St." matching "St" too. */
function namePattern(name) {
  const body = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\./g, "\\.?");
  return new RegExp(`\\b${body}\\b`, "i");
}

export function makeCityLinker({ index, blog = [], hubEntries = {}, cityGuides = [], batteryTownList = [], cityTypeList = [], queries = [] }) {
  const trailBySlug = new Map(cityGuides.map((g) => [g.city.slug, g]));
  const batteryBySlug = new Map(batteryTownList.map((t) => [t.city.slug, t]));
  const hubLabel = { trails: "Trail guide", costs: "Costs", "electric-bike-types": "Bike type guide" };

  function groups(city) {
    const out = [];
    const types = cityTypeList.filter((x) => x.city.slug === city.slug);
    out.push({
      title: `Rent in ${city.name}`,
      links: [
        { href: city.url, label: `All ${city.listings.length} ${city.name} rental shops` },
        { href: `/rent/?town=${city.slug}`, label: `Book an e-bike in ${city.name}`, nofollow: true },
        ...(index.regionsBySlug.get(city.regionSlug) ? [{ href: index.regionsBySlug.get(city.regionSlug).url, label: `All ${city.region} towns` }] : []),
      ],
    });
    if (types.length) {
      out.push({ title: "By bike type", links: types.map((x) => ({ href: x.url, label: `${x.type.name} in ${city.name}` })) });
    }
    if (city.categories && city.categories.length) {
      out.push({
        title: "By what you need",
        links: city.categories.map((c) => ({ href: c.url, label: `${c.category.name} in ${city.name}` })),
      });
    }
    const ride = [];
    const trail = trailBySlug.get(city.slug);
    if (trail) ride.push({ href: trail.url, label: trail.title });
    const guides = [];
    const named = namePattern(city.name);
    const mentions = (item) => named.test(`${item.title || ""} ${item.description || ""} ${item.html || ""}`);
    for (const [hub, entries] of Object.entries(hubEntries)) {
      for (const e of entries || []) {
        if (!(e.towns || []).includes(city.slug) && !mentions(e)) continue;
        (hub === "trails" ? ride : guides).push({ href: e.url, label: `${e.shortTitle || e.title}${hub === "trails" ? "" : ` (${hubLabel[hub] || hub})`}` });
      }
    }
    if (ride.length) out.push({ title: `Ride in ${city.name}`, links: ride });
    const posts = [
      ...guidesFor([city.name], blog),
      ...blog.filter((p) => (p.regions || []).includes(city.regionSlug)),
      ...blog.filter(mentions),
    ];
    const seen = new Set();
    for (const p of posts) {
      if (seen.has(p.url)) continue;
      seen.add(p.url);
      guides.push({ href: p.url, label: p.title });
    }
    if (guides.length) out.push({ title: "Guides", links: guides });
    const searches = queries.filter((q) => named.test(q.query));
    if (searches.length) out.push({ title: "Searches", links: searches.map((q) => ({ href: q.url, label: q.query })) });
    const battery = batteryBySlug.get(city.slug);
    if (battery) out.push({ title: "Service", links: [{ href: battery.url, label: `E-bike battery replacement in ${city.name}` }] });
    const near = nearbyCities(city, index.cities, 6);
    if (near.length) out.push({ title: `Towns near ${city.name}`, links: near.map((c) => ({ href: c.url, label: `${c.name} e-bike rentals` })) });
    return out;
  }

  /** The link block. `skip` drops groups by title (ones the page already shows); `current` is the page's own URL. */
  function section(city, { title, current = "", skip = [], tint = false } = {}) {
    if (!city || !index.citiesBySlug.has(city.slug)) return "";
    const list = groups(city)
      .filter((g) => !skip.includes(g.title))
      .map((g) => ({ ...g, links: g.links.filter((l) => l.href !== current) }))
      .filter((g) => g.links.length);
    if (!list.length) return "";
    return `<section class="section${tint ? " section--tint" : ""}">
  <div class="wrap">
    <h2>${esc(title || `More about ${city.name}`)}</h2>
    <div class="city-links">${list
      .map(
        (g) => `<div class="city-links__group">
        <h3>${esc(g.title)}</h3>
        <ul>${g.links
          .map((l) => `<li><a href="${attr(l.href)}"${l.nofollow ? ' rel="nofollow"' : ""}>${esc(l.label)}</a></li>`)
          .join("")}</ul>
      </div>`
      )
      .join("")}</div>
  </div>
</section>`;
  }

  return { groups, section };
}
