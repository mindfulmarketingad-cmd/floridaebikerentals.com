import { esc, attr, formatReviews, commaList, plural, clamp } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import {
  listicle, faqBlock, faqSchema, linkCard, linkCloud,
  adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema, summaryFor,
} from "../components.mjs";
import { statsFor, nearbyCities } from "../data.mjs";
import { photoFor, secondPhotoFor, figure, sceneForRegion } from "../images.mjs";
import { findHero, resultsHead, townCards, townGrid } from "../find-hero.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const FIND_CRUMB = { href: "/find/", label: "Find" };

/**
 * Guides written about a place: blog posts tagged with one of these town names.
 * Town and region pages link to them, so a guide such as the Orlando or 30A one
 * is linked from the directory pages that carry the most weight for that place,
 * not only from the blog index.
 */
export function guidesFor(names, blog) {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return blog.filter((post) => (post.tags || []).some((t) => wanted.has(String(t).toLowerCase())));
}

export function filterBar(cities, tags, noun = "listings") {
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

export function tagsIn(listings) {
  const counts = new Map();
  for (const l of listings) for (const t of l.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}

/* ------------------------------------------------------------ find hub */

export function findHub(site, { index, listings, stats }) {
  const body = `
${findHero({
  crumbs: [HOME_CRUMB, { href: "/find/", label: "Find" }],
  h1: "Find Bike & E-Bike Rentals in Florida",
  lead: `${stats.total} rental shops across ${stats.cities} Florida towns. Choose a town or region, or let us sort every shop by distance from you.`,
  scene: photoFor("find"),
  index,
  current: "/find/",
  filters: false,
})}

<section class="section section--tint">
  <div class="wrap">
    <div class="callout callout--lead">
      <div>
        <h2>Already somewhere? Skip the browsing.</h2>
        <p class="muted">Share your location and every shop in the directory re-sorts by how far it
        is from you, closest first, with the distance on each one.</p>
      </div>
      <a class="btn btn--blue" href="/find/ebike-rentals-near-me/">E-bike rentals near me</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Browse by region</h2>
    <div class="grid grid--3 mt-2">
      ${index.regions
        .map((region) =>
          linkCard({
            href: region.url,
            title: `E-bike rentals in ${region.name}`,
            meta: `${region.listings.length} partners · ${region.cities.length} towns`,
            text: region.cities.slice(0, 5).map((c) => c.name).join(", "),
            more: "Open region",
          })
        )
        .join("")}
    </div>
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <h2>Browse by what you need</h2>
    <div class="grid grid--3 mt-2">
      ${index.topics
        .map((topic) =>
          linkCard({
            href: topic.url,
            title: topic.title,
            meta: `${topic.listings.length} ${plural(topic.listings.length, "shop")}`,
            text: clamp(topic.intro, 120),
            more: "Open list",
          })
        )
        .join("")}
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    ${figure(secondPhotoFor("find"), { alt: `Riding a rented e-bike in Florida - ${secondPhotoFor("find").alt}` })}
    <h2>All Florida towns with e-bike rentals</h2>
    <p class="muted">${esc(String(index.cities.length))} towns, ordered by how many rental partners we
    track in each.</p>
    ${linkCloud(
      index.cities.map((city) => ({
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
${findHero({
  crumbs,
  h1: `${region.name} Bike & E-Bike Rentals`,
  lead: `${stats.total} rental shops across ${stats.cities} ${plural(stats.cities, "town")} in ${region.name}, including ${commaList(
    townNames
  )}. Ranked by Google rating and review count.`,
  scene: sceneForRegion(region.slug),
  index,
  current: region.url,
  tags: tagsIn(top),
  placeholder: "Shop, town or service",
})}

<section class="section section--results">
  <div class="wrap">
    ${resultsHead(`Top ${top.length} rental shops in ${region.name}`, top.length, "shops")}
    ${listicle(top)}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>Towns in ${esc(region.name)}</h2>
    ${townCards(region.cities, sceneForRegion)}
  </div>
</section>

${adSlot(site, "")}

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
      ${[...guidesFor(region.cities.map((c) => c.name), blog), ...blog]
        .filter((post, i, all) => all.indexOf(post) === i)
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
    ogImage: sceneForRegion(region.slug).src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      itemListSchema(site, top, { name: `E-bike rentals in ${region.name}`, url: region.url }),
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
export function findCity(site, city, { index, townNotes, blog = [] }) {
  const local = city.listings;
  const n = local.length;
  const notes = (townNotes && townNotes.get(city.slug)) || {};
  const fill = (text) => String(text || "").replace(/\{count\}/g, String(n));
  const near = nearbyCities(city, index.cities, 8);
  const scene = sceneForRegion(city.regionSlug);
  const crumbs = [
    HOME_CRUMB,
    FIND_CRUMB,
    { href: `/find/ebike-rentals-in-${city.regionSlug}/`, label: city.region },
    { href: city.url, label: city.name },
  ];
  const best = local[0];
  const tagged = (tag) => local.filter((l) => (l.tags || []).includes(tag));
  const withDelivery = tagged("Delivery available");
  const withTours = tagged("Guided tours");
  const withScooters = tagged("Scooters");
  const withCarts = tagged("Golf carts");
  const specialists = tagged("Electric bikes");
  const openSeven = local.filter((l) => (l.hours || []).filter((h) => !h.closed).length === 7);
  const names = (list) => esc(commaList(list.slice(0, 4).map((l) => l.name)));

  const h1 = notes.h1 ? fill(notes.h1) : `${city.name} E-Bike & Bike Rentals`;
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
        : `<p>None of the ${esc(city.name)} shops we track advertise delivery, though many arrange it on request for multi-day rentals. Shops elsewhere that do deliver are on our <a href="/find/ebike-rentals-with-delivery-in-florida/">delivery page</a>.</p>`,
    },
    {
      q: `Are there guided e-bike tours in ${city.name}?`,
      a: withTours.length
        ? `<p>Yes — ${names(withTours)} ${withTours.length === 1 ? "runs" : "run"} guided rides as well as renting bikes. Tours are usually priced per person and run two to three hours.</p>`
        : `<p>No ${esc(city.name)} shop in our directory advertises guided tours right now. See every Florida operator that does on the <a href="/find/guided-ebike-tours-in-florida/">guided tours page</a>, or <a href="/tours/">book a tour through Viator</a>.</p>`,
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

${
  near.length
    ? `<section class="section section--tint">
  <div class="wrap">
    <h2>Popular towns near ${esc(city.name)}</h2>
    ${townCards(near.slice(0, 8), sceneForRegion)}
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
    ${townGrid(index, { exclude: city.slug })}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  const defaultTitle = (withNearYou) =>
    `${city.name} Bike Rentals: ${n} E-Bike Rental ${plural(n, "Shop")}${withNearYou ? " Near You" : ""}`;
  const title = notes.title
    ? fill(notes.title)
    : defaultTitle(true).length <= 62
      ? defaultTitle(true)
      : defaultTitle(false);

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
    ogImage: best && best.photo ? best.photo : scene.src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      itemListSchema(site, local, { name: `Bike and e-bike rentals in ${city.name}, Florida`, url: city.url }),
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
${findHero({
  crumbs,
  h1: topic.h1,
  lead: topic.intro,
  scene: photoFor(topic.slug),
  index,
  current: topic.url,
  tags: tagsIn(shown),
  placeholder: "Shop, town or service",
})}

<section class="section section--results">
  <div class="wrap">
    ${resultsHead(`Top ${shown.length} of ${stats.total}`, shown.length, "shops")}
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
