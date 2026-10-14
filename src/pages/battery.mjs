/**
 * /find/battery-replacement/ — where to get an e-bike battery replaced.
 *
 * Built only from what each business's Google profile records. Two tiers:
 *   1. Battery specialists: listed by Google as a "Battery store".
 *   2. E-bike stores that also list repair (bicycle or electric motor repair).
 *      Their profiles do not mention batteries, and the page says so: we do
 *      not claim a service a shop has not listed.
 */
import { esc, attr, plural, clamp } from "../util.mjs";
import { page, breadcrumbSchema } from "../layout.mjs";
import { listicle, faqBlock, faqSchema, itemListSchema, adSlot, adSlotScript, ADSENSE_INLINE } from "../components.mjs";
import { photoFor, secondPhotoFor, figure } from "../images.mjs";
import { findHero, resultsHead } from "../find-hero.mjs";
import { tagsIn } from "./find.mjs";

export const BATTERY_URL = "/find/battery-replacement/";

const subtypes = (l) => [].concat(l.subtypes || []).map(String);

export function batteryShops(listings) {
  const specialists = listings.filter((l) => subtypes(l).includes("Battery store"));
  const repairers = listings.filter(
    (l) =>
      !specialists.includes(l) &&
      subtypes(l).includes("Electric bicycle store") &&
      (subtypes(l).includes("Bicycle repair shop") || subtypes(l).includes("Electric motor repair shop"))
  );
  const byScore = (a, b) => b.score - a.score;
  return { specialists: specialists.sort(byScore), repairers: repairers.sort(byScore) };
}

export function batteryPage(site, { listings, index }) {
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
      a: `<p>Call before you go. The ${specialists.length} specialists at the top of this page are listed on Google as battery stores. The other ${repairers.length} shops sell and repair electric bikes, but their profiles do not mention batteries, so we cannot promise they replace them. Ask whether they stock or can order your battery, and whether they fit it.</p>`,
    },
    {
      q: "What should I have ready when I call?",
      a: "<p>The make and model of your bike, and the label on the battery itself, which usually shows the voltage, capacity and a model number. Batteries are often specific to a brand and frame, so a shop needs those details to tell you whether it can supply one that fits.</p>",
    },
    {
      q: "Is a rental bike's battery my problem?",
      a: `<p>No. If a rented e-bike's battery fails, call the rental shop: the bike and its battery are theirs to swap. Our <a href="/cities/">town pages</a> list every rental shop's phone number.</p>`,
    },
  ];

  const body = `
${findHero({
  crumbs,
  h1: "Ebike Battery Replacement",
  lead: `We list ${all.length} Florida shops in ${towns} towns to call about an e-bike battery: ${specialists.length} battery specialists, and ${repairers.length} e-bike stores that also do repairs. Search by town or shop name.`,
  scene,
  index,
  current: "/find/",
  tags: tagsIn(all),
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
      profile. Battery replacement is not listed, so call to confirm before you go.</p>
      ${listicle(repairers, { start: specialists.length + 1 })}
    </div>
  </div>
</section>

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
      `Ebike battery replacement in Florida: ${specialists.length} battery specialists and ${repairers.length} e-bike repair shops in ${towns} towns, with ratings, hours and phone numbers.`,
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
