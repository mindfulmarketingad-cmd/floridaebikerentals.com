import { esc, attr, clamp, slugify, plural, stars, formatReviews } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import { linkCard, linkCloud, adSlot, adSlotScript, ADSENSE_INLINE, faqBlock, faqSchema } from "../components.mjs";
import { photoFor, secondPhotoFor, figure, banner } from "../images.mjs";
import { TOUR_CATEGORIES } from "../data.mjs";

const CATEGORY_BY_KEY = new Map(TOUR_CATEGORIES.map((c) => [c.key, c]));
const categoryOf = (tour) => CATEGORY_BY_KEY.get(tour.category) || CATEGORY_BY_KEY.get("other");

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
function buildFacets(tours, categories) {
  const facets = [];

  if (categories.length > 1) {
    facets.push({
      field: "category",
      mode: "exact",
      label: "Activity",
      options: categories.map((c) => ({ value: c.key, label: c.name })),
    });
  }

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

  // Star rating is the filter people reach for first on a list this long.
  const rated = tours.map((t) => Number(t.rating)).filter(Number.isFinite);
  if (rated.length > 1 && Math.min(...rated) < Math.max(...rated)) {
    const cuts = [4, 4.5, 4.8].filter((c) => c > Math.min(...rated) && c <= Math.max(...rated));
    if (cuts.length) {
      facets.push({
        field: "rating",
        mode: "min",
        label: "Min rating",
        options: cuts.map((c) => ({ value: String(c), label: `${c} stars and up` })),
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

  const category = categoryOf(tour);
  const search = [tour.name, tour.location, tour.region, category.name, ...(tour.features || [])].join(" ");
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
  data-category="${attr(tour.category)}"
  data-features="|${attr((tour.features || []).join("|"))}|">
  <div class="listicle__inner"${image ? "" : ' style="grid-template-columns:1fr"'}>
    ${
      image
        ? `<div class="listicle__media"><span class="listicle__rank" aria-hidden="true">${rank}</span>
      <a href="${attr(tour.url_internal)}" tabindex="-1" aria-hidden="true">
      <img src="${attr(image)}" alt="${attr(tour.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="800" height="500"></a></div>`
        : ""
    }
    <div class="listicle__body">
      ${image ? "" : `<span class="listicle__rank listicle__rank--flat" aria-hidden="true">${rank}</span>`}
      <h3 class="listicle__title"><span class="visually-hidden">Number ${rank}: </span><a href="${attr(
        tour.url_internal
      )}">${esc(tour.name)}</a></h3>
      <p class="listicle__kicker small muted">${esc(category.name)}</p>
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
        <a class="btn btn--primary btn--sm" href="${attr(tour.url_internal)}">Details${
          price ? ` from ${esc(price)}` : ""
        }</a>
        ${
          url
            ? `<a class="btn btn--outline btn--sm" href="${attr(url)}" rel="sponsored nofollow noopener" target="_blank">
          Check availability</a>`
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
  const facets = buildFacets(list, tours.categories || []);

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
      <h1>Florida Electric Bike (E-bike) Rentals &amp; Tours</h1>
      <p>${
        empty
          ? "Florida electric bike (e-bike) rentals and tours, alongside jet ski, boat and watersport experiences, are being added to this page now."
          : `Florida electric bike (e-bike) rentals and tours sit at the top of this list of
            ${list.length} bookable ${plural(list.length, "experience")}${
              regions.length > 1 ? ` across ${regions.length} Florida regions` : ""
            }${
              prices.length ? `, from ${money(Math.min(...prices), tours.currency)} per person` : ""
            }. Below them come jet ski and waverunner hire, boat charters, parasailing, kayaking and
            the rest of what there is to book on the water. Filter by activity, town, price, length
            or rating, and open any one for the full details.`
      }</p>
    </div>
    ${
      (tours.categories || []).length > 1
        ? `<ul class="tag-row tag-row--lead">${(tours.categories || [])
            .map((c) => {
              const n = list.filter((t) => t.category === c.key).length;
              return `<li><button class="tag tag--button" type="button" data-category-jump="${attr(
                c.key
              )}">${esc(c.name)} <b>${n}</b></button></li>`;
            })
            .join("")}</ul>`
        : ""
    }
    ${banner(hero, { alt: `Florida tours and rentals - ${hero.alt}` })}
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
          <option value="minutes">Longest first</option>
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
    title: "Florida Electric Bike (E-bike) Rentals & Tours",
    description: clamp(
      empty
        ? "Florida electric bike (e-bike) rentals and tours in one filterable list, alongside jet ski hire, boat charters and watersports."
        : `Florida electric bike (e-bike) rentals and tours in one filterable list of ${
            list.length
          } bookable experiences, alongside jet ski hire, boat charters and watersports${
            prices.length ? `, from ${money(Math.min(...prices), tours.currency)}` : ""
          }.`,
      170
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
            name: "Florida tours, rentals and watersports",
            url: `${site.url}/tours/`,
            numberOfItems: list.length,
            itemListElement: ranked.map((tour, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: tour.name,
              url: `${site.url}${tour.url_internal}`,
            })),
          }
        : null,
    ],
  });
}

/* ------------------------------------------------- one tour, one page */

/** The facts Viator gives us, as a definition list. Absent fields are skipped. */
function tourFacts(tour, currency) {
  const price = money(tour.price, currency);
  return [
    tour.location ? ["Where", `${tour.location}, Florida`] : null,
    tour.region ? ["Region", tour.region] : null,
    tour.duration ? ["Length", tour.duration] : null,
    price ? ["From", `${price} ${tour.priceUnit || "per person"}`] : null,
    tour.languages ? ["Language", tour.languages] : null,
    tour.bookedAhead ? ["Typically booked", `${tour.bookedAhead} ahead`] : null,
    tour.priceChecked ? ["Price checked", tour.priceChecked] : null,
  ]
    .filter(Boolean)
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`)
    .join("");
}

export function tourPage(site, tour, tours, ctx) {
  const category = categoryOf(tour);
  const crumbs = [HOME_CRUMB, TOURS_CRUMB, { href: tour.url_internal, label: tour.name }];
  const url = safeUrl(tour.url);
  const price = money(tour.price, tours.currency);
  const image = safeUrl(tour.image);
  const hero = photoFor(tour.slug);
  const extra = secondPhotoFor(tour.slug);

  /* Nearest neighbours first: same activity in the same region, then the same
     activity anywhere, so a short list never falls back to nothing. */
  const others = tours.tours.filter((t) => t.slug !== tour.slug);
  const related = [
    ...others.filter((t) => t.category === tour.category && t.region && t.region === tour.region),
    ...others.filter((t) => t.category === tour.category),
    ...others,
  ]
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, 3);

  const bookButton = url
    ? `<a class="btn btn--primary" href="${attr(url)}" rel="sponsored nofollow noopener" target="_blank">
      Check availability on Viator${price ? ` from ${esc(price)}` : ""}</a>`
    : "";

  const faqs = [
    {
      q: `How do I book ${tour.name}?`,
      a: `<p>Booking happens on Viator, not here. Pick a date and party size there and you will see live
      availability and the current price${
        price ? `, which starts at ${esc(price)} ${esc(tour.priceUnit || "per person")}` : ""
      }. Your contract is with Viator and the operator running it.</p>`,
    },
    {
      q: "Is the price on this page the price I will pay?",
      a: `<p>Treat it as a guide. ${
        tour.priceChecked
          ? `We last checked it on ${esc(tour.priceChecked)}.`
          : "It is the last figure we recorded."
      } Viator and the operator set the price and it moves with season, day and party size, so the
      figure on the booking page is the one that counts.</p>`,
    },
    {
      q: tour.category === "ebike"
        ? "Should I book this or just rent an e-bike?"
        : "Can I rent an e-bike in the same town?",
      a: `<p>${
        tour.category === "ebike"
          ? "A tour includes the bike, the helmet and a guide who knows the route, with no deposit or card hold. Renting is cheaper by the hour and you pick your own route."
          : "Yes. Plenty of visitors pair a day on the water with a ride."
      } ${
        tour.citySlug
          ? `See <a href="/find/ebike-rentals-in-${attr(tour.citySlug)}/">e-bike rentals in ${esc(
              tour.location
            )}</a>`
          : `See our <a href="/partners/">directory of ${esc(
              String(ctx.stats.total)
            )} Florida rental shops</a>`
      }, which sorts itself by distance from wherever you are.</p>`,
    },
  ];

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="product-detail">
      <div class="product-detail__media">
        ${
          image
            ? `<img src="${attr(image)}" alt="${attr(tour.name)}" width="800" height="500"
            decoding="async" fetchpriority="high" referrerpolicy="no-referrer">`
            : // No image on the Viator listing. The library photo stands in, but it
              // is captioned as a stock shot so it is never read as this operator's
              // own, and its alt text describes the photo rather than the tour.
              figure(hero, {
                eager: true,
                caption: `${hero.caption} Stock photo — Viator has no image for this listing.`,
              })
        }
      </div>
      <div>
        <span class="eyebrow">${esc(category.name)}</span>
        <h1>${esc(tour.name)}</h1>
        ${
          tour.rating
            ? `<div class="rating">${stars(tour.rating)}<span>${Number(tour.rating).toFixed(1)}</span>
          <span class="rating__count">(${formatReviews(tour.reviews || 0)} ${plural(
                tour.reviews || 0,
                "review"
              )} on Viator${tour.recommended ? ` · ${esc(String(tour.recommended))}% recommend it` : ""})</span></div>`
            : ""
        }
        ${tour.summary ? `<p class="lede muted">${esc(tour.summary)}</p>` : ""}
        ${price ? `<p class="product-detail__price">${esc(price)} <span class="small muted">${esc(
          tour.priceUnit || "per person"
        )}</span></p>` : ""}
        <p>${bookButton}</p>
        ${
          (tour.features || []).length
            ? `<ul class="tag-row">${tour.features
                .map((f) => `<li><span class="tag">${esc(f)}</span></li>`)
                .join("")}</ul>`
            : ""
        }
        <p class="small muted">${esc(tours.disclosure)}</p>
      </div>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="grid grid--2" style="align-items:start">
      <div>
        <h2>The details</h2>
        <dl class="datalist">${tourFacts(tour, tours.currency)}</dl>
        <p class="small muted">Details come from Viator's live listing for this experience and are
        refreshed when we re-import. The operator's own page is the final word on what is included,
        what to bring and the age or weight limits that apply.</p>
      </div>
      <div>
        <h2>${esc(category.name)} in Florida</h2>
        <p>${esc(category.blurb)}</p>
        ${
          tour.location
            ? `<p>This one runs out of ${esc(tour.location)}${
                tour.region ? `, on Florida's ${esc(tour.region)} stretch` : ""
              }.</p>`
            : ""
        }
        <p><a class="btn btn--outline btn--sm" href="/tours/">All Florida tours and rentals</a></p>
      </div>
    </div>
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <div class="grid grid--2" style="align-items:center">
      ${figure(extra, { alt: `Riding in ${tour.location || "Florida"} - ${extra.alt}` })}
      <div>
        <h2>Rent rather than book</h2>
        <p>If you would rather ride on your own schedule, the directory covers
        <a href="/partners/">${esc(String(ctx.stats.total))} rental shops across ${esc(
    String(ctx.stats.cities)
  )} Florida towns</a> and sorts itself by distance from wherever you are.
        ${
          tour.citySlug
            ? `Start with <a href="/find/ebike-rentals-in-${attr(tour.citySlug)}/">e-bike rentals in ${esc(
                tour.location
              )}</a>.`
            : ""
        }</p>
        <p>Our <a href="/trails/">trail guides</a> cover where to point the bike once you have it, and
        <a href="/costs/">what it costs</a> breaks down the day rates.</p>
      </div>
    </div>
  </div>
</section>

${
  related.length
    ? `<section class="section section--tint">
  <div class="wrap">
    <h2>Other experiences nearby</h2>
    <div class="grid grid--3">${related
      .map((other) =>
        linkCard({
          href: other.url_internal,
          title: other.name,
          meta: [categoryOf(other).short, other.location, money(other.price, tours.currency)]
            .filter(Boolean)
            .join(" · "),
          more: "See details",
        })
      )
      .join("")}</div>
  </div>
</section>`
    : ""
}

<section class="section">
  <div class="wrap wrap-narrow">
    <h2>Booking questions</h2>
    ${faqBlock(faqs)}
    <p class="mt-2">${bookButton}</p>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: tour.pageTitle,
    description: clamp(
      tour.summary
        ? `${tour.name} in ${tour.location || "Florida"}. ${tour.summary}`
        : `${tour.name} — a bookable ${category.short.toLowerCase()} experience in ${
            tour.location || "Florida"
          }${price ? ` from ${price} per person` : ""}.`,
      170
    ),
    path: tour.url_internal,
    body,
    ogImage: image || hero.src,
    embeds: image ? ["viator"] : [],
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: tour.name,
        url: `${site.url}${tour.url_internal}`,
        ...(image ? { image } : {}),
        ...(tour.summary ? { description: tour.summary } : {}),
        category: category.name,
        ...(tour.rating && tour.reviews
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: Number(tour.rating),
                reviewCount: Number(tour.reviews),
              },
            }
          : {}),
        ...(Number.isFinite(Number(tour.price)) && url
          ? {
              offers: {
                "@type": "Offer",
                price: Number(tour.price),
                priceCurrency: tours.currency || "USD",
                availability: "https://schema.org/InStock",
                url,
              },
            }
          : {}),
      },
    ],
  });
}
