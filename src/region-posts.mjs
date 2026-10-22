/**
 * "[x] Best Ebike Rentals in [Region] Florida" posts, one per call-flow region.
 *
 * Built from the directory data at build time, so each post stays in step with
 * the listings: x is the number of shops the post actually ranks (up to 10),
 * and every figure in it -- ratings, review counts, towns, delivery and tours
 * -- is counted from that data. Nothing about a shop is said that its Google
 * profile does not record.
 */
import { esc, attr, formatReviews, plural, slugify, clamp } from "./util.mjs";
import { listicle, linkCard } from "./components.mjs";
import { stockFor, stockImg, ownPhoto } from "./images.mjs";

/** The nine regions of the phone menu, and the site regions each covers. */
export const POST_REGIONS = [
  { name: "Miami & Fort Lauderdale", regions: ["greater-miami-and-fort-lauderdale"] },
  { name: "Florida Keys", regions: ["the-florida-keys"] },
  { name: "Palm Beach & Treasure Coast", regions: ["palm-beaches-and-treasure-coast"] },
  { name: "Orlando & Central Florida", regions: ["orlando-and-central-florida"] },
  { name: "Tampa Bay & St. Pete", regions: ["tampa-bay"] },
  { name: "Sarasota to Naples", regions: ["sarasota-and-bradenton", "southwest-florida"] },
  { name: "Panhandle, 30A & Destin", regions: ["emerald-coast-and-30a"] },
  { name: "Daytona & Space Coast", regions: ["daytona-and-the-space-coast"] },
  { name: "Jacksonville, St. Augustine & North Florida", regions: ["first-coast", "north-florida"] },
];

const MAX = 10;
const tagged = (tag) => (l) => (l.tags || []).includes(tag);
const listNames = (a) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

export function regionPosts({ listings, index, cityGuides = [], date }) {
  return POST_REGIONS.map((group) => {
    const inRegion = listings.filter((l) => group.regions.includes(l.regionSlug));
    const ranked = inRegion
      .filter((l) => l.is_rental && (l.reviews || 0) >= 10 && (l.hours || []).some((h) => !h.closed))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX);
    if (ranked.length < 3) return null;
    const n = ranked.length;
    const region = group.name;
    const withState = /Florida/.test(region) ? region : `${region} Florida`;
    const title = `${n} Best Ebike Rentals in ${withState}`;
    const slug = `best-ebike-rentals-in-${slugify(withState)}`;
    const towns = index.cities.filter((c) => group.regions.includes(c.regionSlug));
    const rankedTowns = [...new Set(ranked.map((l) => l.city))];
    const delivers = ranked.filter(tagged("Delivery available"));
    const tours = inRegion.filter(tagged("Guided tours"));
    const reviews = ranked.reduce((s, l) => s + (l.reviews || 0), 0);
    const best = ranked[0];
    const guides = cityGuides.filter((g) => group.regions.includes(g.city.regionSlug));
    const photo = group.regions.map((r) => stockFor(r)).find(Boolean);
    const headings = [];
    const h2 = (id, text) => {
      headings.push({ id, text });
      return `<h2 id="${id}">${esc(text)}</h2>`;
    };

    const html = `
<p>We list ${inRegion.length} bike and e-bike rental shops across ${esc(group.name)}, in ${towns.length} towns with
their own page. These are the ${n} we rank highest: rental shops with posted hours and at least ten Google reviews,
ordered by star rating weighted against how many reviews it rests on. Together they hold ${formatReviews(reviews)}
Google reviews, and they are in ${esc(listNames(rankedTowns))}.</p>
${photo && photo.width >= 1000 ? `<figure class="figure">${stockImg(photo, { alt: `${region}, Florida` })}<figcaption>${esc(region)}. Photo: ${esc(photo.creator || "Openverse")}, ${esc(String(photo.license).toUpperCase())}.</figcaption></figure>` : ""}
${h2("ranking", `The ${n} best ebike rentals in ${region}`)}
${listicle(ranked)}
${h2("at-a-glance", "At a glance")}
<div class="table-wrap"><table class="data-table">
  <thead><tr><th scope="col">#</th><th scope="col">Shop</th><th scope="col">Town</th><th scope="col">Rating</th><th scope="col">Delivery</th></tr></thead>
  <tbody>${ranked
    .map(
      (l, i) => `<tr><td>${i + 1}</td><th scope="row"><a href="${attr(l.url)}">${esc(l.name)}</a></th><td>${esc(l.city)}</td><td>${
        l.rating ? `${l.rating.toFixed(1)} (${formatReviews(l.reviews)})` : "—"
      }</td><td>${tagged("Delivery available")(l) ? "Listed" : "—"}</td></tr>`
    )
    .join("")}</tbody>
</table></div>
<p>${best.name ? `${esc(best.name)} in ${esc(best.city)} leads${best.rating ? ` with ${best.rating.toFixed(1)} stars from ${formatReviews(best.reviews)} reviews` : ""}.` : ""} ${
      delivers.length
        ? `${delivers.length} of the ${n} list delivery on their Google profile: ${esc(listNames(delivers.map((l) => l.name)))}.`
        : `None of the ${n} lists delivery on its Google profile.`
    }</p>
${h2("towns", `Where to rent in ${region}`)}
<p>Every town in ${esc(group.name)} with two or more shops has its own ranked page:</p>
<ul class="pagelink-cloud">${towns
      .map((c) => `<li><a href="${attr(c.url)}">${esc(c.name)} <span class="count">${c.listings.length}</span></a></li>`)
      .join("")}</ul>
${h2("where-to-ride", `Where to ride in ${region}`)}
${
      guides.length
        ? `<p>We have route guides for ${guides.length} ${plural(guides.length, "town")} here, built from mapped bike paths:</p>
<ul class="pagelink-cloud">${guides
            .map((g) => `<li><a href="${attr(g.url)}">${esc(g.city.name)} <span class="count">${g.data.routes.length} routes</span></a></li>`)
            .join("")}</ul>`
        : `<p>Browse our <a href="/trails/">Florida trail guides</a> for routes, distances and surfaces.</p>`
    }
${ownPhoto()}
${h2("how-we-ranked", "How we ranked these shops")}
<p>We start from each business's public Google profile and keep only shops that rent bikes, post opening hours and
have at least ten reviews, so a brand-new listing cannot top the list on two five-star ratings. We then rank by star
rating weighted against review count. Rankings are never paid. Ratings and hours change, so check
before you go, and <a href="/contact/">tell us</a> if something here is out of date.</p>
<p>To rent anywhere in ${esc(group.name)}, send a <a href="/rent/" rel="nofollow">booking request</a> and we will find a shop that has what you need, or call our rental line on <a href="tel:+13053631922">(305) 363-1922</a>.</p>
`;

    const faqs = [
      {
        q: `Which town in ${group.name} has the most e-bike rental shops?`,
        a: towns.length
          ? `<p>${esc(towns[0].name)}, with ${towns[0].listings.length} shops in our directory${
              towns[1] ? `, followed by ${esc(towns[1].name)} with ${towns[1].listings.length}` : ""
            }.</p>`
          : `<p>Shops are spread across the region; see the list above.</p>`,
      },
      {
        q: `Are there guided e-bike tours in ${group.name}?`,
        a: tours.length
          ? `<p>Yes. ${tours.length} ${plural(tours.length, "shop")} in the region ${tours.length === 1 ? "lists" : "list"} guided tours on Google, including ${esc(
              listNames(tours.slice(0, 3).map((l) => l.name))
            )}. See all of them on our <a href="/find/ebike-tours/">e-bike tours page</a>.</p>`
          : `<p>None of the shops we list in the region advertises guided tours right now.</p>`,
      },
    ];

    return {
      slug,
      url: `/blog/${slug}/`,
      title,
      metaTitle: title,
      description: clamp(`The ${n} best ebike rentals in ${withState}, ranked by Google rating and review count. ${best.name} in ${best.city} leads.`, 160),
      date,
      updated: date,
      author: "editorial-team",
      category: "Regions",
      listicle: true,
      tags: [region, ...rankedTowns],
      readingTime: 5,
      faqs,
      html,
      headings,
      words: html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length,
    };
  }).filter(Boolean);
}
