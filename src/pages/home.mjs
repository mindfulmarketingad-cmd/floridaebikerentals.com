import { esc, attr, formatReviews } from "../util.mjs";
import { photoFor, secondPhotoFor, figure, banner } from "../images.mjs";
import { page, breadcrumbs } from "../layout.mjs";
import {
  listicle, mapPanel, faqBlock, faqSchema, linkCard, linkCloud, statRow, ctaBand,
  adSlot, adSlotScript, ADSENSE_INLINE, itemListSchema,
} from "../components.mjs";

export const HOME_FAQS = [
  {
    q: "How much does it cost to rent an e-bike in Florida?",
    a: "<p>Most Florida shops charge roughly $30 to $55 for two hours, $45 to $75 for a half day and $60 to $95 for a full 24 hours, with weekly rates between about $200 and $375. Beach towns such as Key West, Miami Beach and 30A sit at the top of those ranges, and inland cities sit below them. Deposits are usually a card hold of $100 to $300 per bike. Our <a href=\"/blog/ebike-rental-cost-florida/\">Florida e-bike rental pricing guide</a> breaks down every add-on.</p>",
  },
  {
    q: "Do I need a licence to ride an e-bike in Florida?",
    a: "<p>No. Florida treats an electric bicycle with a motor of 750 watts or less and working pedals as a bicycle, so there is no driver's licence, registration or insurance requirement for the rider. Class 3 e-bikes, which assist up to 28 mph, have a minimum operating age of 16, and helmets are legally required for anyone under 16. See our <a href=\"/blog/florida-ebike-laws/\">guide to Florida e-bike law</a>.</p>",
  },
  {
    q: "What is the difference between Class 1, Class 2 and Class 3 e-bikes?",
    a: "<p>Class 1 is pedal assist only up to 20 mph. Class 2 adds a throttle, still capped at 20 mph, and is what most Florida holiday rentals are. Class 3 assists up to 28 mph with no throttle and faces more restrictions on shared paths. Read the full comparison in <a href=\"/blog/ebike-classes-explained/\">e-bike classes explained</a>.</p>",
  },
  {
    q: "Can children ride e-bikes in Florida?",
    a: "<p>Children under 16 must wear a helmet, including passengers in a child seat or trailer, and nobody under 16 may operate a Class 3 e-bike. Individual shops set stricter policies — many require riders to be 16 or 18. Families usually rent a cargo e-bike, a child seat or a trailer for younger children. See our <a href=\"/blog/family-ebike-rentals-florida/\">family e-bike rental guide</a>.</p>",
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
    a: "<p>No. We are a free, independent directory. We do not own bikes, take bookings or process payments — we list the shops that do, with their hours, phone numbers, websites and Google ratings, so you can contact them directly. Read more <a href=\"/about/\">about how the site works</a>.</p>",
  },
  {
    q: "How often is the directory updated?",
    a: "<p>The whole directory is rebuilt from a fresh data import, which removes businesses marked closed and adds new ones. Between imports, details can drift, so always confirm hours and prices with the shop. If you spot something wrong, tell us on the <a href=\"/contact/\">contact page</a> and we will fix it.</p>",
  },
];

export function homePage(site, { listings, index, blog, stats }) {
  const featured = listings.filter((l) => l.is_rental && l.reviews >= 25).slice(0, 14);
  const heroSlides = featured.slice(0, 12);
  const topTen = listings.filter((l) => l.is_rental && l.reviews >= 40).slice(0, 10);
  const topCities = index.cities.slice(0, 24);

  const slideMarkup = heroSlides
    .map(
      (l, i) => `<a class="slide" href="${attr(l.url)}">
      <span class="slide__media">${
        l.photo
          ? `<img src="${attr(l.photo)}" alt="${attr(`${l.name} e-bike rentals in ${l.city}, Florida`)}" loading="${i < 2 ? "eager" : "lazy"}"${i === 0 ? ' fetchpriority="high"' : ""} decoding="async" referrerpolicy="no-referrer" data-fallback="1" width="800" height="500">`
          : ""
      }${l.rating >= 4.8 ? '<span class="slide__badge">Top rated</span>' : ""}</span>
      <span class="slide__body">
        <span class="slide__name">${esc(l.name)}</span>
        <span class="slide__meta">${esc(l.city)}, FL · ${esc(l.region)}</span>
        <span class="rating">${l.rating ? `<span>${l.rating.toFixed(1)} stars</span><span class="rating__count">(${formatReviews(l.reviews)})</span>` : ""}</span>
        <span class="slide__foot">View details</span>
      </span>
    </a>`
    )
    .join("");

  const body = `
<section class="hero">
  <div class="bubbles" aria-hidden="true">
    <i style="width:180px;height:180px;left:4%;top:12%"></i>
    <i style="width:90px;height:90px;left:22%;top:64%"></i>
    <i style="width:260px;height:260px;right:-4%;top:-12%"></i>
    <i style="width:120px;height:120px;right:18%;bottom:-6%"></i>
  </div>
  <div class="wrap hero__inner">
    <div class="hero__grid">
      <div>
        <span class="eyebrow" style="background:#ffd267;color:#0b1f4d">Florida's e-bike rental directory</span>
        <h1>Florida E-bike Rentals 30A Guided Tours &amp; More!</h1>
        <p class="lede">Find electric bike rentals, beach cruisers and guided tours in ${esc(
          String(stats.cities)
        )} Florida towns — from the Timpoochee Trail on 30A to Key West. Compare hours, ratings and phone numbers, then book direct with the shop.</p>
        <ul class="hero__stats">
          <li><strong>${esc(String(stats.total))}</strong> rental partners</li>
          <li><strong>${esc(String(stats.cities))}</strong> Florida towns</li>
          <li><strong>${esc(formatReviews(stats.reviews))}</strong> Google reviews</li>
          <li><strong>${esc(stats.avgRating)}</strong> average rating</li>
        </ul>
        <div class="hero__actions">
          <a class="btn btn--primary" href="/partners/">Rent Now</a>
          <a class="btn btn--ghost" href="/find/">Find rentals near you</a>
        </div>
      </div>
      <div class="carousel" data-carousel data-near-me>
        <div class="carousel__head">
          <span class="carousel__title" data-near-label>Featured Florida e-bike rentals</span>
          <div class="carousel__nav">
            <button class="carousel__btn" type="button" data-carousel-prev aria-label="Previous listings">&#8249;</button>
            <button class="carousel__btn" type="button" data-carousel-next aria-label="Next listings">&#8250;</button>
          </div>
        </div>
        <div class="carousel__track">${slideMarkup}</div>
        <div class="hero__actions" style="margin-top:.9rem">
          <button class="btn btn--ghost btn--sm" type="button" data-near-button>Show rentals near me</button>
          <span class="small" style="color:#c9d9fd;align-self:center">Allow location to sort by distance from you</span>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${banner(photoFor("home"), {
      alt: `Florida e-bike rentals - ${photoFor("home").alt}`,
      eager: false,
    })}
    <div class="section__head mt-3">
      <h2>Find Ebike Rentals in Florida</h2>
      <p>Start with the region you are visiting. Every region page lists the towns inside it, and every
      town page ranks the local shops by Google rating and review volume, so the shortlist worth calling
      is always at the top.</p>
    </div>
    <div class="mt-2">${linkCloud(
      [...index.regions]
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
        .map((region) => ({
          href: region.url,
          label: `E-bike rentals in ${region.name}`,
          count: region.listings.length,
        }))
    )}</div>
    <h3 class="mt-3">Popular Florida towns for e-bike rentals</h3>
    ${linkCloud(
      topCities.map((city) => ({
        href: city.url,
        label: `${city.name} e-bike rentals`,
        count: city.listings.length,
      }))
    )}
    <p class="mt-2"><a class="btn btn--outline btn--sm" href="/find/">See all ${esc(
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
      outrank a perfect score from a handful of reviews. Toggle the map to see where they are.</p>
    </div>
    ${mapPanel(topTen, { id: "home-map", zoom: 7, buttonLabel: "Show map view" })}
    ${listicle(topTen)}
    <p class="mt-2"><a class="btn btn--blue" href="/partners/">Browse all ${esc(
      String(stats.total)
    )} partners</a></p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="prose">
      <h2>What is Florida Ebike Rentals?</h2>
      <p>Florida Ebike Rentals is a free directory of every operating electric bike rental shop, bike
      rental service and guided tour operator we can find in Florida. It exists because searching for a
      rental in an unfamiliar beach town is unreasonably hard: the results are a mix of national booking
      platforms, shops that closed two seasons ago, and businesses three hours up the coast.</p>
      <p>We track <strong>${esc(String(stats.total))} rental partners across ${esc(
        String(stats.cities)
      )} Florida towns</strong>, carrying ${esc(formatReviews(stats.reviews))} Google reviews between
      them. ${esc(String(stats.ebikeShops))} of those specialise in electric bikes and ${esc(
        String(stats.tourOperators)
      )} run guided rides as well as rentals. Every listing shows the address, phone number, website,
      opening hours, services and the shop's Google rating with its review count, so you can judge
      whether a 4.6 average comes from forty reviews or four thousand.</p>
      <p>We are not a rental company. We take no bookings, hold no deposits and set no prices — you
      contact the shop directly, which is also how you get the best rate. There is no paid placement:
      ranking is generated from public rating data, not from who pays us. That is covered in full on our
      <a href="/about/">about page</a> and in our <a href="/disclaimer/">disclaimer</a>.</p>

      <h2>How Does Florida Ebike Rentals Work?</h2>
      <p>Three steps, and no account required.</p>
      <ol>
        <li><strong>Pick your place.</strong> Use the <a href="/find/">Find directory</a> to open the
        region and town you are visiting, or let the homepage carousel show the rentals closest to you.
        Town pages cover everything from <a href="/find/ebike-rentals-in-santa-rosa-beach/">Santa Rosa
        Beach on 30A</a> to <a href="/find/ebike-rentals-in-key-west/">Key West</a>.</li>
        <li><strong>Compare the shortlist.</strong> Each town page ranks local shops by rating and
        review volume and shows hours, services and location on a map you can toggle on. Open a
        <a href="/partners/">partner page</a> for the full detail, or a
        <a href="/reviews/">reviews page</a> to see the star breakdown behind the average.</li>
        <li><strong>Book direct.</strong> Call or visit the shop's own website using the details on the
        listing. Ask about class, minimum age, delivery and the card hold before you pay — our
        <a href="/blog/ebike-rental-checklist/">rental checklist</a> has the exact questions.</li>
      </ol>
      <p>Data comes from public Google Business listings and is refreshed on a schedule. Businesses
      marked permanently or temporarily closed are removed at import, which is why this directory is
      smaller and more accurate than a raw search. Spot something wrong? Tell us on the
      <a href="/contact/">contact page</a> and we will fix it.</p>

      <h2>Where e-bike riding in Florida is best</h2>
      <p>Florida is flat, which makes people assume pedal assist is unnecessary. What Florida actually
      has is distance, heat and wind, and an e-bike solves all three. The Timpoochee Trail runs the full
      length of 30A past Seaside and Rosemary Beach. The Legacy Trail links Sarasota to Venice. The
      Pinellas Trail covers 45 miles from St. Petersburg to Tarpon Springs. Sanibel has 25 miles of path
      separated from traffic, and Key West is a town where a bike is genuinely faster than a car.</p>
      <p>Our <a href="/blog/best-ebike-rides-florida/">ten best e-bike rides in Florida</a> covers each
      of them, with the town page for renting nearby, and our
      <a href="/trails/">trail guides</a> cover the routes in detail.</p>
      ${figure(secondPhotoFor("home"), {
        alt: `Riding a rented electric bike in Florida - ${secondPhotoFor("home").alt}`,
      })}
    </div>
  </div>
</section>

${adSlot(site, "")}

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
    <p class="mt-2"><a class="btn btn--outline btn--sm" href="/blog/">All guides</a></p>
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

<section class="section">
  <div class="wrap">
    ${ctaBand({
      title: "Find the e-bike rentals closest to you",
      text: "The partner directory sorts itself by distance from wherever you are, so the shops at the top are the ones you can walk or drive to today.",
      buttons: [
        { href: "/partners/", label: "Rent Now", variant: "btn--primary" },
        { href: "/contact/", label: "Add your shop", variant: "btn--ghost" },
      ],
    })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>Browse the directory</h2>
    <div class="grid grid--4 mt-2">
      ${linkCard({ href: "/find/", title: "Find", text: "Every Florida region and town we cover.", more: "Open Find" })}
      ${linkCard({ href: "/partners/", title: "Partners", text: "The full listicle of rental partners.", more: "Open Partners" })}
      ${linkCard({ href: "/trails/", title: "Trails", text: "Where to ride once you have the bike.", more: "Open Trails" })}
      ${linkCard({ href: "/costs/", title: "Costs", text: "Rates, deposits, delivery and waivers.", more: "Open Costs" })}
      ${linkCard({ href: "/reviews/", title: "Reviews", text: "Rating breakdowns for every shop.", more: "Open Reviews" })}
      ${linkCard({ href: "/blog/", title: "Blog", text: "Guides, laws and city listicles.", more: "Open Blog" })}
      ${linkCard({ href: "/search/", title: "Search", text: "Search every page on the site.", more: "Open Search" })}
      ${linkCard({ href: "/authors/", title: "Authors", text: "The people who write this site.", more: "Open Authors" })}
    </div>
  </div>
</section>
${adSlotScript(site, 2)}
`;

  return page(site, {
    title: "Florida E-bike Rentals 30A - Electric Bike Rentals",
    description: `Find Florida e-bike rentals in ${stats.cities} towns: 30A, Key West, Miami, Naples and more. Compare ${stats.total} electric bike rental shops and guided tours.`,
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
