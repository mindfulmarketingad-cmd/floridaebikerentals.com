import { esc, attr, clamp, plural, formatRating, formatReviews, commaList, slugify, isoDate } from "../util.mjs";
import { page, pageHero, breadcrumbSchema } from "../layout.mjs";
import {
  listicle, mapPanel, faqBlock, faqSchema, linkCloud, statRow,
  adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema, summaryFor,
} from "../components.mjs";
import { nearbyCities, statsFor } from "../data.mjs";
import { byline, authorCard } from "./hub.mjs";
import { photoFor, secondPhotoFor, figure, banner } from "../images.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const BLOG_CRUMB = { href: "/blog/", label: "Blog" };

/** Deterministic pick from a fixed-size variant list, so 32 near-identical
 *  page shapes don't read as the same three sentences with the city name
 *  swapped in. */
function hashOf(text) {
  let value = 0;
  for (let i = 0; i < String(text).length; i++) value = (value * 31 + String(text).charCodeAt(i)) >>> 0;
  return value;
}
function pick(seed, offset, variants) {
  return variants[(hashOf(seed) + offset) % variants.length];
}

function tocFor(headings) {
  if (headings.length < 3) return "";
  return `<nav class="toc" aria-label="On this page">
  <h2>On this page</h2>
  <ol>${headings.map((h) => `<li><a href="#${attr(h.id)}">${esc(h.text)}</a></li>`).join("")}</ol>
</nav>`;
}

const TAG_TOPIC_URL = {
  "Guided tours": "/find/guided-ebike-tours-in-florida/",
  "Delivery available": "/find/ebike-rentals-with-delivery-in-florida/",
  Scooters: "/find/ebike-and-scooter-rentals-in-florida/",
  "Golf carts": "/find/golf-cart-and-ebike-rentals-in-florida/",
};

/**
 * "5 Best E-Bike Rental Shops in {City}, Florida" - a programmatic listicle
 * for every city with at least BEST_SHOPS_MIN_LISTINGS partners (see
 * build.mjs). Content is assembled from real per-city data - the top five by
 * our ranking, the tags actually present among that city's shops, whichever
 * trail guides and topic pages happen to cover the same city - rather than a
 * single template with the city name substituted in, so a city with a trail
 * guide and a golf-cart page reads differently from one with neither.
 */
export function bestShopsEntryFor(city) {
  const slug = `5-best-ebike-rental-shops-in-${city.slug}-florida`;
  return {
    slug,
    url: `/blog/${slug}/`,
    kind: "best-shops",
    title: `5 Best E-Bike Rental Shops in ${city.name}, Florida`,
    metaTitle: `5 Best E-Bike Rentals in ${city.name}, FL - Ranked`,
    description: `The five highest-rated e-bike rental shops in ${city.name}, Florida, ranked by Google rating weighted against review volume, with hours, addresses and what each one actually offers.`,
    category: city.region,
    author: "marisa-donnelly",
    date: "2026-09-03",
    updated: "2026-09-03",
    readingTime: 7,
    tags: ["Best of", city.name, city.region],
    city,
  };
}

export function bestShopsPage(site, post, ctx) {
  const { index, hubEntries, authorsBySlug } = ctx;
  const { city } = post;
  const author = authorsBySlug.get(post.author);
  const top5 = city.listings.slice(0, 5);
  const rest = city.listings.slice(5);
  const stats = statsFor(city.listings);
  const crumbs = [HOME_CRUMB, BLOG_CRUMB, { href: post.url, label: post.title }];
  const hero = photoFor(city.slug);
  const extra = secondPhotoFor(city.slug);
  const best = top5[0];
  const near = nearbyCities(city, index.cities, 6);

  // Real tag prevalence among every shop in this city, not just the top five -
  // this is what makes the "why rent here" paragraph vary city to city.
  const tagCounts = new Map();
  for (const l of city.listings) for (const t of l.tags || []) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  const withTours = tagCounts.get("Guided tours") || 0;
  const withDelivery = tagCounts.get("Delivery available") || 0;
  const openSeven = city.listings.filter((l) => (l.hours || []).filter((h) => !h.closed).length === 7).length;

  // Any trail guide or golf-cart/scooter topic page that happens to cover this
  // exact city - present for some cities, absent for others, so this section
  // is not the same shape everywhere.
  const localTrails = (hubEntries.trails || [])
    .filter((e) => (e.towns || []).includes(city.slug));
  const localTopics = (index.cityTopicsByCitySlug.get(city.slug) || []);

  const otherServices = [...tagCounts.keys()]
    .filter((t) => TAG_TOPIC_URL[t])
    .sort((a, b) => tagCounts.get(b) - tagCounts.get(a));

  const intro = pick(city.slug, 0, [
    `${city.name} has ${city.listings.length} rental partners in our directory, and these five lead the pack: ranked by Google star rating weighted against how many reviews it is built on, so a perfect score from three reviews never outranks a strong average from three hundred.`,
    `We track ${city.listings.length} e-bike rental ${plural(city.listings.length, "shop")} in ${esc(city.name)}. The five below are the ones worth calling first, ordered by Google rating weighted against review volume rather than rating alone.`,
    `Picking a shop in ${esc(city.name)} from a raw search means wading through ${city.listings.length} listings of mixed quality. We have already done that: here are the five that come out on top once review volume is weighted against the star average.`,
    `Out of the ${city.listings.length} e-bike rental businesses we track in ${esc(city.name)}, these five rank highest - not on stars alone, which rewards a shop with three five-star reviews over one with three hundred, but on rating weighted against how many people actually left one.`,
  ]);

  const whyRent = pick(city.slug, 1, [
    `${esc(city.name)} sits in ${esc(city.region)}, and pedal assist earns its keep here the same way it does across Florida: flat roads, real distance between the places worth seeing, and heat that turns a rented bike from a novelty into the only sensible way to cover ground.`,
    `An e-bike in ${esc(city.name)} solves the problem every visitor runs into: everything worth reaching is a bit too far to walk and a bit silly to drive. ${esc(city.region)} is flat enough that assist is optional for fitness and essential for heat.`,
    `${esc(city.name)}, in ${esc(city.region)}, rewards exploring by bike more than most Florida towns do. The terrain is flat regardless of what bike you are on; what an e-bike changes is how far you are willing to go before turning back.`,
  ]);

  const closer = pick(city.slug, 2, [
    `Call ahead in season - the better-reviewed shops on this list are the ones that sell out first on a busy weekend.`,
    `The shops at the top of this list book up fastest in peak season, so a call a day or two ahead beats showing up and hoping.`,
    `Popularity and availability move together here: the best-reviewed shop is also the one most likely to be fully booked on a Saturday morning, so plan a day or two ahead if you can.`,
  ]);

  const headings = [];
  const addHeading = (text) => {
    const id = slugify(text);
    headings.push({ id, text });
    return id;
  };

  const hBest = addHeading(`The Best E-Bike Rentals in ${city.name}`);
  const hWhy = addHeading(`Why Rent an E-Bike in ${city.name}`);
  const hCost = addHeading(`What It Costs to Rent in ${city.name}`);
  const hAround = (localTrails.length || localTopics.length) ? addHeading(`Getting Around ${city.name}`) : null;
  const hFaq = addHeading("FAQs");

  const faqs = [
    {
      q: `What is the best e-bike rental shop in ${city.name}, Florida?`,
      a: `<p>${esc(best.name)} currently ranks first among the ${esc(String(city.listings.length))} ${plural(
        city.listings.length,
        "shop"
      )} we track in ${esc(city.name)}${
        best.rating ? `, rated ${formatRating(best.rating)} from ${formatReviews(best.reviews)} Google reviews` : ""
      }. See the full <a href="${attr(best.reviewUrl)}">review breakdown</a> before you call.</p>`,
    },
    {
      q: `How many e-bike rental shops are there in ${city.name}?`,
      a: `<p>We track ${esc(String(city.listings.length))} in our directory as of this writing. This page covers the top five by our ranking; <a href="${attr(
        city.url
      )}">the full ${esc(city.name)} list</a> has the rest, including every phone number, address and set of opening hours.</p>`,
    },
    {
      q: `Do ${city.name} e-bike shops offer delivery or guided tours?`,
      a: withDelivery || withTours
        ? `<p>${
            withDelivery
              ? `${esc(String(withDelivery))} of the ${esc(String(city.listings.length))} shops we track list delivery on their public profile.`
              : ""
          } ${
            withTours
              ? `${esc(String(withTours))} also run guided tours as well as renting bikes.`
              : ""
          }</p>`
        : `<p>None of the ${esc(city.name)} shops we track currently advertise delivery or guided tours on their public profile. Ask when you call - some arrange it without listing it.</p>`,
    },
    {
      q: `Is it worth booking ahead in ${city.name}?`,
      a: openSeven
        ? `<p>${esc(String(openSeven))} of the ${esc(String(city.listings.length))} shops we track post hours seven days a week, so same-day availability is common outside peak season. In season, book ahead regardless.</p>`
        : `<p>Worth it, especially on weekends. Hours vary by shop and season, and Florida beach towns book up fast in peak months.</p>`,
    },
  ];

  const body = `
${pageHero({
  crumbs,
  eyebrow: city.region,
  h1: post.title,
  lede: post.description,
})}
${byline(author, { date: post.date, updated: post.updated, readingTime: post.readingTime })}

<article class="post-body">
  <div class="wrap wrap-narrow">
    ${banner(hero, { alt: `E-bike rentals in ${city.name}, Florida - ${hero.alt}` })}
    ${tocFor(headings)}
    <div class="prose">
      <p>${esc(intro)}</p>
    </div>

    ${statRow([
      { value: String(stats.total), label: plural(stats.total, "Shop") },
      { value: stats.avgRating, label: "Average rating" },
      { value: formatReviews(stats.reviews), label: "Google reviews" },
      { value: String(withTours), label: "Tour operators" },
    ])}

    <h2 id="${attr(hBest)}">The Best E-Bike Rentals in ${esc(city.name)}</h2>
    ${mapPanel(top5, { id: `map-${attr(post.slug)}`, zoom: 12 })}
    ${listicle(top5)}

    ${adSlot(site, "")}

    <div class="prose">
      <h2 id="${attr(hWhy)}">Why Rent an E-Bike in ${esc(city.name)}</h2>
      <p>${esc(whyRent)}</p>
      <p>Before you book anywhere, confirm the class of bike, the minimum age for every rider, the
      card hold, and whether a helmet and lock are included. Our
      <a href="/blog/ebike-rental-checklist/">pre-rental checklist</a> has the full list, and
      <a href="/blog/ebike-classes-explained/">e-bike classes explained</a> covers the difference
      between the Class 1, 2 and 3 bikes you will be offered.</p>

      <h2 id="${attr(hCost)}">What It Costs to Rent in ${esc(city.name)}</h2>
      <p>Expect roughly $30 to $55 for two hours and $60 to $95 for a full day in most Florida towns,
      with weekly rates from about $200, and a card hold of $100 to $300 held rather than charged.
      Beach towns in season sit at the top of that range. Our
      <a href="/blog/ebike-rental-cost-florida/">Florida e-bike rental pricing guide</a> and
      <a href="/costs/daily-vs-weekly-ebike-rental-rates/">daily vs weekly rates guide</a> break down
      every add-on, and <a href="/costs/ebike-rental-deposits-and-card-holds/">deposits and card
      holds</a> covers what that hold actually protects.</p>

      ${
        hAround
          ? `<h2 id="${attr(hAround)}">Getting Around ${esc(city.name)}</h2>
      ${
        localTrails.length
          ? `<p>${esc(city.name)} sits on or near ${commaList(
              localTrails.map((t) => t.title)
            )} - see our ${localTrails
              .map((t) => `<a href="${attr(t.url)}">${esc(t.title.replace(/^The /, ""))} guide</a>`)
              .join(" and ")} for the route, the trailheads and the best sections to ride.</p>`
          : ""
      }
      ${
        localTopics.length
          ? `<p>Some ${esc(city.name)} shops also rent ${commaList(
              localTopics.map((t) => t.noun.replace(" rental", ""))
            )}s - see ${localTopics
              .map((t) => `<a href="${attr(t.url)}">${esc(t.label)} near ${esc(city.name)}</a>`)
              .join(" and ")}.</p>`
          : ""
      }`
          : ""
      }
    </div>

    ${
      rest.length
        ? `<div class="prose"><h2 class="mt-3">More ${esc(city.name)} rental shops</h2>
    <p class="muted">${esc(String(rest.length))} more ${plural(rest.length, "shop")} we track in ${esc(
            city.name
          )}, beyond the top five above.</p></div>
    ${linkCloud(
      [...rest]
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
        .map((l) => ({
          href: l.url,
          label: l.name,
          note: l.rating ? `- ${formatRating(l.rating)} stars from ${formatReviews(l.reviews)}` : "",
        }))
    )}`
        : ""
    }

    ${figure(extra, { alt: `Riding a rented e-bike in ${city.name}, Florida - ${extra.alt}`, className: "mt-3" })}

    <h2 id="${attr(hFaq)}" class="mt-3">FAQs</h2>
    ${faqBlock(faqs)}

    <p class="mt-3">${esc(closer)}</p>

    ${authorCard(author)}
  </div>
</article>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap">
    <h2>More ways to search ${esc(city.name)}</h2>
    ${linkCloud(
      [
        { href: city.url, label: `All e-bike rentals in ${city.name}` },
        { href: `/find/ebike-rentals-in-${city.regionSlug}/`, label: `All ${city.region} rentals` },
        ...otherServices.map((t) => ({ href: TAG_TOPIC_URL[t], label: t })),
      ].sort((a, b) => a.label.localeCompare(b.label, "en"))
    )}
    <h3 class="mt-3">Nearby towns</h3>
    ${linkCloud(
      [...near]
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
        .map((c) => ({ href: c.url, label: c.name, count: c.listings.length }))
    )}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: post.metaTitle,
    description: clamp(post.description),
    path: post.url,
    body,
    ogType: "article",
    ogImage: hero.src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      itemListSchema(site, top5, { name: post.title, url: post.url }),
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${site.url}${post.url}#article`,
        headline: post.title,
        description: post.description,
        url: `${site.url}${post.url}`,
        datePublished: isoDate(post.date),
        dateModified: isoDate(post.updated || post.date),
        inLanguage: "en-US",
        articleSection: "Best of",
        image: `${site.url}${hero.src}`,
        author: { "@type": "Person", name: author.name, url: `${site.url}${author.url}`, jobTitle: author.role },
        publisher: { "@id": `${site.url}/#organization` },
      },
    ],
  });
}
