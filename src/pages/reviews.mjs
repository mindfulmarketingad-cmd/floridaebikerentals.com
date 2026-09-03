import { esc, attr, formatRating, formatReviews, plural, clamp, ratingBlock, stars, prettyDate } from "../util.mjs";
import { page, pageHero, breadcrumbs, breadcrumbsBare, breadcrumbSchema } from "../layout.mjs";
import {
  listicle, mapPanel, faqBlock, faqSchema, linkCard, linkCloud, statRow, pagination,
  adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema, summaryFor,
} from "../components.mjs";
import { statsFor, nearbyListings } from "../data.mjs";
import { photoFor, secondPhotoFor, figure, banner } from "../images.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const REVIEWS_CRUMB = { href: "/reviews/", label: "Reviews" };
export const PER_PAGE = 60;

function scoreBars(listing) {
  const scores = listing.scores || {};
  const total = [1, 2, 3, 4, 5].reduce((sum, n) => sum + (scores[String(n)] || 0), 0) || listing.reviews || 0;
  if (!total) return "";
  return `<div class="score-bars">${[5, 4, 3, 2, 1]
    .map((n) => {
      const count = scores[String(n)] || 0;
      const pct = total ? Math.round((count / total) * 100) : 0;
      return `<div class="row">
      <span>${n} star${n === 1 ? "" : "s"}</span>
      <span class="bar"><i style="width:${pct}%"></i></span>
      <span class="num">${formatReviews(count)}</span>
    </div>`;
    })
    .join("")}</div>`;
}

/* --------------------------------------------------------- reviews hub */

export function reviewsHub(site, { listings, index, pageNumber, totalPages }) {
  const rated = listings.filter((l) => l.rating > 0 && l.reviews >= 5);
  const stats = statsFor(listings);
  const start = (pageNumber - 1) * PER_PAGE;
  const slice = rated.slice(start, start + PER_PAGE);
  const path = pageNumber === 1 ? "/reviews/" : `/reviews/page/${pageNumber}/`;
  const crumbs = [HOME_CRUMB, REVIEWS_CRUMB];
  if (pageNumber > 1) crumbs.push({ href: path, label: `Page ${pageNumber}` });

  const rows = slice
    .map(
      (l, i) => `<li class="listicle__item" data-filter-item data-city="${attr(l.city)}" data-tags="|${attr(
        (l.tags || []).join("|")
      )}|" data-search="${attr([l.name, l.city, l.region].join(" "))}" data-rating="${attr(
        l.rating
      )}" data-reviews="${attr(l.reviews)}" data-name="${attr(l.name)}">
  <div class="listicle__inner" style="grid-template-columns:1fr">
    <div class="listicle__body">
      <h3 class="listicle__title"><span class="visually-hidden">Number ${start + i + 1}: </span><a href="${attr(
        l.reviewUrl
      )}">${esc(l.name)} reviews</a></h3>
      <div>${ratingBlock(l)}</div>
      <p class="listicle__summary">${esc(l.city)}, FL · ${esc(l.region)} · ${formatReviews(
        l.reviews
      )} Google ${plural(l.reviews, "review")}${
        (l.scores && l.scores["5"])
          ? ` · ${Math.round((l.scores["5"] / (l.reviews || 1)) * 100)}% five star`
          : ""
      }</p>
      <div class="listicle__actions">
        <a class="btn btn--blue btn--sm" href="${attr(l.reviewUrl)}">Review breakdown</a>
        <a class="btn btn--outline btn--sm" href="${attr(l.url)}">Listing details</a>
      </div>
    </div>
  </div>
</li>`
    )
    .join("");

  const pages = pagination({
    pageNumber,
    totalPages,
    urlFor: (n) => (n === 1 ? "/reviews/" : `/reviews/page/${n}/`),
    ariaLabel: "Review pages",
  });

  const body = `
${pageHero({
  crumbs: crumbs,
  eyebrow: `Reviews hub`,
  h1: `${pageNumber === 1 ? "Florida E-Bike Rental Reviews" : `Florida E-Bike Rental Reviews - Page ${pageNumber}`}`,
  lede: `Star ratings and review breakdowns for every rated shop in the directory. A 4.6 built on
      forty reviews is a very different signal from a 4.6 built on four thousand — these pages show
      you which one you are looking at.`,
})}
<section class="section">
  <div class="wrap">
    ${statRow([
      { value: String(rated.length), label: "Rated shops" },
      { value: formatReviews(stats.reviews), label: "Total reviews" },
      { value: stats.avgRating, label: "Directory average" },
      { value: String(stats.cities), label: "Towns" },
    ])}
    ${banner(photoFor(`reviews-${pageNumber}`), {
      alt: `Florida e-bike rental reviews - ${photoFor(`reviews-${pageNumber}`).alt}`,
    })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <form class="filterbar" data-filter-form>
      <div class="field">
        <label for="r-q">Search this page</label>
        <input type="search" id="r-q" name="q" placeholder="Shop or town" autocomplete="off">
      </div>
      <div class="field">
        <label for="r-sort">Sort by</label>
        <select id="r-sort" name="sort">
          <option value="">Our ranking</option>
          <option value="rating">Star rating</option>
          <option value="reviews">Review count</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>
    </form>
    <p class="result-count" data-filter-count data-noun="shops" aria-live="polite"></p>
    <ol class="listicle" start="${start + 1}">${rows}</ol>
    ${pages}
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    ${figure(secondPhotoFor(`reviews-${pageNumber}`), {
      alt: `Riding a rented e-bike in Florida - ${secondPhotoFor(`reviews-${pageNumber}`).alt}`,
    })}
    <h2>How we use review data</h2>
    <div class="prose">
      <p>Every rating on this site is Google's, not ours. We do not write, solicit, edit or moderate
      reviews, and we cannot verify individual reviewers. What we add is context: the full one-to-five
      star distribution, the share of five-star reviews, and how a shop compares with others in the same
      town.</p>
      <p>Our ordering blends star rating with review volume, so a 5.0 average from three reviews does
      not outrank a 4.9 from eight hundred. A handful of reviews is not yet evidence. Read the full
      approach on our <a href="/about/">about page</a> and the limits of this data in our
      <a href="/disclaimer/">disclaimer</a>.</p>
    </div>
    <h3 class="mt-3">Browse reviews by town</h3>
    ${linkCloud(
      index.cities
        .slice(0, 50)
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
        .map((c) => ({ href: c.url, label: c.name, count: c.listings.length }))
    )}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title:
      pageNumber === 1
        ? `Florida E-Bike Rental Reviews - ${rated.length} Shops Rated`
        : `Florida E-Bike Rental Reviews - Page ${pageNumber} of ${totalPages}`,
    description: clamp(
      pageNumber === 1
        ? `Google star ratings and review breakdowns for ${rated.length} Florida e-bike and bike rental shops, with the full one-to-five star distribution for each.`
        : `Review breakdowns for Florida e-bike rental shops ${start + 1} to ${Math.min(start + PER_PAGE, rated.length)} of ${rated.length}, with the full star distribution for each shop.`
    ),
    path,
    body,
    ogImage: photoFor(`reviews-${pageNumber}`).src,
    prev: pageNumber === 2 ? "/reviews/" : pageNumber > 2 ? `/reviews/page/${pageNumber - 1}/` : "",
    next: pageNumber < totalPages ? `/reviews/page/${pageNumber + 1}/` : "",
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [breadcrumbSchema(site, crumbs), itemListSchema(site, slice, { name: "Florida e-bike rental reviews", url: path })],
  });
}

/* -------------------------------------------------------- review page */


/**
 * The ten Google reviews imported for this place, if any.
 *
 * Every field here is scraped third-party text: it is escaped, attributed to the
 * Google author, dated, and linked back to the review on Google. The block is
 * absent entirely until data/reviews.json has been imported.
 */
function reviewList(listing) {
  const reviews = listing.reviewText || [];
  if (!reviews.length) return "";
  return `<section class="panel mt-3" id="what-people-say">
  <h2>What ${esc(listing.name)} customers say</h2>
  <p class="small muted">${reviews.length} of ${formatReviews(listing.reviews)} Google
  ${plural(listing.reviews, "review")}, reproduced as written. We do not write, solicit or edit
  them.</p>
  <ol class="review-list">${reviews
    .map(
      (r) => `<li class="review-list__item">
    <div class="review-list__head">
      <span class="review-list__author">${esc(r.author)}</span>
      ${stars(r.rating)}
      ${r.date ? `<time class="review-list__date" datetime="${attr(r.date)}">${esc(prettyDate(r.date))}</time>` : ""}
    </div>
    <blockquote class="review-list__text">${esc(r.text)}</blockquote>
    ${r.owner_answer ? `<p class="review-list__reply"><strong>Reply from the shop:</strong> ${esc(r.owner_answer)}</p>` : ""}
    ${r.link ? `<p class="review-list__src"><a href="${attr(r.link)}" rel="noopener nofollow" target="_blank">Read this review on Google</a></p>` : ""}
  </li>`
    )
    .join("")}</ol>
  ${
    listing.reviews_link
      ? `<p class="mt-2 mb-0"><a class="btn btn--outline btn--sm" href="${attr(listing.reviews_link)}"
         rel="noopener nofollow" target="_blank">Read all ${formatReviews(listing.reviews)} reviews on Google</a></p>`
      : ""
  }
</section>`;
}

/** schema.org Review nodes for the imported reviews, nested on the business. */
function reviewSchema(site, listing) {
  const reviews = listing.reviewText || [];
  if (!reviews.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${site.url}${listing.url}#business`,
    name: listing.name,
    review: reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author },
      datePublished: r.date || undefined,
      reviewBody: r.text,
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    })),
  };
}

export function reviewPage(site, listing, { listings, index }) {
  const city = index.citiesBySlug.get(listing.citySlug);
  const crumbs = [HOME_CRUMB, REVIEWS_CRUMB, { href: listing.reviewUrl, label: listing.name }];
  const scores = listing.scores || {};
  const total = [1, 2, 3, 4, 5].reduce((sum, n) => sum + (scores[String(n)] || 0), 0);
  const fiveShare = total ? Math.round(((scores["5"] || 0) / total) * 100) : 0;
  const lowShare = total ? Math.round((((scores["1"] || 0) + (scores["2"] || 0)) / total) * 100) : 0;
  const cityListings = city ? city.listings.filter((l) => l.rating > 0) : [];
  const cityAvg = cityListings.length
    ? cityListings.reduce((sum, l) => sum + l.rating, 0) / cityListings.length
    : 0;
  const rankInCity = city ? city.listings.findIndex((l) => l.slug === listing.slug) + 1 : 0;
  const nearby = nearbyListings(listing, listings, 6);

  const verdict = !listing.rating
    ? `${listing.name} has not gathered enough Google reviews for a star average yet.`
    : listing.reviews < 20
    ? `${listing.name} has a small review base, so treat the ${formatRating(listing.rating)}-star average as an early signal rather than a settled one.`
    : fiveShare >= 85
    ? `${listing.name} has an unusually strong review profile: ${fiveShare}% of its ${formatReviews(listing.reviews)} Google reviews are five star.`
    : fiveShare >= 70
    ? `${listing.name} has a solid review profile, with ${fiveShare}% of reviews at five stars and ${lowShare}% at one or two.`
    : `${listing.name}'s reviews are more mixed than most in the directory: ${fiveShare}% five star against ${lowShare}% at one or two stars.`;

  const faqs = [
    {
      q: `What is ${listing.name} rated on Google?`,
      a: listing.rating
        ? `<p>${esc(listing.name)} holds ${formatRating(listing.rating)} stars from ${formatReviews(
            listing.reviews
          )} Google ${plural(listing.reviews, "review")}. Of those, ${formatReviews(
            scores["5"] || 0
          )} are five star and ${formatReviews((scores["1"] || 0) + (scores["2"] || 0))} are one or two star.</p>`
        : `<p>There is no Google star average for ${esc(listing.name)} yet.</p>`,
    },
    {
      q: `How does ${listing.name} compare with other ${listing.city} shops?`,
      a: cityAvg
        ? `<p>The average rating across the ${cityListings.length} rated ${plural(
            cityListings.length,
            "shop"
          )} we track in ${esc(listing.city)} is ${cityAvg.toFixed(1)} stars. ${esc(listing.name)} sits ${
            listing.rating > cityAvg ? "above" : listing.rating < cityAvg ? "below" : "level with"
          } that${
            rankInCity ? `, ranked #${rankInCity} of ${city.listings.length} on our ${esc(listing.city)} page` : ""
          }. Compare them all on <a href="${attr(city.url)}">e-bike rentals in ${esc(listing.city)}</a>.</p>`
        : `<p>We do not have enough rated shops in ${esc(listing.city)} to draw a comparison.</p>`,
    },
    {
      q: "Are these reviews written by Florida Ebike Rentals?",
      a: `<p>No. Star ratings and review counts on this page are aggregate figures published by Google. We do not write, solicit, edit or verify individual reviews — we reproduce the distribution so you can judge the average for yourself. See our <a href="/disclaimer/">disclaimer</a>.</p>`,
    },
  ];

  const body = `
<section class="detail-hero">
  <div class="wrap">
    ${breadcrumbsBare(crumbs)}
    <h1>${esc(listing.name)} Reviews</h1>
    <div class="detail-hero__meta">
      ${listing.rating ? ratingBlock(listing) : "<span>No Google rating yet</span>"}
      <span>${esc(listing.city)}, FL</span>
      ${rankInCity ? `<span>#${rankInCity} of ${city.listings.length} in ${esc(listing.city)}</span>` : ""}
    </div>
  </div>
</section>

<div class="wrap detail-layout">
  <div>
    ${
      listing.photo
        ? `<div class="photo-hero mb-2"><img src="${attr(listing.photo)}" alt="${attr(
            `${listing.name} in ${listing.city}, Florida`
          )}" loading="eager" decoding="async" referrerpolicy="no-referrer" data-fallback="1" width="800" height="500"></div>`
        : banner(photoFor(`r-${listing.slug}`), {
            alt: `E-bike rentals in ${listing.city}, Florida - ${photoFor(`r-${listing.slug}`).alt}`,
          })
    }
    <div class="prose">
      <h2>Review summary</h2>
      <p>${esc(verdict)}</p>
      <p>${esc(summaryFor(listing))}</p>
    </div>

    ${
      total
        ? `<div class="panel mt-2">
      <h2>Star breakdown</h2>
      <div class="big-score"><strong>${formatRating(listing.rating)}</strong>
        <div>${stars(listing.rating)}<div class="small muted">${formatReviews(
            listing.reviews
          )} Google ${plural(listing.reviews, "review")}</div></div>
      </div>
      ${scoreBars(listing)}
      <p class="small muted mt-2 mb-0">${fiveShare}% five star · ${lowShare}% one or two star.
      Figures come from the shop's public Google profile and are refreshed periodically.</p>
    </div>`
        : '<div class="panel mt-2"><h2>Star breakdown</h2><p class="muted mb-0">Google has not published a rating distribution for this business yet.</p></div>'
    }

    ${reviewList(listing)}

    <div class="prose mt-3">
      <h2>What the numbers mean</h2>
      <p>Star averages compress a lot of information. A shop with ${formatReviews(
        listing.reviews
      )} reviews has been judged by far more customers than one with a dozen, and the distribution
      matters as much as the average: a rating built mostly on five-star reviews with a handful of
      one-star outliers usually reflects a good business with a few bad days, while an even spread
      across three, four and five stars suggests genuine inconsistency.</p>
      <p>Reviews also skew toward the extremes — people write when delighted or annoyed, rarely when
      a rental was simply fine. Read the recent one and two star reviews on Google itself before you
      book, and weigh them against how long ago they were written.</p>
      <p>Reviews are one input. Before renting anywhere, confirm the class of bike, the minimum age,
      the card hold and the damage and theft terms. Our
      <a href="/blog/ebike-rental-checklist/">pre-rental checklist</a> covers all of it.</p>
    </div>

    ${adSlot(site, "")}

    <h2 class="mt-3">${esc(listing.name)} review FAQs</h2>
    ${faqBlock(faqs)}

    ${figure(secondPhotoFor(`r-${listing.slug}`), {
      alt: `E-bike riding in ${listing.city}, Florida - ${secondPhotoFor(`r-${listing.slug}`).alt}`,
      caption: `Illustrative photo of e-bike riding in Florida, not of ${listing.name}.`,
      className: "figure--stock",
    })}

    <h2 class="mt-3">Compare nearby shops</h2>
    ${linkCloud(
      [...nearby]
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
        .map((l) => ({
          href: l.reviewUrl,
          label: `${l.name} reviews`,
          note: `- ${l.city}, FL${l.rating ? ` · ${l.rating.toFixed(1)} stars from ${formatReviews(l.reviews)}` : ""}`,
        }))
    )}
  </div>

  <aside class="sidebar">
    <div class="panel panel--cta">
      <h2>Full listing details</h2>
      <p class="small">Hours, address, phone number, services and map for ${esc(listing.name)}.</p>
      <p><a class="btn btn--blue btn--block" href="${attr(listing.url)}">Open the listing</a></p>
      ${
        listing.reviews_link
          ? `<p><a class="btn btn--outline btn--block" href="${attr(
              listing.reviews_link
            )}" rel="nofollow noopener" target="_blank">Read reviews on Google</a></p>`
          : ""
      }
    </div>
    <div class="panel">
      <h2>At a glance</h2>
      <dl class="datalist">
        <div><dt>Rating</dt><dd>${listing.rating ? `${formatRating(listing.rating)} / 5` : "Not rated"}</dd></div>
        <div><dt>Reviews</dt><dd>${formatReviews(listing.reviews)}</dd></div>
        ${total ? `<div><dt>Five star</dt><dd>${fiveShare}%</dd></div>` : ""}
        ${total ? `<div><dt>1-2 star</dt><dd>${lowShare}%</dd></div>` : ""}
        <div><dt>Town</dt><dd>${city ? `<a href="${attr(city.url)}">${esc(listing.city)}</a>` : esc(listing.city)}</dd></div>
        ${rankInCity ? `<div><dt>Town rank</dt><dd>#${rankInCity} of ${city.listings.length}</dd></div>` : ""}
        ${cityAvg ? `<div><dt>Town average</dt><dd>${cityAvg.toFixed(1)} / 5</dd></div>` : ""}
      </dl>
    </div>
  </aside>
</div>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: listing.reviewTitle,
    description: clamp(
      listing.rating
        ? `${listing.name} in ${listing.city}, Florida is rated ${formatRating(listing.rating)} from ${formatReviews(
            listing.reviews
          )} Google reviews. See the full star breakdown and how it compares locally.`
        : `Review information for ${listing.name} in ${listing.city}, Florida, plus how it compares with other local e-bike rental shops.`
    ),
    path: listing.reviewUrl,
    body,
    ogImage: listing.photo || photoFor(`r-${listing.slug}`).src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [breadcrumbSchema(site, crumbs), faqSchema(faqs), reviewSchema(site, listing)],
  });
}
