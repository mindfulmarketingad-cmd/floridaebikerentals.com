/**
 * /cities/ and /cities/<town>/: the directory by place.
 *
 * The hub is a grid of every Florida town we list, grouped by region, with the
 * number of shops in each. A town with two or more shops has its own ranked
 * page; a town with one links straight to that shop, because a "list" of one
 * would only repeat the shop's own page.
 */
import { esc, attr, formatReviews, commaList, plural, clamp, phoneHref } from "../util.mjs";
import { page, breadcrumbSchema } from "../layout.mjs";
import {
  listicle, faqBlock, faqSchema, linkCard, adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema, photo,
} from "../components.mjs";
import { nearbyCities } from "../data.mjs";
import { secondPhotoFor, figure, sceneForRegion, photoFor, stockFor, stockImg, stockCredits } from "../images.mjs";
import { findHero, resultsHead, townCards, townGrid } from "../find-hero.mjs";
import { tagsIn, guidesFor, categoryTile } from "./find.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const YEAR = new Date().getFullYear();
export const CITIES_CRUMB = { href: "/cities/", label: "Cities" };

/* ------------------------------------------------------------ hub */

export function citiesHub(site, { index, stats }) {
  const regions = [...index.regions].sort((a, b) => a.name.localeCompare(b.name));
  const allTowns = (region) =>
    [...region.cities, ...(region.thinCities || [])].sort(
      (a, b) => b.listings.length - a.listings.length || a.name.localeCompare(b.name)
    );
  const townTotal = index.cities.length + index.thinCities.length;

  const body = `
${findHero({
  crumbs: [HOME_CRUMB, CITIES_CRUMB],
  h1: "Florida Cities With Bike & E-Bike Rentals",
  lead: `We list ${stats.total} rental shops in ${townTotal} Florida towns. Pick a town to see its shops ranked, or let us sort every shop by distance from you.`,
  scene: photoFor("cities"),
  index,
  current: "/cities/",
  filters: false,
})}

<section class="section">
  <div class="wrap">
    <nav class="region-jump" aria-label="Jump to a region">${regions
      .map((r) => `<a href="#${attr(r.slug)}">${esc(r.name)}</a>`)
      .join("")}</nav>
    ${regions
      .map(
        (region) => `<section class="city-region" id="${attr(region.slug)}">
      ${
        // Full-width banners only from photos wide enough not to be stretched.
        stockFor(region.slug) && stockFor(region.slug).width >= 1180
          ? `<div class="city-region__banner">${stockImg(stockFor(region.slug), { alt: `${region.name}, Florida`, large: true })}</div>`
          : ""
      }
      <div class="city-region__head">
        <h2>${esc(region.name)}</h2>
        <p class="muted">${region.listings.length} ${plural(region.listings.length, "shop")} in ${allTowns(region).length} ${plural(
          allTowns(region).length,
          "town"
        )}</p>
      </div>
      ${townCards(allTowns(region))}
    </section>`
      )
      .join("")}
  </div>
</section>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap wrap-narrow prose">
    ${stockCredits([
      ...regions.map((r) => stockFor(r.slug)),
      ...regions.flatMap((r) => allTowns(r).map((t) => stockFor(`town-${t.slug}`))),
    ])}
    <h2>How we build these lists</h2>
    <p>We start from public Google Maps data for bike and e-bike rental, sales and repair businesses
    across Florida. We remove businesses Google marks as closed, and anything that is clearly not a
    bike business. Each shop is placed in the town on its Google address.</p>
    <p>Within a town, we rank shops by Google star rating weighted against how many reviews the rating
    rests on, so a 4.8 from 400 riders ranks above a 5.0 from three. We don't accept payment for
    placement, and we don't take bookings: you contact the shop directly.</p>
    <p>Looking for something specific, like tours, delivery or shops open on Sundays? <a href="/find/">Browse
    by category</a>. Spotted a closed shop or a wrong phone number? <a href="/contact/">Tell us</a> and
    we will fix it.</p>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `Florida Bike Rentals by City - ${townTotal} Towns, ${stats.total} Shops`,
    description: clamp(
      `Every Florida town in our bike and e-bike rental directory, grouped by region with the number of shops in each. ${stats.total} shops across ${townTotal} towns.`
    ),
    path: "/cities/",
    body,
    ogImage: photoFor("cities").og,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, [HOME_CRUMB, CITIES_CRUMB]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Florida cities with bike and e-bike rentals",
        url: `${site.url}/cities/`,
        isPartOf: { "@id": `${site.url}/#website` },
      },
    ],
  });
}

/* ----------------------------------------------------------- city page */

/**
 * A town page. Built around what Search Console shows people typing: they
 * search "<town> bike rentals" and "e bikes <town>" far more than "e-bike
 * rentals in <town>", so that phrasing leads the title and the heading. The
 * title and search bar come first; the ranked list follows immediately; local
 * detail, FAQs and the links out to other towns come after.
 */
export function cityPage(site, city, { index, townNotes, blog = [] }) {
  const local = city.listings;
  const n = local.length;
  const notes = (townNotes && townNotes.get(city.slug)) || {};
  const fill = (text) => String(text || "").replace(/\{count\}/g, String(n));
  const near = nearbyCities(city, index.cities, 8);
  const scene = sceneForRegion(city.regionSlug);
  const crumbs = [HOME_CRUMB, CITIES_CRUMB, { href: city.url, label: city.name }];
  const best = local[0];
  const tagged = (tag) => local.filter((l) => (l.tags || []).includes(tag));
  const withDelivery = tagged("Delivery available");
  const withTours = tagged("Guided tours");
  const withScooters = tagged("Scooters");
  const withCarts = tagged("Golf carts");
  const specialists = tagged("Electric bikes");
  const openSeven = local.filter((l) => (l.hours || []).filter((h) => !h.closed).length === 7);
  const names = (list) => esc(commaList(list.slice(0, 4).map((l) => l.name)));

  // The owner's format for every town page, used for both the H1 and <title>.
  const h1 = `${city.name} Florida Electric Bike Rentals List ${YEAR}`;
  const lead = notes.lead
    ? fill(notes.lead)
    : `${n} bike and e-bike rental ${plural(n, "shop")} in ${city.name}, Florida, ranked by Google rating and review count. Search them, filter by service, and book direct with the shop.`;

  const faqs = [
    ...(notes.faqs || []),
    {
      q: `Where can I rent a bike or e-bike in ${city.name}?`,
      a: `<p>We track ${n} rental ${plural(n, "shop")} in ${esc(city.name)}. ${esc(best.name)} leads our ranking${
        best.rating ? ` with ${best.rating.toFixed(1)} stars from ${formatReviews(best.reviews)} Google reviews` : ""
      }. Every listing above shows the address, phone number and today's hours, so you can call before you go.</p>`,
    },
    specialists.length
      ? {
          q: `Where can I buy an electric bike in ${city.name}?`,
          a: `<p>Start with the e-bike specialists: ${names(specialists)}. Shops that focus on electric bikes usually sell as well as rent, and several will let a rental count towards a purchase — ask when you call.</p>`,
        }
      : null,
    withScooters.length
      ? {
          q: `Can I rent a scooter in ${city.name}?`,
          a: `<p>Yes. ${names(withScooters)} ${withScooters.length === 1 ? "lists" : "list"} scooter rentals alongside bikes. Filter the list above by "Scooters" to see just those shops.</p>`,
        }
      : null,
    withCarts.length
      ? {
          q: `Can I rent a golf cart in ${city.name}?`,
          a: `<p>${names(withCarts)} ${withCarts.length === 1 ? "rents" : "rent"} golf carts as well as bikes. Street-legal carts need a licensed driver, so check the shop's age rule before you book.</p>`,
        }
      : null,
    {
      q: `Do ${city.name} bike rental shops deliver?`,
      a: withDelivery.length
        ? `<p>${withDelivery.length} of the ${n} shops we track list delivery: ${names(withDelivery)}. Delivery is often free inside a short radius and charged beyond it, so ask when you call.</p>`
        : `<p>None of the ${esc(city.name)} shops we track advertise delivery, though many arrange it on request for multi-day rentals. Shops elsewhere that do deliver are on our <a href="/find/delivery/">delivery page</a>.</p>`,
    },
    {
      q: `Are there guided e-bike tours in ${city.name}?`,
      a: withTours.length
        ? `<p>Yes — ${names(withTours)} ${withTours.length === 1 ? "runs" : "run"} guided rides as well as renting bikes. Tours are usually priced per person and run two to three hours.</p>`
        : `<p>No ${esc(city.name)} shop in our directory advertises guided tours right now. See every Florida operator that does on our <a href="/find/ebike-tours/">e-bike tours page</a>.</p>`,
    },
    openSeven.length
      ? {
          q: `Which ${city.name} rental shops are open seven days a week?`,
          a: `<p>${names(openSeven)} ${openSeven.length === 1 ? "posts" : "post"} hours for all seven days. Seasonal hours change in Florida beach towns, so confirm by phone before a Sunday ride.</p>`,
        }
      : null,
    {
      q: `Do I need a licence to ride an e-bike in ${city.name}?`,
      a: `<p>No. Florida treats an electric bicycle with a motor of 750 W or less and working pedals as a bicycle, so no licence, registration or insurance is needed. Riders under 16 must wear a helmet, and rental shops set their own minimum ages. Towns set their own rules for sidewalks, beaches and trails — see our <a href="/blog/florida-ebike-laws/">Florida e-bike law guide</a>.</p>`,
    },
  ].filter(Boolean);

  const body = `
${findHero({
  crumbs,
  h1,
  lead,
  scene,
  index,
  current: city.url,
  tags: tagsIn(local),
  placeholder: `Search ${city.name} shops`,
})}

<section class="section section--results">
  <div class="wrap">
    ${resultsHead(`${city.name} bike rental shops`, n, "shops")}
    ${listicle(local)}
    ${(() => {
      const guides = guidesFor([city.name], blog);
      return guides.length
        ? `<div class="local-guides mt-3">
      <h3>${esc(city.name)} riding guide${guides.length > 1 ? "s" : ""}</h3>
      <div class="grid grid--${Math.min(3, guides.length)} mt-2">${guides
        .map((post) => linkCard({ href: post.url, title: post.title, text: post.description, more: "Read the guide" }))
        .join("")}</div>
    </div>`
        : "";
    })()}
  </div>
</section>

<section class="section section--tint" id="location">
  <div class="wrap">
    <h2>Location &amp; directions</h2>
    <p class="muted">Where each ${esc(city.name)} shop is, from its Google listing. Directions open in Google Maps.</p>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th scope="col">Shop</th><th scope="col">Address</th><th scope="col">Phone</th><th scope="col"><span class="visually-hidden">Directions</span></th></tr></thead>
        <tbody>${local
          .map(
            (l) => `<tr>
          <th scope="row"><a href="${attr(l.url)}">${esc(l.name)}</a></th>
          <td>${esc(l.address || `${l.city}, FL`)}${
              l.neighborhood && l.neighborhood !== l.city ? `<br><span class="muted small">${esc(l.neighborhood)}</span>` : ""
            }</td>
          <td>${l.phone ? `<a href="tel:${attr(phoneHref(l.phone))}">${esc(l.phone)}</a>` : "—"}</td>
          <td>${
              l.maps_link
                ? `<a class="btn btn--outline btn--sm" href="${attr(l.maps_link)}" rel="nofollow noopener" target="_blank">Directions</a>`
                : ""
            }</td>
        </tr>`
          )
          .join("")}</tbody>
      </table>
    </div>
  </div>
</section>

<section class="section" id="pricing">
  <div class="wrap wrap-narrow prose">
    <h2>Pricing</h2>
    <p>None of the ${esc(String(n))} ${esc(city.name)} ${plural(n, "shop")} publishes rental rates in
    ${n === 1 ? "its" : "their"} Google profile, so we don't print a price we can't stand behind. Call or check the
    shop's website for the current rate, and ask about these at the same time:</p>
    <ul>
      <li>the rate for the hours you actually need: two hours, half day, full day or a week;</li>
      <li>the deposit or card hold per bike, and when it is released;</li>
      <li>whether helmets, locks and a damage waiver are included${withDelivery.length ? ", and the delivery fee if the shop delivers" : ""}.</li>
    </ul>
    <p>Our <a href="/costs/">rental cost guides</a> explain how
    <a href="/costs/daily-vs-weekly-ebike-rental-rates/">daily and weekly rates</a>,
    <a href="/costs/ebike-rental-deposits-and-card-holds/">deposits and card holds</a> and
    <a href="/costs/damage-waivers-and-insurance/">damage waivers</a> work, so you know what to compare.</p>
  </div>
</section>

${
  city.categories.length
    ? `<section class="section">
  <div class="wrap">
    <h2>Narrow ${esc(city.name)} down by what you need</h2>
    <div class="category-grid category-grid--compact mt-2">${city.categories
      .map((c) => categoryTile({ href: c.url, name: c.category.name, blurb: `${c.count} of ${n} ${city.name} shops` }))
      .join("")}</div>
  </div>
</section>`
    : ""
}

${
  near.length
    ? `<section class="section section--tint">
  <div class="wrap">
    <h2>Popular towns near ${esc(city.name)}</h2>
    ${townCards(near.slice(0, 8))}
  </div>
</section>`
    : ""
}

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <div class="grid grid--2 find-guide">
      <div class="prose">
        ${
          notes.html ||
          `<h2>Renting a bike in ${esc(city.name)}</h2>
        <p>${esc(city.name)} sits in ${esc(city.region)}. The ${esc(String(n))} ${plural(n, "shop")} we track ${
            n === 1 ? "holds" : "hold"
          } ${esc(formatReviews(local.reduce((sum, l) => sum + (l.reviews || 0), 0)))} Google reviews between them. ${
            withDelivery.length
              ? `${withDelivery.length} ${plural(withDelivery.length, "shop")} ${withDelivery.length === 1 ? "lists" : "list"} delivery, which matters if you are staying in a rental house without a bike rack.`
              : "Ask about delivery when you call — many Florida shops arrange it for multi-day rentals even when they do not advertise it."
          }</p>`
        }
        <h2>Before you book</h2>
        <p>Confirm four things with any shop: the class of bike you are getting, the minimum age for every
        rider in your group, the size of the card hold, and whether helmets and locks are included. Our
        <a href="/blog/ebike-rental-checklist/">pre-rental checklist</a> has the full list, and
        <a href="/costs/">what it costs</a> covers day rates, deposits and damage waivers.</p>
      </div>
      ${figure(secondPhotoFor(city.slug), { alt: secondPhotoFor(city.slug).alt })}
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap wrap-narrow">
    <h2>${esc(city.name)} bike rental FAQs</h2>
    ${faqBlock(faqs)}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Bike rentals across Florida</h2>
    <p class="muted">Every Florida town in our directory with two or more shops. <a href="/cities/">See all cities</a>.</p>
    ${townGrid(index, { exclude: city.slug })}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  const title = h1;

  return page(site, {
    title,
    description: clamp(
      notes.description
        ? fill(notes.description)
        : `Compare ${n} bike and e-bike rental ${plural(n, "shop")} in ${city.name}, FL: Google ratings, hours, phone numbers and who delivers.${
            best ? ` ${best.name} leads our ranking.` : ""
          }`,
      165
    ),
    path: city.url,
    body,
    ogImage: best && best.photo ? best.photo : scene.og,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      itemListSchema(site, local, { name: `Bike and e-bike rentals in ${city.name}, Florida`, url: city.url }),
    ],
  });
}

