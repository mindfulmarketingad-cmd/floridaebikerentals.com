import { esc, attr, formatReviews, commaList, plural, clamp } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import {
  listicle, mapPanel, faqBlock, faqSchema, linkCard, linkCloud, statRow,
  adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema, summaryFor,
} from "../components.mjs";
import { statsFor, nearbyCities } from "../data.mjs";
import { photoFor, secondPhotoFor, figure, banner } from "../images.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const FIND_CRUMB = { href: "/find/", label: "Find" };

function filterBar(cities, tags, noun = "listings") {
  return `<form class="filterbar" data-filter-form>
  <div class="field">
    <label for="f-q">Search this list</label>
    <input type="search" id="f-q" name="q" placeholder="Shop name, town or service" autocomplete="off">
  </div>
  ${
    cities && cities.length > 1
      ? `<div class="field">
    <label for="f-city">Town</label>
    <select id="f-city" name="city">
      <option value="">All towns</option>
      ${cities.map((c) => `<option value="${attr(c)}">${esc(c)}</option>`).join("")}
    </select>
  </div>`
      : ""
  }
  <div class="field">
    <label for="f-tag">Service</label>
    <select id="f-tag" name="tag">
      <option value="">All services</option>
      ${tags.map((t) => `<option value="${attr(t)}">${esc(t)}</option>`).join("")}
    </select>
  </div>
  <div class="field">
    <label for="f-sort">Sort by</label>
    <select id="f-sort" name="sort">
      <option value="">Our ranking</option>
      <option value="rating">Star rating</option>
      <option value="reviews">Review count</option>
      <option value="name">Name A-Z</option>
    </select>
  </div>
</form>
<p class="result-count" data-filter-count data-noun="${attr(noun)}" aria-live="polite"></p>`;
}

function tagsIn(listings) {
  const counts = new Map();
  for (const l of listings) for (const t of l.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}

/* ------------------------------------------------------------ find hub */

export function findHub(site, { index, listings, stats }) {
  const body = `
${breadcrumbs([HOME_CRUMB, { href: "/find/", label: "Find" }])}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">Find hub</span>
      <h1>Find E-Bike Rentals in Florida</h1>
      <p>Every Florida region and town in the directory, with ${esc(String(stats.total))} rental
      partners between them. Start with a region, then drill into the town you are staying in.</p>
    </div>
    ${statRow([
      { value: String(stats.total), label: "Rental partners" },
      { value: String(stats.cities), label: "Towns covered" },
      { value: String(index.regions.length), label: "Regions" },
      { value: formatReviews(stats.reviews), label: "Google reviews" },
    ])}
    ${banner(photoFor("find"), { alt: `Find e-bike rentals across Florida - ${photoFor("find").alt}` })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>Browse by region</h2>
    <div class="mt-2">${linkCloud(
      [...index.regions]
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
        .map((region) => ({
          href: region.url,
          label: `E-bike rentals in ${region.name}`,
          count: region.listings.length,
        }))
    )}</div>
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <h2>Browse by what you need</h2>
    <div class="mt-2">${linkCloud(
      [...index.topics]
        .sort((a, b) => a.title.localeCompare(b.title, "en"))
        .map((topic) => ({ href: topic.url, label: topic.title, count: topic.listings.length }))
    )}</div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    ${figure(secondPhotoFor("find"), { alt: `Riding a rented e-bike in Florida - ${secondPhotoFor("find").alt}` })}
    <h2>All Florida towns with e-bike rentals</h2>
    <p class="muted">${esc(String(index.cities.length))} towns, listed alphabetically, with the
    number of rental partners we track in each.</p>
    ${linkCloud(
      [...index.cities]
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
        .map((city) => ({
          href: city.url,
          label: `${city.name} e-bike rentals`,
          count: city.listings.length,
        }))
    )}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `Find E-Bike Rentals in Florida - ${stats.cities} Towns, ${stats.total} Shops`,
    description: `Browse Florida e-bike rentals by region and town. ${stats.total} rental partners across ${stats.cities} Florida towns, ranked by Google rating and review volume.`,
    path: "/find/",
    body,
    ogImage: photoFor("find").src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, [HOME_CRUMB, FIND_CRUMB]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Find E-Bike Rentals in Florida",
        url: `${site.url}/find/`,
        description: `Florida e-bike rental directory covering ${stats.cities} towns.`,
        isPartOf: { "@id": `${site.url}/#website` },
      },
    ],
  });
}

/* --------------------------------------------------------- region page */

export function findRegion(site, region, { index, blog }) {
  const stats = statsFor(region.listings);
  const top = region.listings.slice(0, 30);
  const crumbs = [HOME_CRUMB, FIND_CRUMB, { href: region.url, label: region.name }];
  const townNames = region.cities.slice(0, 6).map((c) => c.name);

  const faqs = [
    {
      q: `Where can I rent an e-bike in ${region.name}?`,
      a: `<p>We track ${stats.total} rental partners across ${stats.cities} ${plural(
        stats.cities,
        "town"
      )} in ${esc(region.name)}, including ${esc(commaList(townNames))}. The list on this page is ordered by Google rating weighted against review volume, so the shops with a proven track record appear first.</p>`,
    },
    {
      q: `Which town in ${region.name} has the most e-bike rental shops?`,
      a: `<p>${esc(region.cities[0]?.name || region.name)} has the most in this region, with ${esc(
        String(region.cities[0]?.listings.length || 0)
      )} rental partners. ${
        region.cities[1]
          ? `${esc(region.cities[1].name)} is next with ${esc(String(region.cities[1].listings.length))}.`
          : ""
      }</p>`,
    },
    {
      q: `Do ${region.name} rental shops deliver e-bikes?`,
      a: `<p>Some do. ${esc(
        String(region.listings.filter((l) => (l.tags || []).includes("Delivery available")).length)
      )} shops in this region list delivery on their public profile, which usually means dropping bikes at a rental house, condo or hotel. Confirm the delivery radius and fee when you call — it is often free inside a few miles and charged beyond that.</p>`,
    },
    {
      q: `What does it cost to rent an e-bike in ${region.name}?`,
      a: `<p>Expect roughly $30 to $55 for two hours and $60 to $95 for a full day, with weekly rates from about $200. Beach towns run at the higher end in peak season. Our <a href="/blog/ebike-rental-cost-florida/">Florida e-bike rental pricing guide</a> covers deposits, delivery fees and add-ons.</p>`,
    },
  ];

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">${esc(region.name)}</span>
      <h1>E-Bike Rentals in ${esc(region.name)}</h1>
      <p>${esc(stats.total)} rental partners across ${esc(String(stats.cities))} ${plural(
    stats.cities,
    "town"
  )} in ${esc(region.name)}, ranked by Google rating and review volume. Includes ${esc(
    commaList(townNames)
  )}.</p>
    </div>
    ${statRow([
      { value: String(stats.total), label: "Rental partners" },
      { value: String(stats.cities), label: "Towns" },
      { value: stats.avgRating, label: "Average rating" },
      { value: formatReviews(stats.reviews), label: "Google reviews" },
    ])}
    ${banner(photoFor(region.slug), { alt: `E-bike rentals in ${region.name}, Florida - ${photoFor(region.slug).alt}` })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>Towns in ${esc(region.name)}</h2>
    ${linkCloud(
      region.cities.map((city) => ({
        href: city.url,
        label: `${city.name} e-bike rentals`,
        count: city.listings.length,
      }))
    )}
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <div class="section__head">
      <h2>Top ${top.length} e-bike rentals in ${esc(region.name)}</h2>
      <p>Toggle the map to see how these shops are spread across the region, then call the ones nearest
      to where you are staying.</p>
    </div>
    ${mapPanel(top, { id: `map-${attr(region.slug)}`, zoom: 8 })}
    ${filterBar(
      [...new Set(top.map((l) => l.city))].sort(),
      tagsIn(top),
      "shops"
    )}
    ${listicle(top)}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap wrap-narrow">
    <h2>${esc(region.name)} e-bike rental questions</h2>
    ${faqBlock(faqs)}
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${figure(secondPhotoFor(region.slug), { alt: `Riding in ${region.name}, Florida - ${secondPhotoFor(region.slug).alt}` })}
    <h2>Other Florida regions</h2>
    ${linkCloud(
      index.regions
        .filter((r) => r.slug !== region.slug)
        .map((r) => ({ href: r.url, label: r.name, count: r.listings.length }))
    )}
    <h3 class="mt-3">Guides worth reading first</h3>
    <div class="grid grid--3 mt-2">
      ${blog
        .slice(0, 3)
        .map((post) => linkCard({ href: post.url, title: post.title, meta: post.category, text: post.description, more: "Read the guide" }))
        .join("")}
    </div>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `E-Bike Rentals in ${region.name} - ${stats.total} Shops Compared`,
    description: clamp(
      `Compare ${stats.total} e-bike rental shops across ${region.name}, Florida — ${commaList(
        townNames
      )}. Hours, ratings, phone numbers and map.`
    ),
    path: region.url,
    body,
    ogImage: photoFor(region.slug).src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      itemListSchema(site, top, { name: `E-bike rentals in ${region.name}`, url: region.url }),
    ],
  });
}

/* ----------------------------------------------------------- city page */

export function findCity(site, city, { index, listings, blog }) {
  const local = city.listings;
  const stats = statsFor(local);
  const near = nearbyCities(city, index.cities, 8);
  const crumbs = [
    HOME_CRUMB,
    FIND_CRUMB,
    { href: `/find/ebike-rentals-in-${city.regionSlug}/`, label: city.region },
    { href: city.url, label: city.name },
  ];
  const best = local[0];
  const withDelivery = local.filter((l) => (l.tags || []).includes("Delivery available"));
  const withTours = local.filter((l) => (l.tags || []).includes("Guided tours"));
  const openSeven = local.filter((l) => (l.hours || []).filter((h) => !h.closed).length === 7);

  const nearbyPool = near.flatMap((c) => c.listings.slice(0, 2)).slice(0, 8);

  const faqs = [
    {
      q: `Where can I rent an e-bike in ${city.name}, Florida?`,
      a: `<p>${
        local.length === 1
          ? `We track one rental partner in ${esc(city.name)}: ${esc(best.name)}${
              best.rating ? `, rated ${best.rating.toFixed(1)} from ${formatReviews(best.reviews)} Google reviews` : ""
            }.`
          : `We track ${local.length} rental partners in ${esc(city.name)}. ${esc(
              best.name
            )} currently leads the list${
              best.rating ? ` with ${best.rating.toFixed(1)} stars from ${formatReviews(best.reviews)} Google reviews` : ""
            }.`
      } Every listing on this page shows the address, phone number and opening hours so you can call before you travel.</p>`,
    },
    {
      q: `Do ${city.name} e-bike shops deliver to rental houses?`,
      a: withDelivery.length
        ? `<p>${withDelivery.length} of the ${local.length} shops we track in ${esc(
            city.name
          )} list delivery on their public profile: ${esc(
            commaList(withDelivery.slice(0, 4).map((l) => l.name))
          )}. Delivery is often free inside a short radius and charged beyond it, so ask when you call.</p>`
        : `<p>None of the ${esc(city.name)} shops we track advertise delivery on their public profile, though many Florida shops arrange it on request for multi-day rentals. It is always worth asking. Shops in nearby towns that do deliver are listed on our <a href="/find/ebike-rentals-with-delivery-in-florida/">delivery page</a>.</p>`,
    },
    {
      q: `Are there guided e-bike tours in ${city.name}?`,
      a: withTours.length
        ? `<p>Yes — ${withTours.length} ${plural(withTours.length, "operator")} in ${esc(
            city.name
          )} ${withTours.length === 1 ? "runs" : "run"} guided rides as well as renting bikes: ${esc(
            commaList(withTours.slice(0, 4).map((l) => l.name))
          )}. Tours are usually priced per person and typically run two to three hours.</p>`
        : `<p>No ${esc(city.name)} operator in our directory advertises guided tours right now. Browse every Florida operator that does on our <a href="/find/guided-ebike-tours-in-florida/">guided e-bike tours page</a>.</p>`,
    },
    {
      q: `Which ${city.name} bike shops are open seven days a week?`,
      a: openSeven.length
        ? `<p>${esc(commaList(openSeven.slice(0, 5).map((l) => l.name)))} ${
            openSeven.length === 1 ? "posts" : "post"
          } hours for all seven days. Seasonal hours change in Florida beach towns, so confirm by phone before you plan a Sunday ride.</p>`
        : `<p>None of the ${esc(city.name)} shops we track post hours for all seven days, so plan around Sunday closures and call ahead.</p>`,
    },
    {
      q: `Do I need a licence to ride an e-bike in ${city.name}?`,
      a: `<p>No. Florida treats an electric bicycle with a 750 W or smaller motor and working pedals as a bicycle, so no licence, registration or insurance is required. Helmets are required for riders under 16, and Class 3 e-bikes have a minimum operating age of 16. Local rules on sidewalks, beaches and trails vary by town — ask the shop. See our <a href="/blog/florida-ebike-laws/">Florida e-bike law guide</a>.</p>`,
    },
  ];

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">${esc(city.region)}</span>
      <h1>E-Bike Rentals in ${esc(city.name)}, Florida</h1>
      <p>${esc(String(local.length))} ${plural(local.length, "rental partner")} in ${esc(
    city.name
  )}, ranked by Google rating and review volume. Compare hours, services and phone numbers, then book
      direct with the shop.</p>
    </div>
    ${statRow([
      { value: String(stats.total), label: plural(stats.total, "Rental partner") },
      { value: stats.avgRating, label: "Average rating" },
      { value: formatReviews(stats.reviews), label: "Google reviews" },
      { value: String(withTours.length), label: "Tour operators" },
    ])}
    ${banner(photoFor(city.slug), { alt: `E-bike rentals in ${city.name}, Florida - ${photoFor(city.slug).alt}` })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="section__head">
      <h2>The best e-bike rentals in ${esc(city.name)}</h2>
      <p>Numbered by our ranking: Google star rating weighted against how many reviews it is built on.
      Toggle the map to see exactly where each shop sits.</p>
    </div>
    ${mapPanel(local, { id: `map-${attr(city.slug)}`, zoom: 12 })}
    ${local.length > 3 ? filterBar(null, tagsIn(local), "shops") : ""}
    ${listicle(local)}
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    ${figure(secondPhotoFor(city.slug), { alt: `Riding a rented e-bike around ${city.name}, Florida - ${secondPhotoFor(city.slug).alt}` })}
    <div class="prose">
      <h2>Renting an e-bike in ${esc(city.name)}</h2>
      <p>${esc(city.name)} sits in ${esc(city.region)}, and the ${esc(
    String(local.length)
  )} ${plural(local.length, "shop")} we track ${
    local.length === 1 ? "holds" : "hold"
  } ${esc(formatReviews(stats.reviews))} Google reviews between ${
    local.length === 1 ? "it" : "them"
  }, averaging ${esc(stats.avgRating)} stars. ${
    withDelivery.length
      ? `${withDelivery.length} ${plural(withDelivery.length, "shop")} ${
          withDelivery.length === 1 ? "lists" : "list"
        } delivery, which matters if you are staying in a rental house without a bike rack.`
      : "Ask about delivery when you call — many Florida shops arrange it for multi-day rentals even when they do not advertise it."
  }</p>
      <p>Before you book anywhere in Florida, confirm four things: the class of bike you are getting,
      the minimum age for every rider in your group, what the card hold will be, and whether helmets and
      locks are included. Our <a href="/blog/ebike-rental-checklist/">pre-rental checklist</a> has the
      full list, and <a href="/blog/ebike-classes-explained/">e-bike classes explained</a> covers the
      difference between the Class 1, 2 and 3 bikes you will be offered.</p>
      <p>Riding rules in Florida are set at state level but restricted locally. Helmets are required
      under 16, Class 3 bikes have a minimum age of 16, and individual towns decide whether e-bikes may
      use sidewalks, beaches and trails. The shop you rent from will know the current local position —
      it is the question they answer most.</p>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap wrap-narrow">
    <h2>${esc(city.name)} e-bike rental FAQs</h2>
    ${faqBlock(faqs)}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>E-bike rentals near ${esc(city.name)}</h2>
    ${linkCloud(
      near.map((c) => ({
        href: c.url,
        label: `${c.name}${typeof c.distance === "number" ? ` (${c.distance.toFixed(0)} mi)` : ""}`,
        count: c.listings.length,
      }))
    )}
    ${
      nearbyPool.length
        ? `<h3 class="mt-3">Shops in neighbouring towns</h3>
    <div class="grid grid--3 mt-2">${nearbyPool
      .map((l) =>
        linkCard({
          href: l.url,
          title: l.name,
          meta: `${l.city}, FL${l.rating ? ` · ${l.rating.toFixed(1)} stars` : ""}`,
          text: clamp(summaryFor(l), 110),
          more: "View listing",
        })
      )
      .join("")}</div>`
        : ""
    }
    <p class="mt-3"><a class="btn btn--outline btn--sm" href="/find/ebike-rentals-in-${attr(
      city.regionSlug
    )}/">All ${esc(city.region)} rentals</a>
    <a class="btn btn--outline btn--sm" href="/find/">All Florida towns</a></p>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `E-Bike Rentals in ${city.name}, FL - ${local.length} ${plural(local.length, "Shop")} Compared`,
    description: clamp(
      `${local.length} e-bike rental ${plural(local.length, "shop")} in ${city.name}, Florida. Compare hours, Google ratings, services and phone numbers${
        best ? `, starting with ${best.name}` : ""
      }.`
    ),
    path: city.url,
    body,
    ogImage: best && best.photo ? best.photo : photoFor(city.slug).src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      itemListSchema(site, local, { name: `E-bike rentals in ${city.name}, Florida`, url: city.url }),
    ],
  });
}

/* ---------------------------------------------------------- topic page */

export function findTopic(site, topic, { index }) {
  const stats = statsFor(topic.listings);
  const shown = topic.listings.slice(0, 40);
  const crumbs = [HOME_CRUMB, FIND_CRUMB, { href: topic.url, label: topic.title }];
  const cities = [...new Set(shown.map((l) => l.city))].sort();

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">Find</span>
      <h1>${esc(topic.h1)}</h1>
      <p>${esc(topic.intro)}</p>
    </div>
    ${statRow([
      { value: String(stats.total), label: "Matching shops" },
      { value: String(stats.cities), label: "Towns" },
      { value: stats.avgRating, label: "Average rating" },
      { value: formatReviews(stats.reviews), label: "Google reviews" },
    ])}
    ${banner(photoFor(topic.slug), { alt: `${topic.h1} - ${photoFor(topic.slug).alt}` })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>Top ${shown.length} of ${stats.total}</h2>
    ${mapPanel(shown, { id: `map-${attr(topic.slug)}`, zoom: 7 })}
    ${filterBar(cities, tagsIn(shown), "shops")}
    ${listicle(shown)}
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    ${figure(secondPhotoFor(topic.slug), { alt: `${topic.h1} - ${secondPhotoFor(topic.slug).alt}` })}
    <h2>Browse by region instead</h2>
    ${linkCloud(index.regions.map((r) => ({ href: r.url, label: r.name, count: r.listings.length })))}
    <h3 class="mt-3">Other ways to search</h3>
    ${linkCloud(
      index.topics
        .filter((t) => t.slug !== topic.slug)
        .map((t) => ({ href: t.url, label: t.title, count: t.listings.length }))
    )}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `${topic.title} - ${stats.total} Shops Compared`,
    description: clamp(topic.intro),
    path: topic.url,
    body,
    ogImage: photoFor(topic.slug).src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      itemListSchema(site, shown, { name: topic.title, url: topic.url }),
    ],
  });
}
