/**
 * /find/ebike-rentals-near-me/
 *
 * Built for the largest non-brand query cluster in Search Console: 597
 * impressions across 127 "near me" variants in 90 days, average position 12.3,
 * four clicks, and no page on the site targeting the intent. Google was
 * answering them with whichever city listicle it could find, so the page it
 * wanted did not exist.
 *
 * The behaviour is the one already on /partners/: the browser asks for a
 * location, sorts the list by distance and labels each shop with how far it is.
 * Nothing about the visitor is sent anywhere -- the maths happens on their
 * device -- and the page is a complete, useful ranking before any of that runs,
 * which is also what Google indexes.
 */
import { esc, attr, formatReviews, plural, clamp } from "../util.mjs";
import { page, breadcrumbSchema } from "../layout.mjs";
import {
  listicle, faqBlock, faqSchema, linkCard, linkCloud,
  adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema,
} from "../components.mjs";
import { photoFor, secondPhotoFor, figure } from "../images.mjs";
import { tagsIn } from "./find.mjs";
import { findHero, resultsHead } from "../find-hero.mjs";

import { NEAR_ME_URL } from "../find-hero.mjs";
export { NEAR_ME_URL };

const HOME_CRUMB = { href: "/", label: "Home" };
const FIND_CRUMB = { href: "/find/", label: "Find" };

/**
 * The shops this page can offer someone standing anywhere in Florida.
 *
 * Taking the top N statewide would cluster in Miami and Orlando, and a visitor
 * in the Panhandle would be told the nearest rental is fifty miles away. Even
 * spreading by region is too coarse: one region covers both 30A and Pensacola,
 * two hours apart. So the spread is by town — the best shop in each of the
 * busiest towns first, which puts a genuinely close option within reach of most
 * of the state — and the remaining slots go to the highest scoring shops left,
 * which is what someone who declines location sees.
 */
export function spreadForNearMe(index, towns = 42, total = 60) {
  const picked = [];
  const seen = new Set();

  const mapped = (list) => list.filter((l) => typeof l.lat === "number");

  for (const city of index.cities.slice(0, towns)) {
    const best = mapped(city.listings)[0];
    if (!best || seen.has(best.slug)) continue;
    seen.add(best.slug);
    picked.push(best);
  }

  const rest = index.cities
    .flatMap((c) => mapped(c.listings))
    .filter((l) => !seen.has(l.slug))
    .sort((a, b) => b.score - a.score);

  for (const listing of rest) {
    if (picked.length >= total) break;
    seen.add(listing.slug);
    picked.push(listing);
  }

  return picked.sort((a, b) => b.score - a.score).slice(0, total);
}

export function nearMePage(site, ctx) {
  const { index, stats } = ctx;
  const shown = spreadForNearMe(index);
  const crumbs = [HOME_CRUMB, FIND_CRUMB, { href: NEAR_ME_URL, label: "E-bike rentals near me" }];
  const cities = [...new Set(shown.map((l) => l.city))].sort();
  const hero = photoFor("ebike-rentals-near-me");
  const extra = secondPhotoFor("ebike-rentals-near-me");
  const topCities = index.cities.slice(0, 30);

  const faqs = [
    {
      q: "How does this page find e-bike rentals near me?",
      a: `<p>Your browser asks whether you want to share your location. If you allow it, the list
      re-sorts so the closest shop is first and each one is labelled with how many miles away it is.
      The calculation happens on your own device — your location is never sent to us or to anyone
      else, and nothing is stored.</p>`,
    },
    {
      q: "What if I do not want to share my location?",
      a: `<p>Nothing breaks. The list stays in our statewide ranking, which weighs each shop's Google
      star rating against how many reviews it has, so a 4.9 from 800 riders outranks a 5.0 from
      three. You can also jump straight to your town in the list of ${esc(
        String(index.cities.length)
      )} Florida towns further down this page.</p>`,
    },
    {
      q: "How close is the nearest e-bike rental likely to be?",
      a: `<p>It depends where you are. ${esc(String(stats.total))} shops across ${esc(
        String(stats.cities)
      )} towns means the beach towns and city centres usually have something within a few miles,
      while inland and rural areas can be a longer drive. The distance badge tells you before you
      call, and many shops deliver — see <a href="/find/ebike-rentals-with-delivery-in-florida/">shops
      that bring the bikes to you</a>.</p>`,
    },
    {
      q: "Can I book an e-bike through this page?",
      a: `<p>No, and that is deliberate. We are a directory, not a booking agent: you get the phone
      number, the address and the hours, and you book direct with the shop, usually at a better rate
      than any middleman offers. If you would rather book a guided ride in advance,
      <a href="/tours/">the tours page</a> lists bookable experiences.</p>`,
    },
    {
      q: "What does it cost to rent an e-bike in Florida?",
      a: `<p>Most shops charge somewhere between a half-day and a full-day rate, with multi-day and
      weekly rates dropping the daily price considerably. Deposits, card holds and damage waivers
      vary more than the headline rate does — <a href="/costs/">what it costs</a> breaks all of that
      down before you hand over a card.</p>`,
    },
  ];

  const body = `
${findHero({
  crumbs,
  h1: "E-Bike Rentals Near Me",
  lead: `Allow location and every shop is sorted by how far it is from you, closest first. ${stats.total} rental shops across ${stats.cities} Florida towns. Your location stays in your browser — we never receive it.`,
  scene: hero,
  index,
  current: NEAR_ME_URL,
  tags: tagsIn(shown),
  placeholder: "Shop, town or service",
})}

<section class="section section--results">
  <div class="wrap" data-nearby-sort>
    <div class="nearby-bar">
      <p data-nearby-status>Allow location and this list re-sorts to the e-bike rentals closest to you.</p>
      <button class="btn btn--blue btn--sm" type="button" data-nearby-button>Find rentals near me</button>
      <span class="muted small">Your location is used in your browser to work out distances and is never sent anywhere.</span>
    </div>
    ${resultsHead(`${shown.length} shops across every part of Florida`, shown.length, "shops")}
    <p class="muted">This list deliberately covers all ${esc(
      String(index.regions.length)
    )} regions rather than only the highest rated shops in the biggest cities, so there is something
    genuinely close wherever you are standing.</p>
    ${listicle(shown)}
    <p class="mt-2"><a class="btn btn--blue" href="/partners/">Browse all ${esc(
      String(stats.total)
    )} rental partners</a></p>
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <div class="grid grid--2" style="align-items:center">
      ${figure(extra, { alt: `Riding a rented e-bike in Florida - ${extra.alt}` })}
      <div>
        <h2>Prefer to search by town?</h2>
        <p>Location sorting is the fastest way in when you are already somewhere. If you are planning
        a trip instead, the town pages are the better starting point — each one lists every shop in
        that town with hours, phone numbers and what they rent.</p>
        <p>Every listing here is a real business pulled from public Google Maps data, refreshed
        periodically. We do not take bookings or commission on rentals: you call the shop direct.</p>
        <p><a class="btn btn--outline" href="/find/">All ${esc(
          String(index.cities.length)
        )} Florida towns</a></p>
      </div>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>E-bike rentals by town</h2>
    ${linkCloud(
      topCities.map((city) => ({
        href: city.url,
        label: `${city.name} e-bike rentals`,
        count: city.listings.length,
      }))
    )}
    <h3 class="mt-3">By region</h3>
    ${linkCloud(index.regions.map((r) => ({ href: r.url, label: r.name, count: r.listings.length })))}
    <div class="grid grid--3 mt-3">
      ${linkCard({
        href: "/find/ebike-rentals-with-delivery-in-florida/",
        title: "Shops that deliver",
        text: "Have the bikes brought to your hotel, condo or rental house instead of collecting them.",
        more: "See who delivers",
      })}
      ${linkCard({
        href: "/costs/",
        title: "What it costs",
        text: "Day rates, weekly rates, deposits, card holds and damage waivers, compared.",
        more: "See the costs",
      })}
      ${linkCard({
        href: "/trails/",
        title: "Where to ride",
        text: "Trail guides with distances, surfaces and route maps for when you have the bike.",
        more: "Browse trails",
      })}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap wrap-narrow">
    <h2>Questions about finding a rental near you</h2>
    ${faqBlock(faqs)}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `E-Bike Rentals Near Me - ${stats.total} Florida Shops by Distance`,
    description: clamp(
      `Find e-bike rentals near you in Florida. Allow location and this page sorts ${stats.total} rental shops across ${stats.cities} towns by distance, closest first, with ratings and phone numbers.`,
      170
    ),
    path: NEAR_ME_URL,
    body,
    ogImage: hero.src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      itemListSchema(site, shown, { name: "E-bike rentals near you in Florida", url: NEAR_ME_URL }),
    ],
  });
}
