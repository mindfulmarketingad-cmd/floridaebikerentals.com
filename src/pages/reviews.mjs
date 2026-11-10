import {
  esc, attr, formatReviews, formatRating, plural, clamp, shortName, ratingBlock,
} from "../util.mjs";
import { page, breadcrumbs, breadcrumbsBare, breadcrumbSchema } from "../layout.mjs";
import {
  scoreBars, adSlot, adSlotScript, ADSENSE_INLINE, statRow, itemListSchema, logoMark, photo,
} from "../components.mjs";
import { isIndexableReview, reviewUrl } from "../data.mjs";
import { photoFor, secondPhotoFor, figure, banner, sceneForRegion } from "../images.mjs";
import { reviewsPanel } from "./partners.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const REVIEWS_CRUMB = { href: "/reviews/", label: "Reviews" };

/** Meta description built only from this shop's real rating record. */
export function reviewMetaDescription(listing) {
  const written = (listing.googleReviews || []).filter((r) => r && String(r.text || "").trim()).length;
  const rating = listing.rating
    ? `${formatRating(listing.rating)} stars from ${formatReviews(listing.reviews)} Google reviews`
    : "no published Google star rating";
  const quote = written ? ` ${formatReviews(written)} written ${plural(written, "review")} quoted here.` : "";
  let text = `Reviews of ${listing.name} in ${listing.city}, FL: ${rating}.${quote}`;
  if (text.length <= 160) return text;
  text = `Reviews of ${shortName(listing.name, 72)} in ${listing.city}, FL: ${rating}.${quote}`;
  if (text.length <= 160) return text;
  return clamp(`Reviews of ${shortName(listing.name, 42)} in ${listing.city}: ${rating}.`, 158);
}

function googleAnchor(listing, label) {
  if (!listing.reviews_link) return "";
  return `<a href="${attr(listing.reviews_link)}" rel="nofollow noopener" target="_blank">${esc(label)}</a>`;
}

function starCount(listing, n) {
  if (!listing.scores) return "";
  return String(listing.scores[String(n)] || 0);
}

function writtenCount(listing) {
  return (listing.googleReviews || []).filter((r) => r && String(r.text || "").trim()).length;
}

/* ---------------------------------------------------------- reviews hub */

export function reviewsHub(site, { listings, index, stats }) {
  const sorted = listings.slice().sort(
    (a, b) => (b.reviews || 0) - (a.reviews || 0) || (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name),
  );
  const cities = [...new Set(listings.map((l) => l.city).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const quoted = listings.filter((l) => writtenCount(l) > 0).length;
  const crumbs = [HOME_CRUMB, REVIEWS_CRUMB];

  const rows = sorted
    .map((l) => {
      const city = index.citiesBySlug.get(l.citySlug);
      const cityCell = city ? `<a href="${attr(city.url)}">${esc(l.city)}</a>` : esc(l.city);
      const google = l.reviews_link
        ? `<a href="${attr(l.reviews_link)}" rel="nofollow noopener" target="_blank">Google</a>`
        : `<span class="muted">&mdash;</span>`;
      const stars = [5, 4, 3, 2, 1]
        .map((n) => `<td class="num">${l.scores ? formatReviews(l.scores[String(n)] || 0) : '<span class="muted">&mdash;</span>'}</td>`)
        .join("");
      return `<tr data-filter-item data-search="${attr(`${l.name} ${l.city}`)}" data-city="${attr(l.city)}" data-name="${attr(l.name)}" data-rating="${l.rating ? attr(String(l.rating)) : ""}" data-reviews="${attr(String(l.reviews || 0))}" data-written="${attr(String(writtenCount(l)))}" data-s5="${attr(starCount(l, 5))}" data-s4="${attr(starCount(l, 4))}" data-s3="${attr(starCount(l, 3))}" data-s2="${attr(starCount(l, 2))}" data-s1="${attr(starCount(l, 1))}">
        <th scope="row"><a href="${attr(reviewUrl(l))}">${esc(l.name)}</a></th>
        <td>${cityCell}</td>
        <td class="num">${l.rating ? formatRating(l.rating) : '<span class="muted">&mdash;</span>'}</td>
        <td class="num">${formatReviews(l.reviews || 0)}</td>
        ${stars}
        <td class="num">${formatReviews(writtenCount(l))}</td>
        <td>${google}</td>
        <td><a href="${attr(l.url)}">Listing</a></td>
      </tr>`;
    })
    .join("");

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">Google reviews</span>
      <h1>Florida E-Bike Rental Reviews</h1>
      <p>${esc(String(stats.total))} shops across ${esc(String(stats.cities))} Florida towns. ${esc(
        formatReviews(stats.reviews)
      )} Google reviews in total, average rating ${esc(stats.avgRating)}. ${esc(
        String(quoted)
      )} shops have written reviews quoted on their review page. Shops with little review data are listed here too, with whatever Google has published.</p>
    </div>
    ${statRow([
      { value: String(stats.total), label: "Shops" },
      { value: String(stats.cities), label: "Towns" },
      { value: stats.avgRating, label: "Average rating" },
      { value: formatReviews(stats.reviews), label: "Google reviews" },
    ])}
    ${banner(photoFor("reviews"), { alt: `Florida e-bike rental reviews - ${photoFor("reviews").alt}` })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <form class="filterbar" data-filter-form>
      <div class="field">
        <label for="r-q">Search</label>
        <input type="search" id="r-q" name="q" placeholder="Shop or town" autocomplete="off">
      </div>
      <div class="field">
        <label for="r-city">Town</label>
        <select id="r-city" name="city">
          <option value="">All towns</option>
          ${cities.map((c) => `<option value="${attr(c)}">${esc(c)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="r-written">Written reviews</label>
        <select id="r-written" data-filter-field="written" data-filter-mode="min">
          <option value="">All shops</option>
          <option value="1">Quoted on this site</option>
        </select>
      </div>
    </form>
    <p class="result-count" data-filter-count data-noun="shops" aria-live="polite">${esc(String(listings.length))} shops</p>
    <p data-filter-empty hidden>No shops match that search.</p>
    <div class="table-wrap reviews-scroll">
      <table class="data-table reviews-table" data-sort-table>
        <caption class="visually-hidden">Google ratings and star breakdowns for every live rental shop. Star columns run from 5 stars to 1 star. Written is how many of those reviews are quoted on this site.</caption>
        <thead>
          <tr>
            <th scope="col" data-sort-key="name" data-sort-type="text">Shop</th>
            <th scope="col" data-sort-key="city" data-sort-type="text">City</th>
            <th scope="col" class="num" data-sort-key="rating">Rating</th>
            <th scope="col" class="num" data-sort-key="reviews" aria-sort="descending">Reviews</th>
            <th scope="col" class="num" data-sort-key="s5">5-star</th>
            <th scope="col" class="num" data-sort-key="s4">4-star</th>
            <th scope="col" class="num" data-sort-key="s3">3-star</th>
            <th scope="col" class="num" data-sort-key="s2">2-star</th>
            <th scope="col" class="num" data-sort-key="s1">1-star</th>
            <th scope="col" class="num" data-sort-key="written" title="Written reviews quoted on the shop's review page">Written</th>
            <th scope="col">Google</th>
            <th scope="col">Listing</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="small muted mt-2">Click a column heading to sort. Ratings, counts and star breakdowns come from each shop's public Google listing. Written reviews are quoted only when we have the text.</p>
    ${figure(secondPhotoFor("reviews"), { alt: secondPhotoFor("reviews").alt })}
  </div>
</section>
${adSlot(site, "")}
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `Florida E-Bike Rental Reviews - ${stats.total} Shops`,
    description: clamp(
      `Google ratings, star breakdowns and written reviews for ${stats.total} e-bike and bike rental shops across ${stats.cities} Florida towns.`,
      158,
    ),
    path: "/reviews/",
    body,
    ogImage: photoFor("reviews").src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      itemListSchema(
        site,
        sorted.slice(0, 100).map((l) => ({ ...l, url: reviewUrl(l) })),
        { name: "Florida e-bike rental reviews", url: "/reviews/" },
      ),
    ],
  });
}

/* ---------------------------------------------------- one shop's reviews */

function heroMedia(listing) {
  if (listing.photo || listing.logo) {
    return `<div class="photo-hero mb-2">${photo(listing, { eager: true, prefer: "photo" })}</div>`;
  }
  const scene = sceneForRegion(listing.regionSlug);
  return banner(scene, {
    alt: `E-bike rentals in ${listing.city}, Florida - ${scene.alt}`,
  });
}

/** A second content image when the hero is a single picture and there is no logo mark. */
function extraImage(listing) {
  if (listing.logo) return "";
  const shot = secondPhotoFor(`reviews-${listing.slug}`);
  return figure(shot, { alt: shot.alt });
}

function ratingPanel(listing) {
  const bars = scoreBars(listing);
  const google = googleAnchor(listing, "Reviews on Google");
  const listingAnchor = `<a href="${attr(listing.url)}">${esc(listing.name)} listing</a>`;
  if (!listing.rating && !bars) {
    return `<div class="panel">
      <h2>Google rating</h2>
      <p>Google has not published a star rating for ${esc(listing.name)}.</p>
      <p class="mb-0">${listingAnchor}${google ? ` · ${google}` : ""}</p>
    </div>`;
  }
  return `<div class="panel">
      <h2>Google rating</h2>
      ${
        listing.rating
          ? `<div class="big-score"><strong>${formatRating(listing.rating)}</strong><div>${ratingBlock(listing)}</div></div>`
          : ""
      }
      ${bars}
      <p class="small muted">Counts from the shop's public Google profile.</p>
      <p class="mb-0">${listingAnchor}${google ? ` · ${google}` : ""}</p>
    </div>`;
}

function emptyReviews(listing) {
  const google = googleAnchor(listing, "See the reviews on Google");
  const rating = listing.rating
    ? ` The public rating is ${formatRating(listing.rating)} stars from ${formatReviews(listing.reviews)} ${plural(listing.reviews, "review")}.`
    : " Google has not published a star rating for this shop.";
  return `<section class="panel mt-2" id="reviews">
      <h2>What Riders Say About ${esc(listing.name)}</h2>
      <p>No written Google reviews are stored for ${esc(listing.name)}.${rating}</p>
      <p class="mb-0"><a href="${attr(listing.url)}">See the ${esc(listing.name)} listing</a>${google ? ` · ${google}` : ""}</p>
    </section>`;
}

export function reviewPage(site, listing, { index }) {
  const city = index.citiesBySlug.get(listing.citySlug);
  const path = reviewUrl(listing);
  const quotes = reviewsPanel(listing, { all: true });
  const crumbs = [
    HOME_CRUMB,
    REVIEWS_CRUMB,
    ...(city ? [{ href: city.url, label: listing.city }] : []),
    { href: path, label: listing.name },
  ];
  const googleBtn = listing.reviews_link
    ? `<a class="btn btn--outline-light" href="${attr(listing.reviews_link)}" rel="nofollow noopener" target="_blank">Reviews on Google</a>`
    : "";

  const body = `
<section class="detail-hero">
  <div class="wrap">
    ${breadcrumbsBare(crumbs)}
    <div class="detail-hero__title">${logoMark(listing)}<h1>${esc(listing.name)} Reviews</h1></div>
    <div class="detail-hero__meta">
      ${listing.rating ? ratingBlock(listing) : "<span>No Google rating yet</span>"}
      <span>${esc(listing.address || `${listing.city}, FL`)}</span>
    </div>
    <p class="detail-hero__biz"><a class="btn btn--outline-light" href="${attr(listing.url)}">Shop listing</a> ${googleBtn}</p>
  </div>
</section>

<div class="wrap detail-layout">
  <div>
    ${heroMedia(listing)}
    ${quotes || emptyReviews(listing)}
    ${
      quotes
        ? `<p class="mt-2"><a class="btn btn--blue" href="${attr(listing.url)}">${esc(listing.name)} listing</a></p>`
        : ""
    }
    ${extraImage(listing)}
    ${adSlot(site, "")}
  </div>
  <aside class="sidebar">
    ${ratingPanel(listing)}
  </aside>
</div>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: listing.reviewTitle || `${listing.name} Reviews - ${listing.city}, FL`,
    description: reviewMetaDescription(listing),
    path,
    noindex: !isIndexableReview(listing),
    body,
    ogType: "article",
    ogImage: listing.photo || sceneForRegion(listing.regionSlug).og || sceneForRegion(listing.regionSlug).src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [breadcrumbSchema(site, crumbs)],
  });
}
