/**
 * /find/battery-replacement/ — where to get an e-bike battery replaced.
 *
 * Built only from what each business's Google profile records. Two tiers:
 *   1. Battery specialists: listed by Google as a "Battery store".
 *   2. E-bike stores that also list repair (bicycle or electric motor repair).
 *      Their profiles do not mention batteries, and the page says so: we do
 *      not claim a service a shop has not listed.
 */
import { facetPanel } from "../facets.mjs";
import { esc, attr, plural, clamp, miles, formatReviews } from "../util.mjs";
import { page, breadcrumbSchema } from "../layout.mjs";
import { listicle, faqBlock, faqSchema, itemListSchema, adSlot, adSlotScript, ADSENSE_INLINE } from "../components.mjs";
import { photoFor, secondPhotoFor, figure, sceneForRegion } from "../images.mjs";
import { findHero, resultsHead } from "../find-hero.mjs";
import { tagsIn } from "./find.mjs";

export const BATTERY_URL = "/find/battery-replacement/";

const subtypes = (l) => [].concat(l.subtypes || []).map(String);

export function batteryShops(listings) {
  const specialists = listings.filter((l) => !l.no_battery_repair && subtypes(l).includes("Battery store"));
  const repairers = listings.filter(
    (l) =>
      !l.no_battery_repair &&
      !specialists.includes(l) &&
      subtypes(l).includes("Electric bicycle store") &&
      (subtypes(l).includes("Bicycle repair shop") || subtypes(l).includes("Electric motor repair shop"))
  );
  const byScore = (a, b) => b.score - a.score;
  return { specialists: specialists.sort(byScore), repairers: repairers.sort(byScore) };
}

/** Shops further than this from a town centre are not "near" it. */
const NEARBY_MILES = 15;
/** A town page needs this many qualifying shops in the town itself, and this many to be indexed. */
const MIN_LOCAL = 2;
const MIN_INDEX = 3;

/**
 * Town pages, only where they make sense: at least MIN_LOCAL qualifying shops
 * in the town itself. Each also lists qualifying shops within NEARBY_MILES of
 * the town centre, with the straight-line distance.
 */
export function batteryTowns(listings, index) {
  const { specialists, repairers } = batteryShops(listings);
  const all = [...specialists, ...repairers];
  const isSpecialist = new Set(specialists.map((l) => l.slug));
  return index.cities
    .map((city) => {
      const local = all.filter((l) => l.citySlug === city.slug).sort((a, b) => isSpecialist.has(b.slug) - isSpecialist.has(a.slug) || b.score - a.score);
      if (local.length < MIN_LOCAL || typeof city.lat !== "number") return null;
      const nearby = all
        .filter((l) => l.citySlug !== city.slug && typeof l.lat === "number")
        .map((l) => ({ ...l, distance: miles(city.lat, city.lng, l.lat, l.lng) }))
        .filter((l) => l.distance <= NEARBY_MILES)
        .sort((a, b) => a.distance - b.distance);
      return { city, local, nearby, url: `${BATTERY_URL}${city.slug}/`, isSpecialist };
    })
    .filter(Boolean)
    .sort((a, b) => b.local.length - a.local.length || a.city.name.localeCompare(b.city.name));
}

export function batteryTownPage(site, town, { index, batteryTownList, cityLinker }) {
  const { city, local, nearby, url, isSpecialist } = town;
  const n = local.length;
  const title = `Ebike Battery Replacement Near Me In ${city.name}`;
  const crumbs = [
    { href: "/", label: "Home" },
    { href: "/find/", label: "Find" },
    { href: BATTERY_URL, label: "Battery replacement" },
    { href: url, label: city.name },
  ];
  const specialistsHere = local.filter((l) => isSpecialist.has(l.slug));
  const best = local[0];
  const others = batteryTownList.filter((t) => t.city.slug !== city.slug);
  const sameRegion = others.filter((t) => t.city.regionSlug === city.regionSlug);

  const body = `
${findHero({
  crumbs,
  h1: title,
  lead: `We list ${n} shops in ${city.name} for an e-bike battery${
    specialistsHere.length ? `, including ${specialistsHere.length === 1 ? "a battery specialist" : `${specialistsHere.length} battery specialists`}` : ""
  }${nearby.length ? `, and ${nearby.length} more within ${NEARBY_MILES} miles` : ""}. ${best.name} leads our ranking${
    best.rating ? ` with ${best.rating.toFixed(1)} stars from ${formatReviews(best.reviews)} Google reviews` : ""
  }.`,
  scene: sceneForRegion(city.regionSlug),
  index,
  current: "/find/",
  tags: tagsIn([...local, ...nearby]),
  facets: facetPanel([...local, ...nearby]),
  placeholder: `Search ${city.name} shops`,
})}

<section class="section section--results">
  <div class="wrap">
    ${resultsHead(`In ${city.name}`, n, "shops")}
    <p class="muted">${
      specialistsHere.length
        ? `${specialistsHere.map((l) => esc(l.name)).join(" and ")} ${specialistsHere.length === 1 ? "is" : "are"} listed by Google as a battery store. `
        : ""
    }${specialistsHere.length < n ? "The others sell and repair e-bikes, but battery replacement is not listed on their profiles, so confirm before you go." : ""}</p>
    ${listicle(local)}
    ${
      nearby.length
        ? `<div class="mt-3">
      <h2>Within ${NEARBY_MILES} miles of ${esc(city.name)}</h2>
      <p class="muted">Distances are straight-line from the centre of ${esc(city.name)}. Driving distance will be longer.</p>
      <ul class="pagelink-cloud">${nearby
        .map((l) => `<li><a href="${attr(l.url)}">${esc(l.name)}, ${esc(l.city)} <span class="count">${l.distance.toFixed(1)} mi</span></a></li>`)
        .join("")}</ul>
    </div>`
        : ""
    }
  </div>
</section>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap wrap-narrow prose">
    <h2>Before you go</h2>
    <p>Have your bike's make and model ready, and the label on the battery, which usually shows the voltage,
    capacity and a model number. Batteries are often specific to a brand and frame, so the shop needs those details
    to tell you whether it can supply one that fits. If the bike is a rental, call the rental shop instead: the
    battery is theirs to swap.</p>
    <p>We list a shop here only for what its Google profile records. Know a ${esc(city.name)} shop that replaces
    batteries and is missing? <a href="/contact/">Tell us</a>.</p>
    <p><a href="${BATTERY_URL}">All Florida battery replacement shops</a> · <a href="${attr(city.url)}">All ${esc(city.name)} e-bike rentals</a></p>
  </div>
</section>

${
  sameRegion.length || others.length
    ? `<section class="section">
  <div class="wrap">
    <h2>Battery replacement in other towns</h2>
    <ul class="pagelink-cloud">${(sameRegion.length ? sameRegion : others)
      .slice(0, 12)
      .map((t) => `<li><a href="${attr(t.url)}">${esc(t.city.name)} <span class="count">${t.local.length}</span></a></li>`)
      .join("")}</ul>
  </div>
</section>`
    : ""
}
${cityLinker ? cityLinker.section(city, { title: `More about ${city.name}`, current: url, tint: true }) : ""}
${adSlotScript(site, 1)}
`;

  return page(site, {
    title,
    description: clamp(
      `Ebike battery replacement in ${city.name}, FL: ${n} shops${nearby.length ? ` plus ${nearby.length} within ${NEARBY_MILES} miles` : ""}. ${best.name} leads${
        best.rating ? ` (${best.rating.toFixed(1)} stars)` : ""
      }. Hours, ratings and directions.`,
      160
    ),
    path: url,
    noindex: n < MIN_INDEX,
    body,
    ogImage: sceneForRegion(city.regionSlug).og,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [breadcrumbSchema(site, crumbs), itemListSchema(site, local, { name: title, url })],
  });
}

export function batteryPage(site, { listings, index, batteryTownList = [] }) {
  const { specialists, repairers } = batteryShops(listings);
  const all = [...specialists, ...repairers];
  const towns = new Set(all.map((l) => l.city)).size;
  const crumbs = [
    { href: "/", label: "Home" },
    { href: "/find/", label: "Find" },
    { href: BATTERY_URL, label: "Battery replacement" },
  ];
  const scene = photoFor("battery-replacement");
  const extra = secondPhotoFor("battery-replacement");

  const faqs = [
    {
      q: "How do I know a shop can replace my e-bike battery?",
      a: `<p>Check before you go. The ${specialists.length} specialists at the top of this page are listed on Google as battery stores. The other ${repairers.length} shops sell and repair electric bikes, but their profiles do not mention batteries, so we cannot promise they replace them. Ask whether they stock or can order your battery, and whether they fit it. You can also call our rental line on (305) 363-1922.</p>`,
    },
    {
      q: "What should I have ready?",
      a: "<p>Take the make and model of your bike, and the label on the battery itself, which usually shows the voltage, capacity and a model number. Batteries are often specific to a brand and frame, so a shop needs those details to tell you whether it can supply one that fits.</p>",
    },
    {
      q: "Is a rental bike's battery my problem?",
      a: `<p>No. If a rented e-bike's battery fails, contact the shop you rented from: the bike and its battery are theirs to swap.</p>`,
    },
  ];

  const body = `
${findHero({
  crumbs,
  h1: "Ebike Battery Replacement",
  lead: `We list ${all.length} Florida shops in ${towns} towns for an e-bike battery: ${specialists.length} battery specialists, and ${repairers.length} e-bike stores that also do repairs. Search by town or shop name.`,
  scene,
  index,
  current: "/find/",
  tags: tagsIn(all),
  facets: facetPanel(all),
  placeholder: "Town or shop name",
})}

<section class="section section--results">
  <div class="wrap">
    ${resultsHead("Battery specialists", specialists.length, "shops")}
    <p class="muted">Google lists these businesses as battery stores as well as e-bike shops.</p>
    ${listicle(specialists)}

    <div class="mt-3">
      <h2>E-bike stores that also do repairs</h2>
      <p class="muted">These shops sell electric bikes and list bicycle or electric motor repair on their Google
      profile. Battery replacement is not listed, so confirm before you go.</p>
      ${listicle(repairers, { start: specialists.length + 1 })}
    </div>
  </div>
</section>

${
  batteryTownList.length
    ? `<section class="section section--tint">
  <div class="wrap">
    <h2>Battery replacement by town</h2>
    <p class="muted">Towns with at least two shops.</p>
    <ul class="pagelink-cloud">${batteryTownList
      .map((t) => `<li><a href="${attr(t.url)}">${esc(t.city.name)} <span class="count">${t.local.length}</span></a></li>`)
      .join("")}</ul>
  </div>
</section>`
    : ""
}

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap grid grid--2 find-guide">
    ${figure(extra, { alt: extra.alt })}
    <div class="prose">
      <h2>How we built this list</h2>
      <p>We only list a shop for a service its public Google profile records. Battery replacement is rarely
      listed as its own service, so we split the page: businesses Google classes as battery stores first, then
      e-bike stores that list repair work. We rank each group by Google rating weighted against review count.</p>
      <p>Spot a shop that replaces batteries and is missing here, or one that does not? <a href="/contact/">Tell us</a>
      and we will fix it.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap wrap-narrow">
    <h2>E-bike battery questions</h2>
    ${faqBlock(faqs)}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: "Ebike Battery Replacement",
    description: clamp(
      `Ebike battery replacement in Florida: ${specialists.length} battery specialists and ${repairers.length} e-bike repair shops in ${towns} towns, with ratings, hours and directions.`,
      160
    ),
    path: BATTERY_URL,
    body,
    ogImage: scene.og,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      itemListSchema(site, all, { name: "Ebike battery replacement in Florida", url: BATTERY_URL }),
    ],
  });
}
