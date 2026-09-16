import { esc, attr, clamp, slugify, plural, stars, formatReviews } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import { linkCard, linkCloud, adSlot, adSlotScript, ADSENSE_INLINE, faqBlock, faqSchema } from "../components.mjs";
import { photoFor, secondPhotoFor, figure, banner } from "../images.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const TOURS_CRUMB = { href: "/tours/", label: "Tours" };

function safeUrl(url) {
  const value = String(url || "").trim();
  return /^https?:\/\//i.test(value) && !/["<>\s]/.test(value) ? value : "";
}

function money(amount, currency) {
  const number = Number(amount);
  if (!Number.isFinite(number)) return "";
  return `${currency === "USD" ? "$" : ""}${number.toLocaleString("en-US", {
    minimumFractionDigits: number % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Minutes, so duration can be filtered and sorted numerically. */
function durationMinutes(text) {
  const value = String(text || "");
  const hours = /(\d+(?:\.\d+)?)\s*hour/i.exec(value);
  const mins = /(\d+)\s*min/i.exec(value);
  const total = (hours ? parseFloat(hours[1]) * 60 : 0) + (mins ? parseInt(mins[1], 10) : 0);
  return total || null;
}

const KID_HINTS = /kid|child|famil/i;

/**
 * Only offer a facet when it can actually narrow the list. With a handful of
 * tours most of these stay hidden; they appear as the catalogue grows.
 */
function buildFacets(tours) {
  const facets = [];

  const regions = [...new Set(tours.map((t) => t.region).filter(Boolean))].sort();
  if (regions.length > 1) {
    facets.push({
      field: "region",
      mode: "exact",
      label: "Region",
      options: regions.map((r) => ({ value: r, label: r })),
    });
  }

  const prices = tours.map((t) => Number(t.price)).filter(Number.isFinite);
  if (new Set(prices).size > 1) {
    const max = Math.max(...prices);
    const thresholds = [50, 75, 100, 150, 200].filter((t) => t < max);
    if (thresholds.length) {
      facets.push({
        field: "price",
        mode: "max",
        label: "Max price",
        options: thresholds.map((t) => ({ value: String(t), label: `Under $${t}` })),
      });
    }
  }

  const durations = tours.map((t) => durationMinutes(t.duration)).filter(Boolean);
  if (new Set(durations).size > 1) {
    const cuts = [120, 180, 240, 360].filter((c) => c < Math.max(...durations));
    if (cuts.length) {
      facets.push({
        field: "minutes",
        mode: "max",
        label: "Max length",
        options: cuts.map((c) => ({ value: String(c), label: `Under ${c / 60} hours` })),
      });
    }
  }

  // A feature is only worth filtering on when some tours have it and some do not.
  const counts = new Map();
  for (const tour of tours) for (const f of tour.features || []) counts.set(f, (counts.get(f) || 0) + 1);
  const splitting = [...counts.entries()]
    .filter(([, n]) => n > 0 && n < tours.length)
    .map(([f]) => f)
    .sort();
  if (splitting.length) {
    facets.push({
      field: "features",
      mode: "contains",
      label: "Includes",
      options: splitting.map((f) => ({ value: f, label: f })),
    });
  }

  return facets;
}

function tourCard(tour, rank, currency) {
  const url = safeUrl(tour.url);
  const price = money(tour.price, currency);
  const minutes = durationMinutes(tour.duration);
  const kidFriendly = (tour.features || []).some((f) => KID_HINTS.test(f)) ? "1" : "0";

  const facts = [
    tour.location ? `<li><b>Where</b> <span>${esc(tour.location)}, FL</span></li>` : "",
    tour.duration ? `<li><b>Length</b> <span>${esc(tour.duration)}</span></li>` : "",
    price ? `<li><b>Price</b> <span>${esc(price)} ${esc(tour.priceUnit || "per person")}</span></li>` : "",
    tour.languages ? `<li><b>Language</b> <span>${esc(tour.languages)}</span></li>` : "",
    tour.bookedAhead ? `<li><b>Books up</b> <span>${esc(tour.bookedAhead)} ahead on average</span></li>` : "",
  ].filter(Boolean).join("");

  const search = [tour.name, tour.location, tour.region, ...(tour.features || [])].join(" ");
  const image = safeUrl(tour.image);

  return `<li class="listicle__item" data-filter-item data-renumber
  data-search="${attr(search)}"
  data-name="${attr(tour.name)}"
  data-region="${attr(tour.region || "")}"
  data-price="${attr(tour.price ?? "")}"
  data-minutes="${attr(minutes ?? "")}"
  data-rating="${attr(tour.rating ?? 0)}"
  data-reviews="${attr(tour.reviews ?? 0)}"
  data-score="${attr(((tour.rating || 0) * Math.log10((tour.reviews || 0) + 10)).toFixed(3))}"
  data-kids="${attr(kidFriendly)}"
  data-features="|${attr((tour.features || []).join("|"))}|">
  <div class="listicle__inner"${image ? "" : ' style="grid-template-columns:1fr"'}>
    ${
      image
        ? `<div class="listicle__media"><span class="listicle__rank" aria-hidden="true">${rank}</span>
      <img src="${attr(image)}" alt="${attr(tour.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="800" height="500"></div>`
        : ""
    }
    <div class="listicle__body">
      ${image ? "" : `<span class="listicle__rank listicle__rank--flat" aria-hidden="true">${rank}</span>`}
      <h3 class="listicle__title"><span class="visually-hidden">Number ${rank}: </span>${
        url
          ? `<a href="${attr(url)}" rel="sponsored nofollow noopener" target="_blank">${esc(tour.name)}</a>`
          : esc(tour.name)
      }</h3>
      ${
        tour.rating
          ? `<div class="rating">${stars(tour.rating)}<span>${Number(tour.rating).toFixed(1)}</span>
        <span class="rating__count">(${formatReviews(tour.reviews || 0)} ${plural(tour.reviews || 0, "review")}${
              tour.recommended ? ` · ${esc(String(tour.recommended))}% recommend it` : ""
            })</span></div>`
          : ""
      }
      ${tour.summary ? `<p class="listicle__summary">${esc(tour.summary)}</p>` : ""}
      ${
        (tour.features || []).length
          ? `<ul class="tag-row">${tour.features.map((f) => `<li><span class="tag">${esc(f)}</span></li>`).join("")}</ul>`
          : ""
      }
      <ul class="listicle__facts">${facts}</ul>
      <div class="listicle__actions">
        ${
          url
            ? `<a class="btn btn--primary btn--sm" href="${attr(url)}" rel="sponsored nofollow noopener" target="_blank">
          Check availability${price ? ` from ${esc(price)}` : ""}</a>`
            : ""
        }
        ${
          tour.citySlug
            ? `<a class="btn btn--outline btn--sm" href="/find/ebike-rentals-in-${attr(tour.citySlug)}/">Rentals in ${esc(
                tour.location
              )}</a>`
            : ""
        }
      </div>
    </div>
  </div>
</li>`;
}

export function toursHub(site, tours, ctx) {
  const crumbs = [HOME_CRUMB, TOURS_CRUMB];
  const hero = photoFor("tours");
  const extra = secondPhotoFor("tours");
  const list = tours.tours;
  const empty = list.length === 0;
  const facets = buildFacets(list);

  const ranked = list
    .slice()
    .sort((a, b) => (b.rating || 0) * Math.log10((b.reviews || 0) + 10) - (a.rating || 0) * Math.log10((a.reviews || 0) + 10));

  const regions = [...new Set(list.map((t) => t.region).filter(Boolean))];
  const prices = list.map((t) => Number(t.price)).filter(Number.isFinite);

  const facetControls = facets
    .map(
      (facet) => `<div class="field">
    <label for="f-${attr(facet.field)}">${esc(facet.label)}</label>
    <select id="f-${attr(facet.field)}" name="${attr(facet.field)}" data-filter-field="${attr(
        facet.field
      )}" data-filter-mode="${attr(facet.mode)}">
      <option value="">Any</option>
      ${facet.options.map((o) => `<option value="${attr(o.value)}">${esc(o.label)}</option>`).join("")}
    </select>
  </div>`
    )
    .join("");

  const faqs = [
    {
      q: "How do I book one of these e-bike tours?",
      a: `<p>Every tour on this page books through Viator. Select a date and party size on the tour's own page and you will see live availability and the current price. We do not take the booking ourselves — your contract is with Viator and the operator running the tour.</p>`,
    },
    {
      q: "Is a guided tour better than renting an e-bike?",
      a: `<p>It depends what you want. A tour includes the bike, the helmet and a guide who knows the route, which is worth a lot somewhere you have never ridden, and there is no deposit or card hold to deal with. Renting is cheaper per hour and you go where you like. If you would rather ride independently, our <a href="/partners/">directory of ${esc(
        String(ctx.stats.total)
      )} Florida rental shops</a> sorts itself by distance from you.</p>`,
    },
    {
      q: "Are these prices current?",
      a: `<p>Prices shown are the "from" price on the day we last checked, and each card says when that was. Viator and the operator set the price, and it moves with season and party size. The tour page always shows the live figure — treat ours as a guide.</p>`,
    },
    {
      q: "Can children come on an e-bike tour?",
      a: `<p>It varies by operator, and the minimum age is usually set by the tour rather than by Florida law. Tours offering reduced rates for children are tagged as such above. Check the age policy on the tour's own page before booking, and see our <a href="/blog/family-ebike-rentals-florida/">family riding guide</a> for what works at different ages.</p>`,
    },
  ];

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">Tours</span>
      <h1>Guided E-Bike Tours in Florida</h1>
      <p>${
        empty
          ? "Bookable guided e-bike experiences across Florida. Tours are being added to this page now."
          : `${list.length} bookable guided e-bike ${plural(list.length, "experience")}${
              regions.length > 1 ? ` across ${regions.length} Florida regions` : ""
            }${
              prices.length ? `, from ${money(Math.min(...prices), tours.currency)} per person` : ""
            }. The bike, the helmet and a guide who knows the route are included in every one.`
      }</p>
    </div>
    ${banner(hero, { alt: `Guided e-bike tours in Florida - ${hero.alt}` })}
  </div>
</section>

${
  empty
    ? `<section class="section section--tint"><div class="wrap">
    <p class="muted">No tours are listed yet. In the meantime, browse the
    <a href="/find/guided-ebike-tours-in-florida/">Florida operators who run guided rides</a> or
    <a href="/partners/">find a rental shop</a>.</p>
  </div></section>`
    : `<section class="section section--tint">
  <div class="wrap">
    <form class="filterbar" data-filter-form>
      <div class="field">
        <label for="t-q">Search tours</label>
        <input type="search" id="t-q" name="q" placeholder="Tour, town or feature" autocomplete="off">
      </div>
      ${facetControls}
      <div class="field">
        <label for="t-sort">Sort by</label>
        <select id="t-sort" name="sort">
          <option value="score">Our ranking</option>
          <option value="price-asc">Price, low to high</option>
          <option value="price">Price, high to low</option>
          <option value="rating">Star rating</option>
          <option value="reviews">Most reviewed</option>
          <option value="minutes-asc">Shortest first</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>
    </form>
    <p class="result-count" data-filter-count data-noun="tours" aria-live="polite"></p>
    <p class="muted" data-filter-empty hidden>No tours match those filters. Clear one to see more, or
    <a href="/find/guided-ebike-tours-in-florida/">browse Florida tour operators</a> instead.</p>
    <ol class="listicle">${ranked.map((tour, i) => tourCard(tour, i + 1, tours.currency)).join("")}</ol>
    <p class="small muted mt-2">${esc(tours.disclosure)}${
        list.some((t) => t.priceChecked)
          ? ` Prices last checked ${esc([...new Set(list.map((t) => t.priceChecked).filter(Boolean))].sort().pop())}.`
          : ""
      }</p>
  </div>
</section>`
}

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <div class="grid grid--2" style="align-items:center">
      ${figure(extra, { alt: `Riding a rented e-bike in Florida - ${extra.alt}` })}
      <div>
        <h2>Tour or rental?</h2>
        <p>A guided tour hands you a bike, a helmet and someone who knows where to go, with no deposit
        and no card hold. A rental is cheaper by the hour and you choose the route.</p>
        <p>If you would rather ride independently, the directory covers
        <a href="/partners/">${esc(String(ctx.stats.total))} rental shops across ${esc(
    String(ctx.stats.cities)
  )} Florida towns</a> and sorts itself by distance from wherever you are. Our
        <a href="/trails/">trail guides</a> cover where to point the bike once you have it.</p>
        <p><a class="btn btn--outline" href="/find/guided-ebike-tours-in-florida/">Florida tour operators</a></p>
      </div>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap wrap-narrow">
    <h2>Booking questions</h2>
    ${faqBlock(faqs)}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: empty
      ? "Guided E-Bike Tours in Florida"
      : `Guided E-Bike Tours in Florida - ${list.length} Bookable ${plural(list.length, "Experience")}`,
    description: clamp(
      empty
        ? "Bookable guided e-bike tours and experiences across Florida, with the bike, helmet and guide included."
        : `${list.length} bookable guided e-bike tours across Florida${
            prices.length ? ` from ${money(Math.min(...prices), tours.currency)} per person` : ""
          }. Compare price, length and reviews, then book direct.`
    ),
    path: "/tours/",
    body,
    ogImage: hero.src,
    noindex: empty,
    embeds: list.some((t) => safeUrl(t.image)) ? ["viator"] : [],
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      list.length
        ? {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Guided e-bike tours in Florida",
            url: `${site.url}/tours/`,
            numberOfItems: list.length,
            itemListElement: ranked.map((tour, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: tour.name,
              url: safeUrl(tour.url) || `${site.url}/tours/`,
            })),
          }
        : null,
    ],
  });
}
