/**
 * /cities/ and /cities/<town>/: the directory by place.
 *
 * The hub is a grid of every Florida town we list, grouped by region, with the
 * number of shops in each. A town with two or more shops has its own ranked
 * page; a town with one links straight to that shop, because a "list" of one
 * would only repeat the shop's own page.
 */
import { facetPanel, facetsOf, FACETS_WIDE_OPEN } from "../facets.mjs";
import { esc, attr, formatReviews, commaList, plural, clamp, phoneHref, seededPick } from "../util.mjs";
import { page, breadcrumbSchema } from "../layout.mjs";
import {
  listicle, faqBlock, faqSchema, linkCard, adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema, photo,
} from "../components.mjs";
import { nearbyCities } from "../data.mjs";
import { featuredFirst } from "../featured.mjs";
import { secondPhotoFor, figure, sceneForRegion, photoFor, stockFor, stockImg, stockCredits, SITE_PHOTOS, OWN_PHOTOS } from "../images.mjs";
import { findHero, resultsHead, townCards, townGrid } from "../find-hero.mjs";
import { tagsIn, guidesFor, categoryTile, townFacts } from "./find.mjs";
import { typeTiles } from "./city-types.mjs";
import { finderHref } from "../finder.mjs";
import { cityToursSection } from "./tours.mjs";
import { floridaMap } from "../fl-map.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const YEAR = new Date().getFullYear();
export const CITIES_CRUMB = { href: "/cities/", label: "Cities" };

/* ------------------------------------------------------------ hub */

export function citiesHub(site, { index, stats }) {
  const townTotal = index.cities.length + index.thinCities.length;

  const body = `
${findHero({
  crumbs: [HOME_CRUMB, CITIES_CRUMB],
  h1: "Florida Cities With Bike & E-Bike Rentals",
  lead: `We list ${stats.total} rental shops in ${townTotal} Florida towns. Search for your town, or tap it on the map below to see its shops ranked.`,
  scene: photoFor("cities"),
  index,
  current: "/cities/",
  filters: false,
  form: `<form class="find-search find-search--where-only" action="/search/" method="get" role="search" data-town-search>
      <div class="find-search__field">
        <label for="town-q">Search for your city</label>
        <input type="search" id="town-q" name="q" placeholder="Type a city, e.g. Key West" autocomplete="off" enterkeyhint="search">
      </div>
      <button class="btn btn--primary find-search__go" type="submit">Search</button>
    </form>
    <p class="town-search__status" aria-live="polite" data-town-status></p>`,
})}

<section class="section">
  <div class="wrap">
    <div class="section__head">
      <h2>Pick Your Town on the Map</h2>
      <p class="muted">Every town we list, drawn on its real town limits. Tap one to see its rental shops.</p>
    </div>
    ${floridaMap(index)}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="section__head">
      <h2>All ${townTotal} Towns, A to Z</h2>
      <p class="muted">${stats.total} shops in total. The number on each town is how many shops we list there.</p>
    </div>
    <div class="city-region" data-region="Florida">${townCards(
      [...index.cities, ...index.thinCities].sort((a, b) => a.name.localeCompare(b.name))
    )}</div>
  </div>
</section>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap wrap-narrow prose">
    ${stockCredits([
      ...[...index.cities, ...index.thinCities].map((t) => stockFor(`town-${t.slug}`)),
    ])}
    <h2>How we build these lists</h2>
    <p>We start from public Google Maps data for bike and e-bike rental, sales and repair businesses
    across Florida. We remove businesses Google marks as closed, and anything that is clearly not a
    bike business. Each shop is placed in the town on its Google address.</p>
    <p>Within a town, we rank shops by Google star rating weighted against how many reviews the rating
    rests on, so a 4.8 from 400 riders ranks above a 5.0 from three. We don't accept payment for
    placement. To rent, call the shop or book on its website: both are on every listing.</p>
    <p>Looking for something specific, like tours, delivery or shops open on Sundays? <a href="/find/">Browse
    by category</a>. Spotted a closed shop or a wrong address? <a href="/contact/">Tell us</a> and
    we will fix it.</p>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `Florida Bike Rentals by City - ${townTotal} Towns, ${stats.total} Shops`,
    description: clamp(
      `Every Florida town in our bike and e-bike rental directory on one clickable map, with the number of shops in each. ${stats.total} shops across ${townTotal} towns.`
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
export function cityPage(site, city, { index, townNotes, blog = [], cityTypeList = [], cityLinker, tours }) {
  const tourGroup = tours ? tours.cities.find((c) => c.citySlug === city.slug) : null;
  const local = city.listings;
  // Featured shops first (src/featured.mjs); `local` keeps the ranking for the copy.
  const shown = featuredFirst(local, city.slug);
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
  // Search Console shows people search "electric bike rental(s) <town>" far more than
  // anything with "near me" and a town name, so the title leads with that phrase
  // and the H1 carries the "rent an electric bike in <town>" form.
  const h1 = `Rent an Electric Bike in ${city.name}, Florida`;
  const facts = townFacts(city, local);
  // The owner's format for town descriptions: "[count] [what the town offers] in [town], Florida. Browse ...".
  const offered = offerings(local);
  const blurb = `${n} ${commaList(offered)} in ${city.name}, Florida. Browse through our listings to find the best option for your rental needs.`;
  const lead = `${blurb} ${facts.sentences[0]}`;

  const faqs = [
    ...(notes.faqs || []),
    {
      q: `Where can I rent a bike or e-bike in ${city.name}?`,
      a: `<p>We track ${n} rental ${plural(n, "shop")} in ${esc(city.name)}. ${esc(best.name)} leads our ranking${
        best.rating ? ` with ${best.rating.toFixed(1)} stars from ${formatReviews(best.reviews)} Google reviews` : ""
      }. Every listing above shows the address, today's hours and directions.</p>`,
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
        : `<p>No ${esc(city.name)} shop in our directory advertises guided tours right now. See every Florida operator that does on our <a href="/find/ebike-tours/">e-bike tours page</a>${
            tourGroup ? `, or compare the <a href="${attr(tourGroup.url)}">${tourGroup.tours.length} ${esc(city.name)} tours bookable on Viator</a>` : ""
          }.</p>`,
    },
    openSeven.length
      ? {
          q: `Which ${city.name} rental shops are open seven days a week?`,
          a: `<p>${names(openSeven)} ${openSeven.length === 1 ? "posts" : "post"} hours for all seven days. Seasonal hours change in Florida beach towns, so check before a Sunday ride.</p>`,
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
  facets: facetPanel(local, { open: "wide" }),
  placeholder: `Search ${city.name} shops`,
  cta: `<a class="btn btn--primary" href="${attr(finderHref({ town: city.slug }))}">Find an E-bike in ${esc(city.name)}</a>`,
})}

<section class="section section--results">
  <div class="wrap">
    ${resultsHead(`${city.name} electric bike rental shops`, n, "shops")}
    ${listicle(shown)}
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

${(() => {
  const types = cityTypeList.filter((x) => x.city.slug === city.slug);
  return types.length
    ? `<section class="section">
  <div class="wrap">
    <h2>Rent by bike type in ${esc(city.name)}</h2>
    <p class="muted">Pick a style to see the ${esc(city.name)} shops to ask, where to ride it, and a booking form set to that bike.</p>
    ${typeTiles(types)}
  </div>
</section>`
    : "";
})()}

<section class="section section--tint" id="location">
  <div class="wrap">
    <h2>Location &amp; directions</h2>
    <p class="muted">Where each ${esc(city.name)} shop is, from its Google listing. Directions open in Google Maps.${(() => { const p = site.phone; return p && p.number ? ` Each shop's phone number and website are on its listing above.` : ""; })()}</p>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th scope="col">Shop</th><th scope="col">Address</th><th scope="col"><span class="visually-hidden">Directions</span></th></tr></thead>
        <tbody>${local
          .map(
            (l) => `<tr>
          <th scope="row"><a href="${attr(l.url)}">${esc(l.name)}</a></th>
          <td>${esc(l.address || `${l.city}, FL`)}${
              l.neighborhood && l.neighborhood !== l.city ? `<br><span class="muted small">${esc(l.neighborhood)}</span>` : ""
            }</td>
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

${tours ? cityToursSection(city, tours) : ""}

<section class="section section--tint">
  <div class="wrap wrap-narrow">
    <h2>${esc(city.name)} bike rental FAQs</h2>
    ${faqBlock(faqs)}
  </div>
</section>

${cityLinker ? cityLinker.section(city, { title: `Everything about ${city.name} on our site`, current: city.url, skip: ["By bike type", "By what you need", `Towns near ${city.name}`] }) : ""}

<section class="section">
  <div class="wrap">
    <h2>Bike rentals across Florida</h2>
    <p class="muted">Every Florida town in our directory with two or more shops. <a href="/cities/">See all cities</a>.</p>
    ${townGrid(index, { exclude: city.slug })}
  </div>
</section>

${cityGallery(city, index)}
${adSlotScript(site, 1)}
`;

  // Most town searches say "bike rental", not "e-bike", so the title names
  // both and gives the shop count Google can show beside it.
  const counted = `Bike & E-Bike Rentals in ${city.name}, FL (${n} ${plural(n, "Shop")})`;
  const title = counted.length <= 70 ? counted : `Bike & E-Bike Rentals in ${city.name}, FL`;

  return page(site, {
    title,
    description: blurb,
    path: city.url,
    body,
    ogImage: best && best.photo ? best.photo : scene.og,
    imageUrls: tourGroup ? tourGroup.tours.slice(0, 12).map((t) => t.image).filter(Boolean) : [],
    inlineScripts: [FACETS_WIDE_OPEN, ...(site.adsense?.enabled ? [ADSENSE_INLINE] : [])],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      itemListSchema(site, shown, { name: `Bike and e-bike rentals in ${city.name}, Florida`, url: city.url }),
    ],
  });
}

/**
 * Photo gallery at the foot of a town hub. Every picture is labelled for what
 * it is: a shop's own photo (from its Google listing), a stock photo of this
 * town or a nearby one, or a general e-bike photo that makes no claim about
 * the place. Thumbnails open full size in a lightbox (assets/js/app.js).
 */
function cityGallery(city, index) {
  const items = [];
  for (const l of city.listings.filter((l) => l.photo).slice(0, 6)) {
    items.push({ src: l.photo, w: l.photoWidth, h: l.photoHeight, full: l.photo, alt: `${l.name} in ${city.name}, Florida`, caption: l.name, tag: "Shop photo", href: l.url });
  }
  const stock = [];
  const own = stockFor(`town-${city.slug}`);
  if (own) stock.push({ photo: own, caption: own.title || city.name });
  for (const c of nearbyCities(city, index.cities, 20)) {
    if (stock.length >= 3) break;
    const p = stockFor(`town-${c.slug}`);
    if (p && c.regionSlug === city.regionSlug) stock.push({ photo: p, caption: `${p.title || c.name} (nearby)` });
  }
  for (const s of stock) {
    items.push({ src: s.photo.small, w: s.photo.smallWidth, h: s.photo.smallHeight, full: s.photo.src, alt: s.photo.title || s.caption, caption: s.caption, tag: "Stock photo" });
  }
  const bikes = [
    ...Object.values(SITE_PHOTOS).map((p) => ({ src: p.src, w: p.width, h: p.height, alt: p.alt })),
    ...OWN_PHOTOS.map((p) => ({ src: p.src, w: p.width, h: p.height, alt: p.alt })),
  ];
  for (const p of seededPick(bikes, Math.max(3, 8 - items.length), city.slug)) {
    items.push({ ...p, full: p.src, caption: p.alt, tag: "E-bike photo" });
  }
  // Bike scenes with no place in them top the grid up to full rows of four.
  const scenes = [
    ["scene-ebike", "A white step-through electric bike parked on grass"],
    ["scene-boardwalk", "A bike parked at the end of a beach boardwalk, with a kite surfer offshore"],
    ["scene-gulf", "A cyclist silhouetted on the beach at sunset"],
  ];
  for (const [slot, alt] of seededPick(scenes, 3, `${city.slug}-scenes`)) {
    if (items.length % 4 === 0) break;
    const p = stockFor(slot);
    if (!p) continue;
    stock.push({ photo: p });
    items.push({ src: p.small, w: p.smallWidth, h: p.smallHeight, full: p.src, alt, caption: alt, tag: "Stock photo" });
  }
  if (!items.length) return "";
  return `<section class="section section--tint city-gallery" id="photos">
  <div class="wrap">
    <h2>${esc(city.name)} photo gallery</h2>
    <p class="muted">Shop photos come from each shop's Google listing. Stock photos show ${esc(city.name)} or a nearby town, and e-bike photos show the kinds of bikes you can rent; neither shows a specific shop.</p>
    <ul class="gallery-grid">${items
      .map(
        (it) => `<li class="gallery-grid__item">
        <a href="${attr(it.full)}" data-lightbox data-caption="${attr(it.caption)}">
          <img src="${attr(it.src)}" alt="${attr(it.alt)}" width="${it.w}" height="${it.h}" loading="lazy" decoding="async">
          <span class="gallery-grid__tag">${esc(it.tag)}</span>
        </a>
        <p class="gallery-grid__caption">${it.href ? `<a href="${attr(it.href)}">${esc(it.caption)}</a>` : esc(it.caption)}</p>
      </li>`
      )
      .join("")}</ul>
    ${stockCredits(stock.map((s) => s.photo))}
  </div>
</section>`;
}

/** What a town's shops offer, most useful first, for the town description. Up to three, each backed by at least one shop. */
function offerings(local) {
  const has = (key) => local.some((l) => facetsOf(l).includes(key));
  const out = [];
  if (has("ebike")) out.push("e-bike rentals");
  if (local.some((l) => l.is_rental && !facetsOf(l).includes("ebike"))) out.push(has("style-cruiser") ? "beach cruisers" : "bike rentals");
  if (has("tours")) out.push("guided tours");
  if (out.length < 3 && has("scooters")) out.push("scooter rentals");
  if (out.length < 3 && has("golf")) out.push("golf cart rentals");
  if (out.length < 3 && has("repairs")) out.push("e-bike repairs");
  return out.length ? out.slice(0, 3) : ["e-bike shops"];
}
