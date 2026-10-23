import { esc, attr, formatReviews } from "../util.mjs";
import { sceneForRegion, stockFor, stockImg, stockCredits, ownPhoto, sitePhoto, SITE_PHOTOS } from "../images.mjs";
import { bikeIcon } from "../bike-icons.mjs";
import { page, breadcrumbs } from "../layout.mjs";
import {
  listicle, mapPanel, faqBlock, faqSchema, linkCard, linkCloud, statRow, ctaBand,
  adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema, bookingCta, photo,
} from "../components.mjs";

/** Bike style tiles: each books that style through /rent/. */
const HOME_TILES = [
  { style: "cruiser", title: "Beach Cruiser E-bikes", text: "Upright seat, wide bars and a basket. The easy choice for beach paths and town rides.", guide: "/electric-bike-types/cruiser-electric-bikes/" },
  { style: "fat-tire", title: "Fat-Tire E-bikes", text: "Wide tires for packed sand, shell paths and rougher trails.", guide: "/electric-bike-types/fat-tire-electric-bikes/" },
  { style: "step-through", title: "Step-Through E-bikes", text: "A low frame that is easy to get on and off, at any age.", guide: "/electric-bike-types/step-through-electric-bikes/" },
  { style: "hybrid", title: "Commuter E-bikes", text: "Lighter and quicker on paved trails and longer rides.", guide: "/electric-bike-types/commuter-electric-bikes/" },
  { style: "cargo", title: "Family Cargo E-bikes", text: "Room for a child seat, a kid or the beach gear.", guide: "/electric-bike-types/cargo-electric-bikes/" },
  { style: "trike", title: "Electric Trikes", text: "Three wheels and the most stable ride, for riders who want no balancing.", guide: "" },
];

const svg = (d) => `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const HOW_STEPS = [
  { title: "Request your rental", text: "Pick the town, the day, the time and the style of e-bike.", icon: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>') },
  { title: "We find the shop", text: "We contact shops in your town on your behalf and find a bike that is free.", icon: svg('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>') },
  { title: "Approve one quote", text: "You get one quote by text or email. Pay it securely online.", icon: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>') },
  { title: "We book it. You ride.", text: "We book the shop for you and send the details. Pick up and go.", icon: svg('<circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M6 17 10 9h5l3 8M10 9 8 6H6M15 9l-3 8"/>') },
];

export const HOME_FAQS = [
  {
    q: "How much does it cost to rent an e-bike in Florida?",
    a: "<p>Most Florida shops charge roughly $30 to $55 for two hours, $45 to $75 for a half day and $60 to $95 for a full 24 hours, with weekly rates between about $200 and $375. Beach towns such as Key West, Miami Beach and 30A sit at the top of those ranges, and inland cities sit below them. Deposits are usually a card hold of $100 to $300 per bike. Our <a href=\"/blog/ebike-rental-cost-florida/\">Florida e-bike rental pricing guide</a> breaks down every add-on.</p>",
  },
  {
    q: "Do I need a licence to ride an e-bike in Florida?",
    a: "<p>No. Florida treats an electric bicycle with a motor of 750 watts or less and working pedals as a bicycle, so there is no driver's licence, registration or insurance requirement for the rider. Helmets are legally required for anyone under 16, and rental shops set their own minimum ages. See our <a href=\"/blog/florida-ebike-laws/\">guide to Florida e-bike law</a>.</p>",
  },
  {
    q: "What is the difference between Class 1, Class 2 and Class 3 e-bikes?",
    a: "<p>Class 1 is pedal assist only up to 20 mph. Class 2 adds a throttle, still capped at 20 mph, and is what most Florida holiday rentals are. Class 3 assists up to 28 mph with no throttle and faces more restrictions on shared paths. Read the full comparison in <a href=\"/blog/ebike-classes-explained/\">e-bike classes explained</a>.</p>",
  },
  {
    q: "Can children ride e-bikes in Florida?",
    a: "<p>Children under 16 must wear a helmet, including passengers in a child seat or trailer. Shops set their own age rules — many require riders to be 16 or 18, and few will rent a 28 mph Class 3 bike to a teenager. Families usually rent a cargo e-bike, a child seat or a trailer for younger children. See our <a href=\"/blog/family-ebike-rentals-florida/\">family e-bike rental guide</a>.</p>",
  },
  {
    q: "Can I ride an e-bike on the beach or on the sidewalk?",
    a: "<p>Almost never on the sand, and it depends on the town for sidewalks. Florida law lets local governments restrict where e-bikes may ride, and beach towns commonly ban riding on the beach, on boardwalks and on sidewalks in commercial districts. Paved multi-use trails such as the Timpoochee Trail and the Pinellas Trail usually welcome Class 1 and Class 2 bikes. Ask your rental shop about the current local rules.</p>",
  },
  {
    q: "Do Florida e-bike rental shops deliver?",
    a: "<p>Many do, especially in beach towns where visitors stay in rental houses and condos. Delivery is sometimes included inside a set radius and otherwise costs about $20 to $50 each way. Browse shops whose profiles list delivery on our <a href=\"/find/ebike-rentals-with-delivery-in-florida/\">e-bike rentals with delivery page</a>.</p>",
  },
  {
    q: "How far can a rental e-bike go on one charge?",
    a: "<p>A typical Florida rental with a 500 to 700 watt-hour battery covers 25 to 40 miles of mixed riding, more on low assist and less on high assist, into wind, or when carrying children on a cargo bike. That comfortably covers a full day of beach town riding. If you plan a long trail day, ask whether the shop carries a spare battery.</p>",
  },
  {
    q: "Is Florida Ebike Rentals a rental company?",
    a: "<p>No. We are a free, independent directory. We do not own bikes. We list the shops that rent them, with their hours, directions and Google ratings, and when you tap Book Now we find a shop with a bike free and book it on your behalf. Read more <a href=\"/about/\">about how the site works</a>.</p>",
  },
  {
    q: "How often is the directory updated?",
    a: "<p>The whole directory is rebuilt from a fresh data import, which removes businesses marked closed and adds new ones. Between imports, details can drift, so always confirm hours and prices with the shop. If you spot something wrong, tell us on the <a href=\"/contact/\">contact page</a> and we will fix it.</p>",
  },
];

export function homePage(site, { listings, index, blog, stats }) {
  const topTen = listings.filter((l) => l.is_rental && l.reviews >= 40).slice(0, 10);
  const topCities = index.cities.slice(0, 24);

  const body = `
<section class="hero hero--photo hero--home">
  <picture class="hero__bg">
    <source type="image/avif" srcset="/assets/img/original/hero-ebike-waterfront.avif">
    <img src="/assets/img/original/hero-ebike-waterfront.jpg" alt="" width="1125" height="750" fetchpriority="high" decoding="async">
  </picture>
  <div class="wrap hero__inner">
    <div class="hero__grid hero__grid--single">
      <div>
        <span class="eyebrow" style="background:#ffd267;color:#0b1f4d">Florida's e-bike rental directory · ${esc(String(stats.total))} shops · ${esc(String(stats.cities))} towns</span>
        <p class="home-slogan">Ride Florida.<br>We book the bike.</p>
        <h1>Electric Bike Rentals in Florida - Rent Now</h1>
        <p class="lede">Find electric bike rentals, beach cruisers and guided tours in ${esc(
          String(stats.cities)
        )} Florida towns, from <a href="/blog/30a-ebike-rentals-guide/">30A and the Timpoochee Trail</a> to Key West. See <a href="/find/ebike-rentals-near-me/">e-bike rentals near me</a>, or rent an ebike today: tap Book Now and we find you a bike.</p>
        <div class="hero__actions">
          <a class="btn btn--primary btn--lg" href="/rent/">Book Now</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap home-split">
    <div class="prose">
      <span class="eyebrow">Why choose us</span>
      <h2>Why Choose Florida Ebike Rentals</h2>
      <p>One request is all it takes. Tell us the town, the day and the style of e-bike you would like. We contact
      rental shops in that town on your behalf, find one with a bike free, and send you one quote. Pay it online and
      we book the rental for you.</p>
      <p>We track <strong>${esc(String(stats.total))} rental partners across ${esc(String(stats.cities))} Florida
      towns</strong>, carrying ${esc(formatReviews(stats.reviews))} Google reviews between them, so we know which
      shops to ask. Nothing is charged until you accept a quote, and you get a full refund if you cancel 24 hours or
      more before your rental.</p>
    </div>
    ${sitePhoto("trail-ebikes-pair", { className: "home-split__photo" })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="section__head text-center" style="margin-inline:auto">
      <span class="eyebrow">Pick your ride</span>
      <h2>E-bike Rentals for Every Rider</h2>
      <p>Choose a style and we look for it at shops in your town. The style is a preference: each shop has its own
      fleet, and your quote says what it has before you pay.</p>
    </div>
    <div class="ride-tiles">
      ${HOME_TILES.map(
        (t, i) => `<article class="ride-tile ride-tile--${i % 4}">
        <div class="ride-tile__art">${bikeIcon(t.style)}</div>
        <h3>${esc(t.title)}</h3>
        <p>${esc(t.text)}</p>
        <a class="btn btn--primary" href="/rent/?service=ebike-rental&amp;style=${attr(t.style)}" rel="nofollow">Book Now</a>
        ${t.guide ? `<a class="ride-tile__more" href="${attr(t.guide)}">${esc(t.title)} guide</a>` : `<span class="ride-tile__more" aria-hidden="true">&nbsp;</span>`}
      </article>`
      ).join("")}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section__head text-center" style="margin-inline:auto">
      <span class="eyebrow">How it works</span>
      <h2>How Does Florida Ebike Rentals Work?</h2>
      <p>Four steps, no account, and we do the calling.</p>
    </div>
    <ol class="how-steps">
      ${HOW_STEPS.map(
        (s, i) => `<li><span class="how-steps__icon" aria-hidden="true">${s.icon}</span><span class="how-steps__n">${i + 1}</span><h3>${esc(
          s.title
        )}</h3><p>${esc(s.text)}</p></li>`
      ).join("")}
    </ol>
    <p class="text-center mt-2"><a class="btn btn--primary btn--lg" href="/rent/">Book Now</a></p>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="info-boxes">
      <a class="info-box" href="/rent/">
        <h3>Ride today</h3>
        <p>Send a request with today's date and a time. Same-day rentals depend on what shops have left, so the earlier you ask, the better.</p>
      </a>
      <a class="info-box" href="/find/ebike-rentals-with-delivery-in-florida/">
        <h3>Delivery to your door</h3>
        <p>Many beach-town shops deliver to rental houses and condos. See the shops whose profiles list delivery.</p>
      </a>
      <a class="info-box" href="/find/guided-ebike-tours-in-florida/">
        <h3>Guided e-bike tours</h3>
        <p>${esc(String(stats.tourOperators))} operators we list run guided rides, with the bike, helmet and a guide included.</p>
      </a>
    </div>
    <div class="photo-strip">
      ${["fat-tire-ebike-couple", "cruiser-ebikes-baskets", "step-through-comfort-ebike"]
        .map((id) => `<img src="${attr(SITE_PHOTOS[id].src)}" alt="${attr(SITE_PHOTOS[id].alt)}" width="${SITE_PHOTOS[id].width}" height="${SITE_PHOTOS[id].height}" loading="lazy" decoding="async">`)
        .join("")}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap home-split home-split--flip">
    <div>
      <span class="eyebrow">Your best choice</span>
      <h2>What Makes Florida EBike Rentals Your Best Choice</h2>
      <ul class="check-list">
        <li><strong>One request, every shop.</strong> We contact shops in your town for you instead of you calling around.</li>
        <li><strong>${esc(String(stats.total))} shops in ${esc(String(stats.cities))} towns.</strong> From the Panhandle to the Keys.</li>
        <li><strong>One clear quote.</strong> The shop's price and our booking fee are shown separately before you pay.</li>
        <li><strong>Nothing to pay up front.</strong> You are only charged when you accept a quote.</li>
        <li><strong>Full refund 24 hours out.</strong> Cancel 24 hours or more before your rental for a full refund.</li>
        <li><strong>Pick your style.</strong> Cruisers, fat-tire, step-through, cargo and more.</li>
        <li><strong>Rankings are never paid.</strong> Shop rankings come from public Google rating data.</li>
      </ul>
      <p class="mt-2"><a class="btn btn--primary btn--lg" href="/rent/">Book Now</a></p>
    </div>
    ${ownPhoto()}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="section__head text-center" style="margin-inline:auto">
      <span class="eyebrow">Ratings</span>
      <h2>Top Rated Shops We Work With</h2>
      <p>Google ratings of shops in our directory, with the number of reviews behind each one. These are the shops'
      own Google reviews, not reviews of our site.</p>
    </div>
    <div class="rating-cards">
      ${topTen.slice(0, 3).map(
        (l) => `<a class="rating-card" href="${attr(l.url)}">
        <span class="rating-card__stars" aria-hidden="true">${"&#9733;".repeat(Math.round(l.rating))}</span>
        <strong class="rating-card__score">${esc(String(l.rating))} out of 5</strong>
        <span class="rating-card__count">${esc(formatReviews(l.reviews))} Google reviews</span>
        <span class="rating-card__name">${esc(l.name)}</span>
        <span class="rating-card__town">${esc(l.city || "")}</span>
      </a>`
      ).join("")}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section__head">
      <h2>Find Ebike Rentals in Florida</h2>
      <p>Start with the region you are visiting. We group every town we list by region, and on each
      town page we rank the local shops by Google rating and review volume.</p>
    </div>
    <div class="grid grid--3">
      ${index.regions
        .map((region) =>
          linkCard({
            href: region.url,
            title: region.name,
            meta: `${region.listings.length} rental partners · ${region.cities.length + (region.thinCities || []).length} towns`,
            // A stock photo of the region where we have one confirmed to show
            // it; otherwise the illustration drawn for that coast.
            media: stockFor(region.slug)
              ? stockImg(stockFor(region.slug), { alt: `${region.name}, Florida` })
              : `<img src="${attr(sceneForRegion(region.slug).src)}" alt="" loading="lazy" decoding="async" width="1600" height="900">`,
            text: region.cities
              .slice(0, 4)
              .map((c) => c.name)
              .join(", "),
            more: "See rentals",
          })
        )
        .join("")}
    </div>
    <h3 class="mt-3">Popular Florida towns for e-bike rentals</h3>
    ${linkCloud(
      topCities.map((city) => ({
        href: city.url,
        label: `${city.name} e-bike rentals`,
        count: city.listings.length,
      }))
    )}
    <p class="mt-2"><a class="text-link" href="/find/">See all ${esc(
      String(index.cities.length)
    )} Florida towns</a></p>
  </div>
</section>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">The list</span>
      <h2>Top 10 e-bike rentals in Florida right now</h2>
      <p>Ranked by Google star rating weighted against review volume, so shops with a long track record
      outrank a perfect score from a handful of reviews.</p>
    </div>
    ${mapPanel(topTen, { id: "home-map", zoom: 7, buttonLabel: "Show map view" })}
    ${listicle(topTen, { rentOnly: true })}
    <p class="mt-2"><a class="text-link" href="/partners/">Browse all ${esc(
      String(stats.total)
    )} partners</a></p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${bookingCta(site, {
      title: "Book a guided e-bike experience in Florida",
      text: "Renting a bike and riding it yourself is one way to do it. The other is a guided tour, where the bike, the helmet and someone who knows the route are all included in the price. Guided e-bike tours run across Florida's beach towns and cities, and most are two to three hours.",
      secondary: { href: "/find/guided-ebike-tours-in-florida/", label: "See Florida tour operators" },
      asLinks: true,
    })}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="prose">
      <h2>Where e-bike riding in Florida is best</h2>
      <p>Florida is flat, which makes people assume pedal assist is unnecessary. What Florida actually
      has is distance, heat and wind, and an e-bike solves all three. The Timpoochee Trail runs the full
      length of 30A past Seaside and Rosemary Beach; our <a href="/blog/30a-ebike-rentals-guide/">30A
      e-bike rentals guide</a> covers where to rent along it. The Legacy Trail links Sarasota to Venice. The
      Pinellas Trail covers 45 miles from St. Petersburg to Tarpon Springs. Sanibel has 25 miles of path
      separated from traffic, and Key West is a town where a bike is genuinely faster than a car.</p>
      <p>Our <a href="/blog/best-ebike-rides-florida/">ten best e-bike rides in Florida</a> covers each
      of them, with the town page for renting nearby, our <a href="/trails/">trail guides</a> cover the routes
      in detail, and our <a href="/electric-bike-types/">guide to the types of electric bikes</a> helps you pick one.</p>
      <p>We are not a rental company and we hold no deposits. When you book through us, you see the shop's price and
      our booking fee separately before you pay. Read more <a href="/about/">about how the site works</a> and our
      <a href="/disclaimer/">disclaimer</a>.</p>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">Guides</span>
      <h2>Plan the ride before you book</h2>
      <p>Practical guides on Florida e-bike law, pricing, family riding and the routes worth renting for.</p>
    </div>
    <div class="grid grid--3">
      ${blog
        .slice(0, 6)
        .map((post) =>
          linkCard({
            href: post.url,
            title: post.title,
            meta: `${post.category} · ${post.readingTime || 6} min read`,
            text: post.description,
            more: "Read the guide",
          })
        )
        .join("")}
    </div>
    <p class="mt-2"><a class="text-link" href="/blog/">All guides</a></p>
  </div>
</section>

<section class="section">
  <div class="wrap wrap-narrow">
    <div class="section__head text-center" style="margin-inline:auto">
      <span class="eyebrow">FAQs</span>
      <h2>Florida e-bike rental questions, answered</h2>
    </div>
    ${faqBlock(HOME_FAQS)}
  </div>
</section>

<section class="ready-band">
  <div class="wrap ready-band__inner">
    <div>
      <h2>Ready to Ride?</h2>
      <p>Tell us the town, the day and the style of bike. We find the shop and book it for you.</p>
      <a class="btn btn--primary btn--lg" href="/rent/">Book Now</a>
    </div>
    ${sitePhoto("cruiser-ebikes-baskets", { className: "ready-band__photo" })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>Browse the directory</h2>
    <div class="grid grid--4 mt-2">
      ${linkCard({ href: "/find/", title: "Find", text: "Every Florida region and town we cover.", more: "Open Find" })}
      ${linkCard({ href: "/partners/", title: "Partners", text: "The full listicle of rental partners.", more: "Open Partners" })}
      ${linkCard({ href: "/electric-bike-types/", title: "Bike types", text: "Nine types of e-bike, compared.", more: "Open Bike Types" })}
      ${linkCard({ href: "/trails/", title: "Trails", text: "Where to ride once you have the bike.", more: "Open Trails" })}
      ${linkCard({ href: "/costs/", title: "Costs", text: "Rates, deposits, delivery and waivers.", more: "Open Costs" })}
      ${linkCard({ href: "/blog/", title: "Blog", text: "Guides, laws and city listicles.", more: "Open Blog" })}
      ${linkCard({ href: "/search/", title: "Search", text: "Search every page on the site.", more: "Open Search" })}
      ${linkCard({ href: "/authors/", title: "Authors", text: "The people who write this site.", more: "Open Authors" })}
    </div>
  </div>
</section>
${(() => {
  const credits = stockCredits(index.regions.map((r) => stockFor(r.slug)));
  return credits ? `<div class="wrap">${credits}</div>` : "";
})()}
${adSlotScript(site, 2)}
`;

  return page(site, {
    title: "Electric Bike Rentals in Florida - Rent Now",
    description: `Rent an electric bicycle ebike today in Florida. Compare ${stats.total} e-bike rental shops in ${stats.cities} towns, from 30A to Key West, or tap Book Now.`,
    path: "/",
    body,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE.repeat(2)] : [],
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${site.url}/#website`,
        url: `${site.url}/`,
        name: site.name,
        description: site.description,
        inLanguage: "en-US",
        publisher: { "@id": `${site.url}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${site.url}/search/?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${site.url}/#organization`,
        name: site.name,
        url: `${site.url}/`,
        logo: { "@type": "ImageObject", url: `${site.url}/assets/img/icon-512.png`, width: 512, height: 512 },
        description: site.description,
        areaServed: { "@type": "State", name: "Florida" },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: site.email,
          url: `${site.url}/contact/`,
          availableLanguage: "English",
        },
      },
      faqSchema(HOME_FAQS),
      itemListSchema(site, topTen, { name: "Top 10 e-bike rentals in Florida", url: "/" }),
    ],
  });
}
