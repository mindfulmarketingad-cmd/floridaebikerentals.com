/**
 * Town + bike type pages: /cities/<town>/<type>-rentals/, for example
 * "Fat Tire Electric Bike Rentals Near Sarasota, Florida".
 *
 * The directory has no field for which bikes a shop rents, so these pages never
 * claim a shop has a type unless its own Google profile names it. What each page
 * does offer is real: the town's rental shops (e-bike shops first), the town's
 * mapped bike routes ranked for that type of bike, and a booking form that asks
 * shops in the town for that style on the rider's behalf.
 *
 * Only the five types a rider can ask for on the booking form get town pages.
 * Folding, lightweight and mountain e-bikes have no style on the form, so a
 * "book one" page for them would promise something the form can't ask for.
 */
import { esc, attr, plural, commaList, clamp, formatReviews } from "../util.mjs";
import { page, breadcrumbSchema } from "../layout.mjs";
import { listicle, faqBlock, faqSchema, itemListSchema, adSlot, adSlotScript, ADSENSE_INLINE, linkCloud } from "../components.mjs";
import { nearbyCities } from "../data.mjs";
import { sceneForRegion, sitePhoto, figure, secondPhotoFor } from "../images.mjs";
import { bikeIcon } from "../bike-icons.mjs";
import { findHero } from "../find-hero.mjs";
import { quickRent } from "./rent.mjs";

const TYPES_HUB = "electric-bike-types";
const UNPAVED = /gravel|sand|unpaved|dirt/i;
const paved = (r) => r.surface === "Paved";
const unpaved = (r) => UNPAVED.test(r.surface || "");
const bikePath = (r) => r.type === "Bike path";

/**
 * The bookable types. `guides` are the type guides each page draws on (the
 * first is the main one); `rank` orders a town's mapped routes for that bike.
 */
export const CITY_TYPES = [
  {
    key: "fat-tire",
    slug: "fat-tire-electric-bike-rentals",
    name: "Fat Tire Electric Bike Rentals",
    short: "fat-tire e-bike",
    shortPlural: "fat-tire e-bikes",
    label: "Fat-Tire",
    style: "fat-tire",
    guides: ["fat-tire-electric-bikes"],
    rank: (a, b) => unpaved(b) - unpaved(a) || b.miles - a.miles,
  },
  {
    key: "beach-cruiser",
    slug: "beach-cruiser-rentals",
    name: "Beach Cruiser Rentals",
    short: "beach cruiser",
    shortPlural: "beach cruisers",
    label: "Beach Cruiser",
    style: "cruiser",
    pedalToo: true,
    guides: ["beach-cruiser", "cruiser-electric-bikes"],
    rank: (a, b) => paved(b) - paved(a) || b.miles - a.miles,
  },
  {
    key: "step-through",
    slug: "step-through-electric-bike-rentals",
    name: "Step-Through Electric Bike Rentals",
    short: "step-through e-bike",
    shortPlural: "step-through e-bikes",
    label: "Step-Through",
    style: "step-through",
    guides: ["step-through-electric-bikes"],
    rank: (a, b) => paved(b) + bikePath(b) - (paved(a) + bikePath(a)) || b.miles - a.miles,
  },
  {
    key: "cargo",
    slug: "cargo-electric-bike-rentals",
    name: "Cargo Electric Bike Rentals",
    short: "cargo e-bike",
    shortPlural: "cargo e-bikes",
    label: "Cargo",
    style: "cargo",
    guides: ["cargo-electric-bikes"],
    rank: (a, b) => bikePath(b) - bikePath(a) || paved(b) - paved(a) || b.miles - a.miles,
  },
  {
    key: "commuter",
    slug: "commuter-electric-bike-rentals",
    name: "Commuter Electric Bike Rentals",
    short: "commuter e-bike",
    shortPlural: "commuter e-bikes",
    label: "Commuter",
    style: "hybrid",
    guides: ["commuter-electric-bikes"],
    rank: (a, b) => paved(b) - paved(a) || b.miles - a.miles,
  },
];

const an = (word) => (/^[aeiou]/i.test(word) ? "an" : "a");

/** "Fat Tire Electric Bike Rentals Near Sarasota, Florida", kept within 70 characters. */
export function cityTypeTitle(type, city) {
  const long = `${type.name} Near ${city.name}, Florida`;
  return long.length <= 70 ? long : `${type.name} Near ${city.name}, FL`;
}

/** Shops whose own public profile names the type (the same test the type guides use). */
function naming(guides, listings) {
  const res = guides.filter((g) => g.match).map((g) => new RegExp(g.match, "i"));
  const styles = new Set(guides.map((g) => g.style));
  return listings.filter((l) => {
    if ((l.bikeTypes || []).some((t) => t.source === "owner" && styles.has(t.style))) return true;
    const text = [l.name, l.description, l.subtypes, l.category, l.type].filter(Boolean).join(" ");
    return res.some((re) => re.test(text));
  });
}

/**
 * Every town + type page. A town gets pages when it has at least one rental
 * shop. A page is offered to search engines only when it has substance of its
 * own: three or more rental shops, plus mapped routes, a shop that names the
 * type, or at least two e-bike rental shops.
 */
export function cityTypePages(index, hubEntries, cityGuides) {
  const guidesBySlug = new Map((hubEntries[TYPES_HUB] || []).map((e) => [e.slug, e]));
  const trailBySlug = new Map(cityGuides.map((g) => [g.city.slug, g]));
  const out = [];
  for (const city of index.cities) {
    const rentals = city.listings.filter((l) => l.is_rental);
    if (!rentals.length) continue;
    const ebike = rentals.filter((l) => l.is_ebike);
    const trail = trailBySlug.get(city.slug) || null;
    for (const type of CITY_TYPES) {
      const guides = type.guides.map((s) => guidesBySlug.get(s)).filter(Boolean);
      if (!guides.length) continue;
      const named = naming(guides, rentals);
      const namedSet = new Set(named.map((l) => l.slug));
      // Shops that name the type, then e-bike shops (beach cruisers: every rental shop), each by our ranking.
      const shops = [...rentals].sort(
        (a, b) =>
          namedSet.has(b.slug) - namedSet.has(a.slug) ||
          (type.pedalToo ? 0 : Boolean(b.is_ebike) - Boolean(a.is_ebike)) ||
          b.score - a.score
      );
      out.push({
        city,
        type,
        guides,
        guide: guides[0],
        url: `${city.url}${type.slug}/`,
        title: cityTypeTitle(type, city),
        rentals,
        ebike,
        named,
        shops,
        trail,
        indexable: rentals.length >= 3 && (Boolean(trail) || named.length > 0 || ebike.length >= 2),
      });
    }
  }
  return out;
}

/** Route facts for the "where to ride" section and the fit FAQ. */
function routeFacts(p) {
  const { trail, type, city } = p;
  if (!trail) return null;
  const routes = [...trail.data.routes].sort(type.rank);
  const m = routes.length;
  const nPaved = routes.filter(paved).length;
  const nUnpaved = routes.filter(unpaved).length;
  const nBike = routes.filter(bikePath).length;
  const longest = [...routes].sort((a, b) => b.miles - a.miles)[0];
  const top = routes.slice(0, 6);
  const name = esc(city.name);
  let text;
  if (type.key === "fat-tire") {
    const rough = routes.filter(unpaved);
    text = rough.length
      ? `${nUnpaved} of the ${m} mapped bike routes around ${name} ${nUnpaved === 1 ? "is" : "are"} unpaved: ${esc(
          commaList(rough.slice(0, 3).map((r) => `${r.name} (${r.surface.toLowerCase()})`))
        )}. That is where wide tires earn their keep, and they also help at sandy beach access points.`
      : `All ${m} mapped bike routes around ${name} are paved or have no surface recorded, so here a fat-tire e-bike is a comfort choice, for the soft ride and for sand at beach access points, rather than a must.`;
  } else if (type.key === "beach-cruiser") {
    text = `Cruisers are happiest on flat pavement at an easy pace. ${nPaved} of the ${m} mapped routes around ${name} are paved, and the longest route is ${esc(
      longest.name
    )} at ${longest.miles} miles.`;
  } else if (type.key === "step-through") {
    text = `A step-through frame makes frequent stops easy, which suits paths away from traffic. Of the ${m} mapped routes around ${name}, ${nBike} ${
      nBike === 1 ? "is a dedicated bike path" : "are dedicated bike paths"
    } and ${m - nBike} ${m - nBike === 1 ? "is a shared-use path" : "are shared-use paths"} you share with walkers.`;
  } else if (type.key === "cargo") {
    text = `With a child or gear on board, choose paths separated from cars. ${nBike} of the ${m} mapped routes around ${name} ${
      nBike === 1 ? "is a dedicated bike path" : "are dedicated bike paths"
    }; a loaded cargo bike is long and heavy, so allow extra room on shared paths.`;
  } else {
    text = `Commuter e-bikes are built to cover distance. The ${m} mapped routes around ${name} add up to ${trail.data.totalMiles} miles, ${nPaved} of them paved, and the longest is ${esc(
      longest.name
    )} at ${longest.miles} miles.`;
  }
  return { routes, top, text, m };
}

function typeFaqs(p, facts) {
  const { city, type, rentals, ebike, named } = p;
  const name = city.name;
  const delivers = rentals.filter((l) => (l.tags || []).includes("Delivery available"));
  const names = (list) => esc(commaList(list.slice(0, 4).map((l) => l.name)));
  return [
    {
      q: `Where can I rent ${an(type.short)} ${type.short} in ${name}?`,
      a: named.length
        ? `<p>${names(named)} ${named.length === 1 ? "names" : "name"} ${esc(type.shortPlural)} in ${
            named.length === 1 ? "its" : "their"
          } Google profile. Fleets change, so confirm before you go, or send one booking request and we check with shops in ${esc(name)} for you.</p>`
        : `<p>None of the ${rentals.length} rental ${plural(rentals.length, "shop")} we list in ${esc(name)} names ${esc(
            type.shortPlural
          )} in ${rentals.length === 1 ? "its" : "their"} Google profile, so we won't guess which have them. ${
            ebike.length && !type.pedalToo
              ? `The e-bike shops (${names(ebike)}) are the ones to ask. `
              : ""
          }Send one booking request and we check with shops in ${esc(name)} for you.</p>`,
    },
    {
      q: `Can I rent ${an(type.short)} ${type.short} in ${name} today?`,
      a: `<p>Often, if a shop has one free. Send a booking request with today's date and the time you want to ride, and we ask shops in ${esc(
        name
      )} on your behalf. The earlier in the day you ask, the better your chances, and weekends and holidays book up first.</p>`,
    },
    facts
      ? { q: `Is ${an(type.short)} ${type.short} a good fit for riding in ${name}?`, a: `<p>${facts.text}</p>` }
      : {
          q: `Is ${an(type.short)} ${type.short} a good fit for riding in ${name}?`,
          a: `<p>${esc(p.guide.bestFor ? `${type.shortPlural[0].toUpperCase()}${type.shortPlural.slice(1)} are best for ${p.guide.bestFor.toLowerCase()}.` : "")} ${esc(
            p.guide.terrain ? `In Florida they suit ${p.guide.terrain.toLowerCase()}.` : ""
          )} Our <a href="${attr(p.guide.url)}">${esc((p.guide.shortTitle || p.guide.title).toLowerCase())} guide</a> covers the details.</p>`,
        },
    {
      q: `Do ${name} rental shops deliver?`,
      a: delivers.length
        ? `<p>${delivers.length} of the ${rentals.length} rental shops we list in ${esc(name)} ${delivers.length === 1 ? "lists" : "list"} delivery: ${names(
            delivers
          )}. Mention your address in the booking request and we ask about delivery for you.</p>`
        : `<p>None of the ${esc(name)} rental shops we list advertise delivery, though many arrange it for multi-day rentals. Mention your address in the booking request and we ask.</p>`,
    },
    {
      q: `Will I get exactly ${an(type.short)} ${type.short}?`,
      a: `<p>The style is a preference, not a guarantee. Each shop has its own fleet, so the exact style may or may not be free on your day, and the make and model are up to the shop. Your quote says what the shop has before you pay, and you can decline it.</p>`,
    },
  ];
}

export function cityTypePage(site, p, ctx) {
  const { city, type, guide, guides, rentals, ebike, named, shops, trail, url, title } = p;
  const { index, cityTypeList = [], cityLinker } = ctx;
  const scene = sceneForRegion(city.regionSlug);
  const crumbs = [
    { href: "/", label: "Home" },
    { href: "/cities/", label: "Cities" },
    { href: city.url, label: city.name },
    { href: url, label: type.label },
  ];
  const facts = routeFacts(p);
  const faqs = typeFaqs(p, facts);
  const siblings = cityTypeList.filter((x) => x.city.slug === city.slug && x.type.key !== type.key);
  const sameType = cityTypeList.filter((x) => x.type.key === type.key && x.city.slug !== city.slug);
  const sameTypeSlugs = new Set(sameType.map((x) => x.city.slug));
  const near = nearbyCities(city, index.cities.filter((c) => sameTypeSlugs.has(c.slug)), 8)
    .map((c) => sameType.find((x) => x.city.slug === c.slug))
    .filter(Boolean);
  const listed = shops.slice(0, 10);
  const lead = `Want ${an(type.short)} ${type.short} in ${city.name}? Send one request and we handle the rest: we ask ${city.name}'s rental shops for you, find one with ${an(
    type.short
  )} ${type.short} free on your day, and book it on your behalf. ${rentals.length} rental ${plural(rentals.length, "shop")} in ${city.name}${
    ebike.length && !type.pedalToo ? `, ${ebike.length} of them e-bike ${plural(ebike.length, "shop")}` : ""
  }.`;

  const body = `
${findHero({
  crumbs,
  h1: title,
  lead,
  scene,
  index,
  current: city.url,
  form: quickRent(index, {
    style: type.style,
    town: city.slug,
    heading: `Book ${an(type.short)} ${type.short} in ${city.name}`,
  }),
})}

<section class="section">
  <div class="wrap">
    <h2>${esc(city.name)} shops to ask for ${esc(type.shortPlural)}</h2>
    <p class="muted">${
      named.length
        ? `${esc(commaList(named.slice(0, 4).map((l) => l.name)))} ${named.length === 1 ? "names" : "name"} ${esc(type.shortPlural)} in ${
            named.length === 1 ? "its" : "their"
          } own Google profile and ${named.length === 1 ? "is" : "are"} listed first. `
        : `No ${esc(city.name)} shop names ${esc(type.shortPlural)} in its Google profile, so we don't claim which shops have them. `
    }${
      type.pedalToo
        ? `These are the ${esc(city.name)} shops that rent bikes, ranked by Google rating and review count. Cruisers are a beach-town staple, with pedals only or with a motor.`
        : `${ebike.length ? "E-bike shops come next, then the other rental shops," : "These are the shops that rent bikes,"} ranked by Google rating and review count.`
    } Fleets change, so confirm before you go, or book through us and we check for you.</p>
    ${listicle(listed)}
    <p class="mt-2"><a class="btn btn--outline" href="${attr(city.url)}">All ${city.listings.length} shops in ${esc(city.name)}</a></p>
  </div>
</section>

${
  facts
    ? `<section class="section section--tint">
  <div class="wrap wrap-narrow">
    <h2>Where to ride ${an(type.short)} ${esc(type.short)} in ${esc(city.name)}</h2>
    <p>${facts.text}</p>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th scope="col">Route</th><th scope="col">Miles</th><th scope="col">Surface</th><th scope="col">Type</th></tr></thead>
      <tbody>${facts.top
        .map((r) => `<tr><th scope="row">${esc(r.name)}</th><td>${esc(String(r.miles))}</td><td>${esc(r.surface)}</td><td>${esc(r.type)}</td></tr>`)
        .join("")}</tbody>
    </table></div>
    <p class="small muted">Routes and surfaces from OpenStreetMap. See all ${facts.m} on our <a href="${attr(
      trail.url
    )}">${esc(trail.title)}</a> guide.</p>
  </div>
</section>`
    : ""
}

<section class="section">
  <div class="wrap">
    <div class="grid grid--2 find-guide">
      <div class="prose">
        <h2>What is ${an(type.short)} ${esc(type.short)}?</h2>
        <p>${esc(guide.summary || guide.description)}</p>
        <ul>
          ${guide.bestFor ? `<li><strong>Best for:</strong> ${esc(guide.bestFor)}</li>` : ""}
          ${guide.weight ? `<li><strong>Typical weight:</strong> ${esc(guide.weight)}</li>` : ""}
          ${guide.terrain ? `<li><strong>Florida terrain:</strong> ${esc(guide.terrain)}</li>` : ""}
        </ul>
        <p>Read the full ${guides
          .map((g) => `<a href="${attr(g.url)}">${esc((g.shortTitle || g.title).toLowerCase())} guide</a>`)
          .join(" and the ")}, or compare every style in our <a href="/electric-bike-types/">guide to the types of electric bikes</a>.</p>
      </div>
      <div>
        <figure class="type-diagram">${bikeIcon(guide.style)}<figcaption>The typical shape of ${esc(
          guide.diagramCaption || type.short
        )}.</figcaption></figure>
        ${guide.image ? sitePhoto(guide.image, { className: "type-photo" }) : figure(secondPhotoFor(`${city.slug}-${type.key}`), { alt: secondPhotoFor(`${city.slug}-${type.key}`).alt })}
      </div>
    </div>
  </div>
</section>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap wrap-narrow">
    <h2>${esc(type.name)} in ${esc(city.name)}: FAQs</h2>
    ${faqBlock(faqs)}
  </div>
</section>

${
  siblings.length
    ? `<section class="section">
  <div class="wrap">
    <h2>Other bike types in ${esc(city.name)}</h2>
    ${typeTiles(siblings)}
  </div>
</section>`
    : ""
}

${
  near.length
    ? `<section class="section section--tint">
  <div class="wrap">
    <h2>${esc(type.name)} near ${esc(city.name)}</h2>
    ${linkCloud(near.map((x) => ({ href: x.url, label: `${x.city.name} ${type.short} rentals`, count: x.rentals.length })))}
  </div>
</section>`
    : ""
}

${cityLinker ? cityLinker.section(city, { title: `More about ${city.name}`, current: url }) : ""}
${adSlotScript(site, 1)}
`;

  return page(site, {
    title,
    description: clamp(
      `Book ${an(type.short)} ${type.short} in ${city.name}, FL: one request and we find a shop with one free and book it for you. ${rentals.length} rental ${plural(
        rentals.length,
        "shop"
      )} compared${named.length ? `, ${named.length} naming ${type.shortPlural}` : ""}.`,
      160
    ),
    path: url,
    noindex: !p.indexable,
    body,
    ogImage: shops[0] && shops[0].photo ? shops[0].photo : scene.og,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [breadcrumbSchema(site, crumbs), faqSchema(faqs), itemListSchema(site, listed, { name: `${type.name} near ${city.name}, Florida`, url })],
  });
}

/** Tiles linking a town's type pages: diagram, type name, shop count. */
export function typeTiles(list) {
  return `<div class="type-town-tiles">${list
    .map(
      (x) => `<a class="type-town-tile" href="${attr(x.url)}">
      <span class="type-town-tile__art" aria-hidden="true">${bikeIcon(x.type.style)}</span>
      <span class="type-town-tile__name">${esc(x.type.name)}</span>
      <span class="type-town-tile__meta">in ${esc(x.city.name)}</span>
    </a>`
    )
    .join("")}</div>`;
}

/** Links from a type guide to its town pages, busiest towns first. */
export function typeTownCloud(list, guideSlug) {
  const mine = list
    .filter((x) => x.indexable && x.type.guides.includes(guideSlug))
    .sort((a, b) => b.rentals.length - a.rentals.length || a.city.name.localeCompare(b.city.name));
  if (!mine.length) return "";
  const type = mine[0].type;
  return `<section class="section">
  <div class="wrap">
    <h2>${esc(type.name)} by town</h2>
    <p class="muted">Pick your town to see local shops, where to ride and a booking form set to ${esc(type.shortPlural)}.</p>
    ${linkCloud(mine.map((x) => ({ href: x.url, label: `${type.short[0].toUpperCase()}${type.short.slice(1)} rentals in ${x.city.name}`, count: x.rentals.length })))}
  </div>
</section>`;
}

/** Town x type grid for the types hub: one row per town, one link per type. */
export function typeTownTable(list) {
  const towns = new Map();
  for (const x of list.filter((x) => x.indexable)) {
    if (!towns.has(x.city.slug)) towns.set(x.city.slug, { city: x.city, byType: new Map(), n: x.rentals.length });
    towns.get(x.city.slug).byType.set(x.type.key, x);
  }
  const rows = [...towns.values()].sort((a, b) => b.n - a.n || a.city.name.localeCompare(b.city.name));
  if (!rows.length) return "";
  return `<section class="section section--tint">
  <div class="wrap">
    <h2>Rent by type and town</h2>
    <p class="muted">Each link opens that town's page for that type of bike, with local shops, routes and a booking form.</p>
    <div class="table-wrap"><table class="data-table type-town-table">
      <thead><tr><th scope="col">Town</th>${CITY_TYPES.map((t) => `<th scope="col">${esc(t.label)}</th>`).join("")}</tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr><th scope="row"><a href="${attr(r.city.url)}">${esc(r.city.name)}</a></th>${CITY_TYPES.map((t) => {
            const x = r.byType.get(t.key);
            return `<td>${x ? `<a href="${attr(x.url)}" aria-label="${attr(x.title)}">${esc(t.label)}</a>` : ""}</td>`;
          }).join("")}</tr>`
        )
        .join("")}</tbody>
    </table></div>
  </div>
</section>`;
}
