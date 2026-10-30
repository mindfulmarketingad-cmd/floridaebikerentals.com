/**
 * /tours/ (filterable browse page of Viator experiences) and /tours/<town>/
 * (a ranked listicle for each town with enough tours to make a real list).
 *
 * Everything is rendered at build time from data/tours.json: no page calls
 * Viator, and filtering runs in the browser over the cards already in the HTML
 * (assets/js/app.js, "tours browser"). Filters read and write URL parameters,
 * so /tours/?city=miami&type=ebike is a shareable, linkable view.
 *
 * Copy rules: the operator's Viator description is never printed. Write-ups
 * are composed from the structured fields (category, duration, price, rating,
 * review count, Viator's flags) and from what the listing mentions, so every
 * claim traces back to the data. Every outbound link is an affiliate link and
 * carries rel="sponsored nofollow noopener" with a disclosure beside it.
 */
import { esc, attr, formatReviews, plural, commaList, clamp, prettyDate } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import { faqBlock, faqSchema } from "../components.mjs";
import { TOUR_CATEGORIES, categoryName } from "../tours.mjs";
import { nearbyCities } from "../data.mjs";

const YEAR = new Date().getFullYear();
const REL = 'rel="sponsored nofollow noopener" target="_blank"';
const BIKES = new Set(["ebike", "bike"]);
const isBike = (t) => BIKES.has(t.category);
const money = (n) => (n >= 100 ? `$${Math.round(n)}` : `$${Number(n).toFixed(n % 1 ? 2 : 0)}`);
const CAT_SINGULAR = {
  ebike: "E-bike tour", bike: "Bike tour", boat: "Boat trip", watersports: "Watersports",
  jetski: "Jet ski", airboat: "Airboat ride", other: "Experience",
};

/* ------------------------------------------------------------ pieces */

function tourImg(t, { eager = false } = {}) {
  if (!t.image) return `<img src="/assets/img/og-default.png" alt="" width="1200" height="630" loading="lazy" decoding="async">`;
  const w = t.imageWidth || 720;
  const h = t.imageHeight || 480;
  return `<img src="${attr(t.image)}" alt="${attr(`${t.name} in ${t.cityName}`)}" width="${w}" height="${h}" ${
    eager ? 'fetchpriority="high"' : 'loading="lazy"'
  } decoding="async">`;
}

function ratingText(t) {
  return t.rating ? `&#9733; ${esc(t.rating.toFixed(1))}${t.reviews ? ` <span>(${esc(formatReviews(t.reviews))})</span>` : ""}` : "";
}

/** One bookable card. The browse script filters and sorts on its data attributes. */
export function tourCard(t, { heading = "h3", eager = false } = {}) {
  const searchText = `${t.name} ${t.cityName} ${t.region} ${categoryName(t.category)}`.toLowerCase();
  return `<li class="tour-card" data-tour data-city="${attr(t.cityKey)}" data-type="${attr(t.category)}" data-price="${
    t.price ?? ""
  }" data-min="${t.durationMin || ""}" data-rating="${t.rating || 0}" data-reviews="${t.reviews || 0}" data-score="${t.score.toFixed(3)}" data-text="${attr(searchText)}">
  <a class="tour-card__media" href="${attr(t.url)}" ${REL} tabindex="-1" aria-hidden="true">${tourImg(t, { eager })}</a>
  <div class="tour-card__body">
    <p class="tour-card__kicker">${esc(CAT_SINGULAR[t.category] || "Experience")} &middot; ${esc(t.cityName)}</p>
    <${heading} class="tour-card__title">${esc(t.name)}</${heading}>
    <p class="tour-card__meta">${[ratingText(t), t.durationText ? esc(t.durationText) : ""].filter(Boolean).join(" &middot; ")}</p>
    ${t.price ? `<p class="tour-card__price">From <b>${esc(money(t.price))}</b> per person</p>` : ""}
    <a class="btn btn--primary btn--sm tour-card__cta" href="${attr(t.url)}" ${REL} aria-label="${attr(`Book ${t.name} on Viator (opens in a new tab)`)}">Book on Viator</a>
  </div>
</li>`;
}

export function disclosure(tours) {
  return `<p class="tour-disclosure"><strong>Affiliate disclosure:</strong> ${esc(
    tours.disclosure ||
      "Tours are booked on Viator, our affiliate partner. If you book through these links we may earn a commission, at no extra cost to you."
  )} Prices and ratings were last checked ${esc(prettyDate(tours.updated))} and can change; Viator shows the live price before you pay.</p>`;
}

/** Filter bar plus grid. `fixedCity` hides the town picker on a town's own page. */
export function tourBrowser(list, tours, { fixedCity = "", id = "tour-browser", heading = "h3" } = {}) {
  const cities = tours.cities.filter((c) => list.some((t) => t.cityKey === c.key));
  const types = TOUR_CATEGORIES.filter((c) => list.some((t) => t.category === c.key));
  const opt = (v, label) => `<option value="${attr(v)}">${esc(label)}</option>`;
  return `<div class="tour-browser" id="${attr(id)}" data-tour-browser${fixedCity ? ` data-fixed-city="${attr(fixedCity)}"` : ""}>
  <form class="tour-filters" data-tour-filters hidden aria-label="Filter tours">
    ${
      fixedCity
        ? ""
        : `<label class="tour-filters__field"><span>City</span><select name="city">${opt("", "All cities")}${cities
            .map((c) => opt(c.key, `${c.name} (${c.tours.length})`))
            .join("")}</select></label>`
    }
    <label class="tour-filters__field"><span>Type</span><select name="type">${opt("", "All types")}${types.map((c) => opt(c.key, c.name)).join("")}</select></label>
    <label class="tour-filters__field"><span>Price</span><select name="price">${opt("", "Any price")}${opt("0-50", "Under $50")}${opt("50-100", "$50 to $100")}${opt("100-200", "$100 to $200")}${opt("200-", "$200 and up")}</select></label>
    <label class="tour-filters__field"><span>Duration</span><select name="duration">${opt("", "Any length")}${opt("0-120", "Up to 2 hours")}${opt("121-240", "2 to 4 hours")}${opt("241-", "Over 4 hours")}</select></label>
    <label class="tour-filters__field"><span>Rating</span><select name="rating">${opt("", "Any rating")}${opt("4.5", "4.5 and up")}${opt("4.8", "4.8 and up")}</select></label>
    <label class="tour-filters__field"><span>Sort</span><select name="sort">${opt("", "Most popular")}${opt("price", "Price: low to high")}${opt("price-desc", "Price: high to low")}${opt("rating", "Highest rated")}${opt("duration", "Shortest first")}</select></label>
    <label class="tour-filters__field tour-filters__search"><span>Search</span><input type="search" name="q" placeholder="Dolphins, sunset, kayak…" autocomplete="off"></label>
    <button class="btn btn--outline btn--sm" type="reset" data-tour-reset>Clear filters</button>
  </form>
  <p class="tour-browser__count" data-tour-count aria-live="polite">${list.length} ${plural(list.length, "experience")}</p>
  <ul class="tour-grid" data-tour-grid>${list.map((t, i) => tourCard(t, { heading, eager: i === 0 && !fixedCity })).join("")}</ul>
  <p class="tour-browser__empty" data-tour-empty hidden>No tours match those filters. <button type="button" class="linklike" data-tour-reset>Clear filters</button></p>
</div>`;
}

/* ------------------------------------------------------------ write-ups */

const MENTIONS = [
  [/dolphin/i, "dolphins"], [/manatee/i, "manatees"], [/mangrove/i, "mangroves"], [/sunset/i, "sunset"],
  [/sandbar/i, "a sandbar"], [/shark/i, "sharks"], [/snorkel/i, "snorkeling"], [/alligator|\bgators?\b/i, "alligators"],
  [/histor|heritage/i, "local history"], [/mural|street art|public art|\bart\b/i, "public art"], [/architect/i, "architecture"],
  [/state park/i, "a state park"], [/wildlife/i, "wildlife"], [/\bsprings?\b/i, "the springs"], [/lighthouse/i, "a lighthouse"],
  [/everglades/i, "the Everglades"], [/downtown/i, "downtown"], [/clear kayak|clear-bottom|glass[- ]bottom/i, "clear-bottom views"],
  [/brew|beer|food|tasting|lunch|picnic/i, "food or drink stops"], [/beach/i, "the beach"], [/island/i, "islands"], [/bridge|skyway/i, "bridge views"],
];
export function mentionsOf(t) {
  const text = `${t.name} ${t.summary || ""}`;
  return MENTIONS.filter(([re]) => re.test(text)).map(([, label]) => label).slice(0, 4);
}
const isFamily = (t) => /\bkids?\b|child|family|families/i.test(`${t.name} ${t.summary || ""}`) || t.features.some((f) => /kids/i.test(f));
const isSunset = (t) => /sunset|scenic|sightseeing/i.test(`${t.name} ${t.summary || ""}`);
const isPrivate = (t) => /\bprivate\b/i.test(t.name) || t.features.includes("Private tour");

const OPENERS = {
  ebike: [
    (c) => `A guided e-bike ride is the low-sweat way to cover more of ${c} than a walk allows. The motor flattens headwinds and bridges, so riders of mixed fitness can stay together.`,
    (c) => `Good for first-time e-bike riders and anyone who wants a local to set the route: you get a bike and a guide, and the pedal assist means nobody in the group falls behind.`,
    (c) => `If you would rather see ${c} from the saddle than from a car window, this is the e-bike pick. Pedal assist keeps the effort easy enough to look around rather than at the road.`,
  ],
  bike: [
    (c) => `A pedal-powered way to see ${c} at street level, for riders comfortable on a regular bike for a couple of hours.`,
    (c) => `For people who like to earn the view: an ordinary bike, a set route and time to stop and look around ${c}.`,
  ],
  boat: [
    (c) => `No pedaling and no paddling: a seat on the water and someone else at the helm, which makes it an easy pick for mixed groups in ${c}.`,
    (c) => `A relaxed on-the-water option for the day you want a break from the bike, with ${c}'s shoreline as the backdrop.`,
  ],
  watersports: [
    (c) => `For people who want to be in or on the water themselves rather than watching from a deck. Expect to get a little wet.`,
    (c) => `A hands-on water outing near ${c}, best for active travelers who are comfortable with a paddle or a mask.`,
  ],
  jetski: [
    () => `The fast one on the list: speed, spray and open water. It suits thrill-seekers more than anyone hoping for a quiet look at wildlife.`,
    (c) => `A high-energy way to see the water around ${c}, for adults and older teens who want to drive rather than ride along.`,
  ],
  airboat: [
    () => `Airboats are the classic way to see Florida's wetlands up close, skimming over shallow water a regular boat cannot reach.`,
    () => `A loud, quick, uniquely Florida ride through the marsh, and an easy add-on for visitors who will not be back soon.`,
  ],
  other: [
    (c) => `Not a bike or boat outing, but one of the better-reviewed things to book in and around ${c}.`,
  ],
};

const TIPS = {
  ebike: [
    "Book a morning slot from May to September: Florida afternoons are hot, and summer thunderstorms often build after lunch.",
    "Wear closed-toe shoes and bring a refillable water bottle; most riders are surprised how much sun they get even at an easy pace.",
    "If anyone in your group has never ridden an e-bike, say so when you book, so the guide can start with a quick practice loop.",
  ],
  bike: ["Wear padded shorts or bring a seat cover if you do not ride often, and start early to beat the heat."],
  boat: ["Bring a light layer and polarized sunglasses: wind and glare on open water catch people out even on warm days."],
  watersports: ["Pack a dry bag for your phone and reef-safe sunscreen, and wear something you do not mind getting wet."],
  jetski: [
    "Florida requires a boater safety ID for anyone born on or after January 1, 1988 who drives a jet ski; check what the operator issues before you go.",
  ],
  airboat: ["Airboat engines are loud, so bring or ask for ear protection, especially for children."],
  other: ["Read the meeting point and what is included on the Viator page before you book."],
};

const pick = (list, seed) => list[[...String(seed)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % list.length];

/** An original 80-150 word write-up from the tour's structured data. */
export function writeUp(t, cityName) {
  const seed = t.productCode || t.name;
  const rental = /\brentals?\b|\bhire\b/i.test(t.name);
  const parts = [
    rental && isBike(t)
      ? `Not a guided tour but a ${t.category === "ebike" ? "e-bike" : "bike"} rental booked through Viator: you choose the route around ${cityName} and set your own pace, which suits confident riders and longer stays.`
      : rental && t.category === "jetski"
        ? `A self-drive rental rather than a guided run, for confident adults who want open water around ${cityName} on their own terms.`
        : pick(OPENERS[t.category] || OPENERS.other, seed)(cityName),
  ];
  const seen = mentionsOf(t);
  if (seen.length) parts.push(`The listing highlights ${commaList(seen)}.`);
  if (isFamily(t)) parts.push("It is pitched at families, so it is one of the easier picks if you are traveling with kids.");
  else if (isPrivate(t)) parts.push("It runs as a private outing, so your group does not share the guide with strangers.");
  const facts = [];
  if (t.durationText) facts.push(`It takes about ${t.durationText}`);
  if (t.price) facts.push(`${facts.length ? "starts" : "It starts"} from ${money(t.price)} per person`);
  if (facts.length) parts.push(`${facts.join(" and ")}.`);
  if (t.rating && t.reviews) {
    parts.push(
      `Travelers rate it ${t.rating.toFixed(1)} out of 5 across ${formatReviews(t.reviews)} ${plural(t.reviews, "review")}${
        t.reviews >= 1000 ? ", one of the largest review counts in town" : t.reviews < 25 ? ", a small sample, so weigh it accordingly" : ""
      }.`
    );
  }
  const flags = [];
  if (t.features.includes("Free cancellation") || t.features.some((f) => /free cancellation/i.test(f))) flags.push("free cancellation");
  if (t.features.includes("Instant confirmation")) flags.push("instant confirmation");
  if (flags.length) parts.push(`Viator lists ${commaList(flags)}, so booking early carries little risk; check the cutoff time on the listing.`);
  let tip = pick(TIPS[t.category] || TIPS.other, seed);
  if (t.features.includes("Likely to sell out")) tip = `Viator flags this one as likely to sell out, so book a few days ahead. ${tip}`;
  let text = parts.join(" ");
  if (text.split(/\s+/).length < 70) {
    text += ` Check the meeting point on the Viator page, since ${cityName} tours do not all start in the same part of town.`;
  }
  return { text, tip };
}

/* ------------------------------------------------------------ quick picks */

function quickPicks(list) {
  const used = new Set();
  const take = (label, candidates) => {
    const t = candidates.find((c) => !used.has(c));
    if (!t) return null;
    used.add(t);
    return { label, t };
  };
  const rated = list.filter((t) => (t.rating || 0) >= 4.5 && (t.reviews || 0) >= 10);
  return [
    take("Best overall", list),
    take("Best e-bike tour", list.filter((t) => t.category === "ebike")),
    take("Best budget pick", [...rated].filter((t) => t.price).sort((a, b) => a.price - b.price)),
    take("Best for families", list.filter(isFamily)),
    take("Best for sunset & scenery", list.filter(isSunset)),
    take("Best short outing", [...rated].filter((t) => t.durationMin && t.durationMin <= 90).sort((a, b) => a.durationMin - b.durationMin)),
  ].filter(Boolean);
}

/* ------------------------------------------------------------ hub */

export function toursHub(site, tours, { index }) {
  const n = tours.tours.length;
  const bikeCount = tours.tours.filter(isBike).length;
  const pages = tours.cities.filter((c) => c.page);
  const crumbs = [{ href: "/", label: "Home" }, { href: "/tours/", label: "Tours" }];
  const title = `E-Bike Tours in Florida: Compare ${n} Bike, Boat & Water Tours`;
  const description = clamp(
    `Browse ${n} bookable Florida tours, including ${bikeCount} e-bike and bike tours, across ${tours.cities.length} cities. Filter by city, type, price, length and rating, then book on Viator.`
  );
  const body = `
${breadcrumbs(crumbs)}
<section class="section tours-hero">
  <div class="wrap">
    <h1>Florida E-Bike Tours &amp; Experiences</h1>
    <p class="lead">Guided e-bike rides, bike tours, boat trips, kayak outings and airboat runs in ${tours.cities.length} Florida
    cities, ${n} in all. Filter by city, type, price, length and rating, then book on Viator. Prefer to ride on your own? Our
    <a href="/cities/">city rental guides</a> list the local shops instead.</p>
    <nav class="tour-chips" aria-label="Tours by city">${tours.cities
      .slice(0, 16)
      .map((c) => `<a class="chip" href="${attr(c.url)}">${esc(c.name)} <span>${c.tours.length}</span></a>`)
      .join("")}</nav>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap">
    ${tourBrowser(tours.tours, tours)}
    ${disclosure(tours)}
  </div>
</section>
<section class="section section--tint">
  <div class="wrap">
    <h2>Tours by city</h2>
    <p class="muted">Each city guide ranks its best tours with quick picks, a comparison table and local tips, and links to the shops that rent bikes there.</p>
    <ul class="tour-city-list">${tours.cities
      .map(
        (c) => `<li><a href="${attr(c.url)}"><b>${esc(c.name)} tours</b> <span>${c.tours.length} ${plural(c.tours.length, "tour")}</span></a>${
          c.city ? ` <a class="tour-city-list__rent" href="${attr(c.city.url)}">Bike rentals in ${esc(c.name)}</a>` : ""
        }</li>`
      )
      .join("")}</ul>
  </div>
</section>
<section class="section">
  <div class="wrap wrap-narrow">
    <h2>Tour or rental: which suits you?</h2>
    <p>A guided tour gives you a bike, a route and someone who knows where to stop, which is ideal for a first afternoon in a new
    town. A rental is cheaper per hour and lets you set your own pace over several days. Our <a href="/find/ebike-tours/">list of
    local shops that run their own tours</a> covers operators who are not on Viator, and the <a href="/trails/">Florida trail
    guides</a> show where you can ride on your own.</p>
    <p>Before you ride, read up on <a href="/blog/florida-ebike-laws/">Florida e-bike laws</a> and run through our
    <a href="/blog/ebike-rental-checklist/">rental checklist</a>. Typical day rates are on the <a href="/costs/">cost guide</a>.</p>
  </div>
</section>`;
  return page(site, {
    title,
    description,
    path: "/tours/",
    body,
    schema: [
      breadcrumbSchema(site, crumbs),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Florida e-bike tours and experiences",
        url: `${site.url}/tours/`,
        hasPart: pages.map((c) => ({ "@type": "WebPage", name: `${c.name} tours`, url: `${site.url}${c.url}` })),
      },
    ],
    ogImage: tours.tours.find((t) => t.image)?.image || undefined,
    imageUrls: tours.tours.map((t) => t.image).filter(Boolean),
  });
}

/* ------------------------------------------------------------ town page */

function cityTitle(group) {
  const bikes = group.tours.filter(isBike).length;
  if (bikes >= 5) return `Best E-Bike & Bike Tours in ${group.name}, Florida (${YEAR})`;
  // Category order puts e-bikes first whenever the town has any.
  const top = TOUR_CATEGORIES.filter((c) => group.tours.some((t) => t.category === c.key)).slice(0, 2).map((c) => c.short);
  return `Best Tours in ${group.name}, Florida (${YEAR}): ${top.join(", ")} & More`;
}

/** Bikes first, then the rest by popularity; 5 to 12 entries. */
function ranked(group) {
  const bikes = group.tours.filter(isBike);
  const rest = group.tours.filter((t) => !isBike(t));
  return [...bikes, ...rest].slice(0, 12);
}

export function tourCityPage(site, group, tours, { index }) {
  const city = group.city;
  const list = ranked(group);
  const all = group.tours;
  const bikes = all.filter(isBike);
  const h1 = cityTitle(group);
  const crumbs = [{ href: "/", label: "Home" }, { href: "/tours/", label: "Tours" }, { href: group.url, label: group.name }];
  const prices = all.map((t) => t.price).filter(Boolean).sort((a, b) => a - b);
  const durations = all.map((t) => t.durationMin).filter(Boolean).sort((a, b) => a - b);
  const cats = TOUR_CATEGORIES.filter((c) => all.some((t) => t.category === c.key));
  const picks = quickPicks(list);
  const top = list[0];
  const shops = city ? city.listings.length : 0;
  const shopsWithTours = city ? city.listings.filter((l) => (l.tags || []).some((tag) => /tour/i.test(tag))).length : 0;
  const updated = prettyDate(tours.updated);

  const hook = bikes.length
    ? `${group.name} has ${bikes.length} bookable ${plural(bikes.length, "e-bike or bike tour", "e-bike and bike tours")} on Viator${
        all.length > bikes.length ? `, plus ${all.length - bikes.length} boat, water and other outings` : ""
      }. We ranked the best ${list.length} by traveler rating and review volume, so the ones with a real track record sit at the top.`
    : `${group.name} has no e-bike tours on Viator right now, but it has ${all.length} well-reviewed ${plural(all.length, "outing")} for the day you are off the bike. We ranked the best ${list.length} by traveler rating and review volume. To ride, pick a bike up from one of the ${shops} local rental shops we list.`;

  const items = list
    .map((t, i) => {
      const { text, tip } = writeUp(t, group.name);
      return `<li class="tour-rank" id="tour-${i + 1}">
  <div class="tour-rank__media">${tourImg(t)}</div>
  <div class="tour-rank__body">
    <h3><span class="tour-rank__n">${i + 1}.</span> ${esc(t.name)}</h3>
    <p class="tour-rank__facts">${esc(CAT_SINGULAR[t.category])}${t.durationText ? ` &middot; ${esc(t.durationText)}` : ""}${
        t.price ? ` &middot; from ${esc(money(t.price))} per person` : ""
      }${t.rating ? ` &middot; ${ratingText(t)}` : ""}</p>
    <p>${esc(text)}</p>
    <p class="tour-rank__tip"><strong>Pro tip:</strong> ${esc(tip)}</p>
    <a class="btn btn--primary" href="${attr(t.url)}" ${REL} aria-label="${attr(`Check availability for ${t.name} on Viator (opens in a new tab)`)}">Check availability on Viator</a>
  </div>
</li>`;
    })
    .join("");

  const table = `<div class="table-scroll"><table class="tour-table">
  <caption>${esc(group.name)} tours compared (prices checked ${esc(updated)})</caption>
  <thead><tr><th scope="col">#</th><th scope="col">Tour</th><th scope="col">Type</th><th scope="col">Duration</th><th scope="col">From</th><th scope="col">Rating</th></tr></thead>
  <tbody>${list
    .map(
      (t, i) => `<tr><td>${i + 1}</td><td><a href="#tour-${i + 1}">${esc(t.name)}</a></td><td>${esc(CAT_SINGULAR[t.category])}</td><td>${esc(
        t.durationText || "Varies"
      )}</td><td>${t.price ? esc(money(t.price)) : "See listing"}</td><td>${
        t.rating ? `${esc(t.rating.toFixed(1))} (${esc(formatReviews(t.reviews || 0))})` : "New"
      }</td></tr>`
    )
    .join("")}</tbody>
</table></div>`;

  const shortest = durations[0];
  const longest = durations[durations.length - 1];
  const choose = `<ul class="checklist">
  <li><strong>Pick the activity first.</strong> ${esc(group.name)}'s list covers ${esc(commaList(cats.map((c) => c.name.toLowerCase())))}. ${
    bikes.length ? "E-bike tours suit mixed-fitness groups best, because pedal assist keeps everyone together." : "For riding, rent from a local shop and set your own route."
  }</li>
  ${prices.length ? `<li><strong>Set a budget.</strong> Prices here run from ${esc(money(prices[0]))} to ${esc(money(prices[prices.length - 1]))} per person, and most private outings price by the group, so compare per-person cost for your party size.</li>` : ""}
  ${shortest ? `<li><strong>Match the length to your day.</strong> Options run from ${esc(formatMinutes(shortest))} to ${esc(formatMinutes(longest))}. Shorter outings are easier to fit around check-in, beach time or a dinner reservation.</li>` : ""}
  <li><strong>Trust volume over a perfect score.</strong> A 4.8 across hundreds of reviews tells you more than a 5.0 from a handful. Our ranking weighs both.</li>
  <li><strong>Read the cancellation terms.</strong> Weather changes fast in Florida. Many listings offer free cancellation up to a cutoff, so check it before you pay.</li>
</ul>`;

  const nearby = nearbyTourPages(group, tours, index);
  const faqs = [
    prices.length && {
      q: `How much do tours in ${group.name} cost?`,
      a: `<p>Across the ${all.length} tours we list in ${esc(group.name)}, prices start from ${esc(money(prices[0]))} and the median is about ${esc(
        money(prices[Math.floor(prices.length / 2)])
      )} per person, as checked on ${esc(updated)}. Viator shows the live price for your date before you pay.</p>`,
    },
    {
      q: `Are there e-bike tours in ${group.name}?`,
      a: bikes.length
        ? `<p>Yes. ${bikes.length} ${plural(bikes.length, "e-bike or bike tour is", "e-bike and bike tours are")} bookable on Viator, led by ${esc(bikes[0].name)}${
            bikes[0].rating ? ` (${esc(bikes[0].rating.toFixed(1))} from ${esc(formatReviews(bikes[0].reviews || 0))} reviews)` : ""
          }.${shopsWithTours ? ` ${shopsWithTours} local ${plural(shopsWithTours, "shop")} in our directory also ${shopsWithTours === 1 ? "runs" : "run"} guided rides.` : ""}</p>`
        : `<p>None are listed on Viator right now. You can rent an e-bike from ${shops ? `one of the ${shops} shops on our <a href="${attr(city.url)}">${esc(group.name)} rentals page</a>` : "a local shop"} and ride on your own.</p>`,
    },
    {
      q: `What is the highest-rated tour in ${group.name}?`,
      a: `<p>By rating weighted for review volume, it is ${esc(top.name)}${top.rating ? `, rated ${esc(top.rating.toFixed(1))} out of 5 by ${esc(formatReviews(top.reviews || 0))} travelers` : ""}.</p>`,
    },
    {
      q: `When is the best time of year for a tour in ${group.name}?`,
      a: `<p>November to April brings the most comfortable riding weather across Florida, with lower humidity and fewer storms. From June to September, book morning slots: afternoons are hot and thunderstorms are common. Atlantic hurricane season runs June 1 to November 30, so check the forecast and the cancellation terms when you book in those months.</p>`,
    },
    {
      q: `Should I book a tour or rent an e-bike in ${group.name}?`,
      a: `<p>Book a tour if you want a guide, a set route and the bike handled for you. Rent if you want to ride on your own schedule or over several days${
        city ? `; compare the ${shops} local ${plural(shops, "shop")} on our <a href="${attr(city.url)}">${esc(group.name)} bike rentals page</a>` : ""
      }.</p>`,
    },
  ].filter(Boolean);

  const body = `
${breadcrumbs(crumbs)}
<article class="section tour-article">
  <div class="wrap wrap-narrow">
    <h1>${esc(h1)}</h1>
    <p class="tour-article__updated">Last updated ${esc(updated)} &middot; prices and ratings from Viator</p>
    <figure class="tour-article__hero">${top ? tourImg(top, { eager: true }) : ""}<figcaption>${esc(top.name)}, our top pick in ${esc(group.name)}</figcaption></figure>
    <p class="lead">${esc(hook)}</p>
    ${disclosure(tours)}
    ${
      picks.length
        ? `<aside class="quick-picks" aria-labelledby="quick-picks-h"><h2 id="quick-picks-h">Quick picks</h2><ul>${picks
            .map(
              ({ label, t }) =>
                `<li><span class="quick-picks__label">${esc(label)}</span> <a href="#tour-${list.indexOf(t) + 1}">${esc(t.name)}</a>${
                  t.price ? ` <span class="muted">from ${esc(money(t.price))}</span>` : ""
                }</li>`
            )
            .join("")}</ul></aside>`
        : ""
    }
    <h2>The ${list.length} best tours in ${esc(group.name)}</h2>
    <ol class="tour-ranks">${items}</ol>
    <h2>${esc(group.name)} tours at a glance</h2>
    ${table}
    <h2>How to choose a tour in ${esc(group.name)}</h2>
    ${choose}
    <h2>Local tips for touring ${esc(group.name)}</h2>
    <ul class="checklist">
      <li><strong>Season:</strong> November to April is the most comfortable stretch for riding. In summer, go early; afternoon storms are frequent.</li>
      <li><strong>Heat and sun:</strong> carry more water than you think you need, wear sunscreen and a hat, and plan shade stops.</li>
      <li><strong>Rain:</strong> summer showers are often short. If yours is cancelled for weather, ask the operator about rescheduling before you rebook.</li>
      <li><strong>What to bring:</strong> closed-toe shoes for any bike tour, a phone in a zip bag or dry bag, ID, and a card for any deposit.</li>
      <li><strong>E-bike rules:</strong> Florida treats most e-bikes like bicycles, so bike lanes and many multi-use paths are open to them, but local rules vary. See our <a href="/blog/florida-ebike-laws/">guide to Florida e-bike laws</a>.</li>
    </ul>
    ${
      city
        ? `<div class="tour-rent-cta"><h2>Rather ride on your own?</h2><p>${shops} ${plural(shops, "shop rents", "shops rent")} bikes and e-bikes in ${esc(
            group.name
          )}. Compare prices, hours and delivery on our <a href="${attr(city.url)}">${esc(group.name)} bike rentals page</a>.</p></div>`
        : ""
    }
    <h2>${esc(group.name)} tour FAQs</h2>
    ${faqBlock(faqs)}
  </div>
</article>
${
  all.length > list.length
    ? `<section class="section section--tint"><div class="wrap"><h2>All ${all.length} tours in ${esc(group.name)}</h2>${tourBrowser(all, tours, {
        fixedCity: group.key,
        id: "all-tours",
      })}</div></section>`
    : ""
}
<section class="section">
  <div class="wrap">
    <h2>Tours near ${esc(group.name)}</h2>
    <ul class="tour-city-list">${nearby
      .map((c) => `<li><a href="${attr(c.url)}"><b>${esc(c.name)} tours</b> <span>${c.tours.length} ${plural(c.tours.length, "tour")}</span></a></li>`)
      .join("")}<li><a href="/tours/"><b>All Florida tours</b> <span>${tours.tours.length}</span></a></li></ul>
  </div>
</section>`;

  const description = clamp(
    `${bikes.length ? `${bikes.length} e-bike & bike tours` : `${all.length} tours`} in ${group.name}, FL ranked by rating: quick picks, prices from ${
      prices.length ? money(prices[0]) : "the listing"
    }, durations and tips. Book on Viator.`
  );
  const shown = [top, ...list].filter(Boolean);
  // Title tags stay inside the 70-character budget; the H1 keeps the full line.
  const title = h1.length <= 70 ? h1 : h1.replace(/: .*$/, "");
  return page(site, {
    title,
    description,
    path: group.url,
    body,
    ogImage: top?.image || undefined,
    imageUrls: [...shown, ...all].map((t) => t.image).filter(Boolean),
    schema: [
      breadcrumbSchema(site, crumbs),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: h1,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: list.length,
        itemListElement: list.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, url: `${site.url}${group.url}#tour-${i + 1}` })),
      },
      faqSchema(faqs),
    ],
  });
}

function formatMinutes(min) {
  if (min < 60) return `${min} minutes`;
  if (min >= 1440) return `${Math.round(min / 1440)} ${plural(Math.round(min / 1440), "day")}`;
  const h = Math.round((min / 60) * 2) / 2;
  return `${h} ${h === 1 ? "hour" : "hours"}`;
}

/** Other towns with tour pages: nearest first, by the directory's coordinates. */
export function nearbyTourPages(group, tours, index, count = 6) {
  const pages = tours.cities.filter((c) => c.page && c.key !== group.key);
  if (!group.city) return pages.slice(0, count);
  const order = nearbyCities(group.city, index.cities, 80).map((c) => c.slug);
  return pages
    .map((c) => ({ c, at: order.indexOf(c.citySlug) }))
    .sort((a, b) => (a.at === -1 ? 999 : a.at) - (b.at === -1 ? 999 : b.at))
    .slice(0, count)
    .map((x) => x.c);
}

/* ------------------------------------------------------------ elsewhere */

/** Homepage: a swipeable row of tours, each linking to its town's guide. */
export function homeToursCarousel(tours) {
  if (!tours.tours.length) return "";
  const bikes = tours.tours.filter(isBike).slice(0, 8);
  const rest = tours.tours.filter((t) => !isBike(t)).slice(0, 12 - bikes.length);
  const picks = [...bikes, ...rest];
  const guide = (t) => (tours.cities.find((c) => c.key === t.cityKey) || {}).url || "/tours/";
  return `<section class="section home-tours" aria-labelledby="home-tours-h">
  <div class="wrap">
    <div class="carousel-row__head">
      <h2 id="home-tours-h">Book a Florida E-Bike Tour</h2>
      <div class="carousel-row__nav">
        <button type="button" class="carousel-row__arrow" data-tours-prev aria-label="Scroll tours back">&#8249;</button>
        <button type="button" class="carousel-row__arrow" data-tours-next aria-label="Scroll tours forward">&#8250;</button>
        <a class="carousel-row__all" href="/tours/">See all ${tours.tours.length} tours</a>
      </div>
    </div>
    <p class="muted">Guided e-bike rides and other top-rated outings, bookable on Viator. Browse them all by city, price and length on our <a href="/tours/">Florida tours page</a>.</p>
    <ul class="carousel-row__track home-tours__track" data-tours-track tabindex="0" aria-label="Florida tours">${picks
      .map(
        (t) => `<li class="carousel-card tour-mini">
      <a class="carousel-card__link" href="${attr(guide(t))}">
        <span class="carousel-card__media tour-mini__media">${tourImg(t)}</span>
        <span class="carousel-card__body">
          <span class="carousel-card__name">${esc(t.name)}</span>
          ${t.rating ? `<span class="carousel-card__rating"><b>&#9733; ${esc(t.rating.toFixed(1))}</b> (${esc(formatReviews(t.reviews || 0))})</span>` : ""}
          <span class="carousel-card__town">${esc(t.cityName)}${t.price ? ` &middot; from ${esc(money(t.price))}` : ""}</span>
        </span>
      </a>
    </li>`
      )
      .join("")}</ul>
    <p class="tour-disclosure tour-disclosure--small">Tours are booked on Viator, an affiliate partner; we may earn a commission at no extra cost to you.</p>
  </div>
</section>`;
}

/** Town rentals page: its top tours and a link to the town's tour guide. */
export function cityToursSection(city, tours) {
  const group = tours.cities.find((c) => c.citySlug === city.slug);
  if (!group) return "";
  const top = ranked(group).slice(0, 3);
  return `<section class="section" id="tours">
  <div class="wrap">
    <h2>Guided tours in ${esc(city.name)}</h2>
    <p class="muted">${group.tours.length} bookable ${plural(group.tours.length, "tour")} in ${esc(city.name)}. ${
      group.page
        ? `Compare them on our <a href="${attr(group.url)}">guide to the best tours in ${esc(city.name)}</a>.`
        : `<a href="${attr(group.url)}">See ${group.tours.length === 1 ? "it" : "them all"} on the tours page</a>.`
    }</p>
    <ul class="tour-grid tour-grid--3">${top.map((t) => tourCard(t)).join("")}</ul>
    <p class="tour-disclosure tour-disclosure--small">Tours are booked on Viator, an affiliate partner; we may earn a commission at no extra cost to you.</p>
  </div>
</section>`;
}
