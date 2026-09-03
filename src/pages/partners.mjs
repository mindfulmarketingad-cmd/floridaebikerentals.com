import {
  esc, attr, formatReviews, formatRating, phoneHref, hostOf, plural, clamp, commaList, ratingBlock,
} from "../util.mjs";
import { page, pageHero, breadcrumbs, breadcrumbsBare, breadcrumbSchema } from "../layout.mjs";
import {
  listicle, mapPanel, singleMap, faqBlock, faqSchema, linkCard, linkCloud, statRow, photo, pagination,
  adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema, localBusinessSchema, tagList,
  summaryFor, metaDescriptionFor,
} from "../components.mjs";
import { statsFor, nearbyListings } from "../data.mjs";
import { photoFor, secondPhotoFor, figure, banner } from "../images.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const PARTNERS_CRUMB = { href: "/partners/", label: "Partners" };
export const PER_PAGE = 40;

/* -------------------------------------------------------- partner hub */

export function partnersHub(site, { listings, index, pageNumber, totalPages }) {
  const stats = statsFor(listings);
  const start = (pageNumber - 1) * PER_PAGE;
  const slice = listings.slice(start, start + PER_PAGE);
  const path = pageNumber === 1 ? "/partners/" : `/partners/page/${pageNumber}/`;
  const crumbs = [HOME_CRUMB, PARTNERS_CRUMB];
  if (pageNumber > 1) crumbs.push({ href: path, label: `Page ${pageNumber}` });

  const pages = pagination({
    pageNumber,
    totalPages,
    urlFor: (n) => (n === 1 ? "/partners/" : `/partners/page/${n}/`),
    ariaLabel: "Partner directory pages",
  });

  const body = `
${pageHero({
  crumbs: crumbs,
  eyebrow: `Partner directory`,
  h1: `${pageNumber === 1 ? "Florida E-Bike Rental Partners" : `Florida E-Bike Rental Partners - Page ${pageNumber}`}`,
  lede: `Every rental shop, electric bike store and tour operator in the directory — ${esc(
        String(stats.total)
      )} businesses across ${esc(String(stats.cities))} Florida towns, numbered by our ranking of Google
      rating against review volume. Showing ${esc(String(start + 1))} to ${esc(
    String(Math.min(start + PER_PAGE, listings.length))
  )}.`,
})}
<section class="section">
  <div class="wrap">
    ${statRow([
      { value: String(stats.total), label: "Rental partners" },
      { value: String(stats.cities), label: "Towns covered" },
      { value: stats.avgRating, label: "Average rating" },
      { value: formatReviews(stats.reviews), label: "Google reviews" },
    ])}
    ${banner(photoFor(`partners-${pageNumber}`), {
      alt: `Florida e-bike rental partners - ${photoFor(`partners-${pageNumber}`).alt}`,
    })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap" data-nearby-sort>
    <div class="nearby-bar">
      <p data-nearby-status>Allow location and this page re-sorts to show the e-bike rentals closest to you.</p>
      <button class="btn btn--blue btn--sm" type="button" data-nearby-button>Sort by distance from me</button>
      <span class="muted small">We never send your location anywhere — the sorting happens in your browser.</span>
    </div>
    ${mapPanel(slice, { id: `map-partners-${pageNumber}`, zoom: 7 })}
    <form class="filterbar" data-filter-form>
      <div class="field">
        <label for="p-q">Search this page</label>
        <input type="search" id="p-q" name="q" placeholder="Shop name, town or service" autocomplete="off">
      </div>
      <div class="field">
        <label for="p-city">Town</label>
        <select id="p-city" name="city">
          <option value="">All towns</option>
          ${[...new Set(slice.map((l) => l.city))]
            .sort()
            .map((c) => `<option value="${attr(c)}">${esc(c)}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field">
        <label for="p-tag">Service</label>
        <select id="p-tag" name="tag">
          <option value="">All services</option>
          ${[...new Set(slice.flatMap((l) => l.tags || []))]
            .sort()
            .map((t) => `<option value="${attr(t)}">${esc(t)}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field">
        <label for="p-sort">Sort by</label>
        <select id="p-sort" name="sort">
          <option value="">Our ranking</option>
          <option value="rating">Star rating</option>
          <option value="reviews">Review count</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>
    </form>
    <p class="result-count" data-filter-count data-noun="partners" aria-live="polite"></p>
    ${listicle(slice, { start: start + 1 })}
    ${pages}
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    ${figure(secondPhotoFor(`partners-${pageNumber}`), {
      alt: `Riding a rented e-bike in Florida - ${secondPhotoFor(`partners-${pageNumber}`).alt}`,
    })}
    <h2>Jump to a town</h2>
    ${linkCloud(
      index.cities
        .slice(0, 60)
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
        .map((c) => ({ href: c.url, label: c.name, count: c.listings.length }))
    )}
    <p class="mt-2"><a class="btn btn--outline btn--sm" href="/find/">All ${esc(
      String(index.cities.length)
    )} towns</a></p>
    <h2 class="mt-3">Browse by region</h2>
    ${linkCloud(
      [...index.regions]
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
        .map((r) => ({ href: r.url, label: r.name, count: r.listings.length }))
    )}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title:
      pageNumber === 1
        ? `Florida E-Bike Rental Partners - All ${stats.total} Shops`
        : `Florida E-Bike Rental Partners - Page ${pageNumber} of ${totalPages}`,
    description: clamp(
      pageNumber === 1
        ? `The full directory of ${stats.total} e-bike and bike rental partners across ${stats.cities} Florida towns. Hours, ratings, phone numbers, services and map for every shop.`
        : `Florida e-bike rental partners ${start + 1} to ${Math.min(start + PER_PAGE, listings.length)} of ${stats.total}, ranked by Google rating and review volume, with hours, phone numbers and map.`
    ),
    path,
    body,
    ogImage: photoFor(`partners-${pageNumber}`).src,
    prev: pageNumber === 2 ? "/partners/" : pageNumber > 2 ? `/partners/page/${pageNumber - 1}/` : "",
    next: pageNumber < totalPages ? `/partners/page/${pageNumber + 1}/` : "",
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      itemListSchema(site, slice, { name: "Florida e-bike rental partners", url: path }),
    ],
  });
}

/* ------------------------------------------------------- partner page */

function hoursTable(listing) {
  if (!listing.hours || !listing.hours.length) {
    return '<p class="muted">Opening hours are not published for this business. Call before you travel.</p>';
  }
  return `<table class="hours" data-hours-today>
  <caption class="visually-hidden">Opening hours for ${esc(listing.name)}</caption>
  <tbody>
    ${listing.hours
      .map(
        (row) =>
          `<tr${row.closed ? ' class="is-closed"' : ""}><th scope="row">${esc(row.day)}</th><td>${esc(
            row.hours
          )}</td></tr>`
      )
      .join("")}
  </tbody>
</table>`;
}

function featureGroups(listing) {
  if (!listing.about || !listing.about.length) return "";
  return `<div class="feature-groups">${listing.about
    .map(
      (group) => `<div>
    <h3>${esc(group.group)}</h3>
    <ul class="tag-row">${group.items.map((i) => `<li><span class="tag">${esc(i)}</span></li>`).join("")}</ul>
  </div>`
    )
    .join("")}</div>`;
}

export function partnerPage(site, listing, { listings, index, blog }) {
  const city = index.citiesBySlug.get(listing.citySlug);
  const region = index.regionsBySlug.get(listing.regionSlug);
  const nearby = nearbyListings(listing, listings, 6);
  const crumbs = [
    HOME_CRUMB,
    PARTNERS_CRUMB,
    { href: listing.url, label: listing.name },
  ];
  const tel = phoneHref(listing.phone);
  const rankInCity = city ? city.listings.findIndex((l) => l.slug === listing.slug) + 1 : 0;

  const faqs = [
    {
      q: `Where is ${listing.name} located?`,
      a: `<p>${esc(listing.name)} is at ${esc(listing.address || `${listing.city}, Florida`)}${
        listing.neighborhood && listing.neighborhood !== listing.city
          ? `, in the ${esc(listing.neighborhood)} area of ${esc(listing.city)}`
          : ""
      }. ${
        listing.maps_link
          ? `<a href="${attr(listing.maps_link)}" rel="nofollow noopener" target="_blank">Open directions in Google Maps</a>.`
          : ""
      }</p>`,
    },
    {
      q: `What are ${listing.name}'s opening hours?`,
      a: listing.hours && listing.hours.length
        ? `<p>Published hours are: ${esc(
            listing.hours.map((h) => `${h.day} ${h.hours}`).join("; ")
          )}. Florida beach town hours change seasonally, so call ${
            listing.phone ? esc(listing.phone) : "ahead"
          } to confirm before you travel.</p>`
        : `<p>Opening hours are not published for this business. Call ${
            listing.phone ? esc(listing.phone) : "the shop"
          } before travelling.</p>`,
    },
    {
      q: `How is ${listing.name} rated?`,
      a: listing.rating
        ? `<p>${esc(listing.name)} holds ${formatRating(listing.rating)} stars from ${formatReviews(
            listing.reviews
          )} Google ${plural(listing.reviews, "review")}${
            rankInCity ? `, which places it number ${rankInCity} of ${city.listings.length} in ${esc(listing.city)}` : ""
          }. See the full star breakdown on our <a href="${attr(
            listing.reviewUrl
          )}">${esc(listing.name)} reviews page</a>.</p>`
        : `<p>This business does not have enough Google reviews to show a star rating yet. That is common for new shops and for businesses that do not ask for reviews — it is not a negative signal on its own.</p>`,
    },
    {
      q: `How do I book with ${listing.name}?`,
      a: `<p>Book direct. ${
        tel ? `Call <a href="tel:${attr(tel)}">${esc(listing.phone)}</a>` : "Contact the shop"
      }${
        listing.website
          ? ` or visit <a href="${attr(listing.website)}" rel="nofollow noopener" target="_blank">${esc(
              hostOf(listing.website)
            )}</a>`
          : ""
      }. We are a directory and do not take bookings, hold deposits or set prices — going direct is also
      how you avoid third-party booking fees.</p>`,
    },
  ];

  const body = `
<section class="detail-hero">
  <div class="wrap">
    ${breadcrumbsBare(crumbs)}
    <h1>${esc(listing.name)}</h1>
    <div class="detail-hero__meta">
      ${listing.rating ? ratingBlock(listing) : '<span>No Google rating yet</span>'}
      <span>${esc(listing.address || `${listing.city}, FL`)}</span>
      ${rankInCity ? `<span>Ranked #${rankInCity} of ${city.listings.length} in ${esc(listing.city)}</span>` : ""}
    </div>
  </div>
</section>

<div class="wrap detail-layout">
  <div>
    ${
      listing.photo
        ? `<div class="photo-hero mb-2">${photo(listing, { eager: true })}</div>`
        : banner(photoFor(listing.slug), {
            alt: `E-bike rentals in ${listing.city}, Florida - ${photoFor(listing.slug).alt}`,
          })
    }

    <div class="prose">
      <h2>About ${esc(listing.name)}</h2>
      <p>${esc(summaryFor(listing))}</p>
      ${listing.description ? `<p>${esc(listing.description)}</p>` : ""}
      <p>${esc(listing.name)} appears in our directory for ${
        city
          ? `<a href="${attr(city.url)}">e-bike rentals in ${esc(listing.city)}</a>`
          : esc(listing.city)
      }${
        region ? ` and in the wider <a href="${attr(region.url)}">${esc(listing.region)}</a> region` : ""
      }. ${
        listing.tags && listing.tags.length
          ? `Public data lists it under ${esc(commaList(listing.tags.map((t) => t.toLowerCase())))}.`
          : ""
      }</p>
      <p class="small muted">Details below come from this business's public Google listing and are
      refreshed periodically. Confirm prices, availability and rental terms directly with the shop.
      Spot an error? <a href="/contact/">Tell us</a>.</p>
    </div>

    ${featureGroups(listing) ? `<div class="panel mt-2"><h2>Services and features</h2>${featureGroups(listing)}</div>` : ""}

    ${
      typeof listing.lat === "number"
        ? `<h2 class="mt-3">Where to find ${esc(listing.name)}</h2>${singleMap(listing)}`
        : ""
    }

    <h2 class="mt-3">${esc(listing.name)} FAQs</h2>
    ${faqBlock(faqs)}

    ${adSlot(site, "")}

    ${figure(secondPhotoFor(listing.slug), {
      alt: `Riding a rented e-bike around ${listing.city}, Florida - ${secondPhotoFor(listing.slug).alt}`,
      caption: `Illustrative photo of e-bike riding in Florida, not of ${listing.name}.`,
      className: "figure--stock",
    })}

    <h2 class="mt-3">Other e-bike rentals near ${esc(listing.city)}</h2>
    ${linkCloud(
      [...nearby]
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
        .map((l) => ({
          href: l.url,
          label: l.name,
          note: `- ${l.city}, FL${typeof l.distance === "number" ? ` · ${l.distance.toFixed(1)} mi away` : ""}${
            l.rating ? ` · ${l.rating.toFixed(1)} stars` : ""
          }`,
        }))
    )}
  </div>

  <aside class="sidebar">
    <div class="panel panel--cta">
      <h2>Contact ${esc(listing.name)}</h2>
      ${tel ? `<p><a class="btn btn--blue btn--block" href="tel:${attr(tel)}">Call ${esc(listing.phone)}</a></p>` : ""}
      ${
        listing.website
          ? `<p><a class="btn btn--outline btn--block" href="${attr(
              listing.website
            )}" rel="nofollow noopener" target="_blank">Visit website</a></p>`
          : ""
      }
      ${
        listing.maps_link
          ? `<p><a class="btn btn--outline btn--block" href="${attr(
              listing.maps_link
            )}" rel="nofollow noopener" target="_blank">Get directions</a></p>`
          : ""
      }
      <p class="small muted mb-0">We do not take bookings. Contacting the shop direct avoids
      third-party fees.</p>
    </div>

    <div class="panel">
      <h2>Business details</h2>
      <dl class="datalist">
        <div><dt>Address</dt><dd>${esc(listing.address || `${listing.city}, FL`)}</dd></div>
        ${listing.phone ? `<div><dt>Phone</dt><dd>${tel ? `<a href="tel:${attr(tel)}">${esc(listing.phone)}</a>` : esc(listing.phone)}</dd></div>` : ""}
        ${
          listing.website
            ? `<div><dt>Website</dt><dd><a href="${attr(listing.website)}" rel="nofollow noopener" target="_blank">${esc(
                hostOf(listing.website)
              )}</a></dd></div>`
            : ""
        }
        <div><dt>Town</dt><dd>${city ? `<a href="${attr(city.url)}">${esc(listing.city)}</a>` : esc(listing.city)}, FL</dd></div>
        <div><dt>Region</dt><dd>${region ? `<a href="${attr(region.url)}">${esc(listing.region)}</a>` : esc(listing.region)}</dd></div>
        ${listing.type ? `<div><dt>Category</dt><dd>${esc(listing.type)}</dd></div>` : ""}
        ${listing.price_range ? `<div><dt>Price</dt><dd>${esc(listing.price_range)}</dd></div>` : ""}
        ${listing.time_spent ? `<div><dt>Typical visit</dt><dd>${esc(listing.time_spent)}</dd></div>` : ""}
        ${listing.verified ? "<div><dt>Google</dt><dd>Claimed by the owner</dd></div>" : ""}
      </dl>
      ${tagList(listing.tags, 8)}
    </div>

    <div class="panel">
      <h2>Opening hours</h2>
      ${hoursTable(listing)}
      <p class="small muted mt-2 mb-0">Seasonal hours change often in Florida. Call to confirm.</p>
    </div>

    ${
      listing.rating
        ? `<div class="panel">
      <h2>Google rating</h2>
      <div class="big-score"><strong>${formatRating(listing.rating)}</strong><div>${ratingBlock(listing)}</div></div>
      <p><a class="btn btn--outline btn--sm btn--block" href="${attr(listing.reviewUrl)}">See the review breakdown</a></p>
    </div>`
        : ""
    }
  </aside>
</div>

<div class="action-bar">
  ${tel ? `<a class="btn btn--blue" href="tel:${attr(tel)}">Call</a>` : ""}
  ${
    listing.maps_link
      ? `<a class="btn btn--outline" href="${attr(listing.maps_link)}" rel="nofollow noopener" target="_blank">Directions</a>`
      : ""
  }
  ${
    listing.website
      ? `<a class="btn btn--outline" href="${attr(listing.website)}" rel="nofollow noopener" target="_blank">Website</a>`
      : ""
  }
</div>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: listing.pageTitle,
    description: metaDescriptionFor(listing),
    path: listing.url,
    body,
    bodyAttrs: tel || listing.website || listing.maps_link ? 'class="has-action-bar"' : "",
    ogType: "business.business",
    ogImage: listing.photo || photoFor(listing.slug).src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [breadcrumbSchema(site, crumbs), localBusinessSchema(site, listing), faqSchema(faqs)],
  });
}
