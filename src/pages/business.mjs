/**
 * /business/ — priority caller status for rental shops.
 *
 * Riders call the site's rental line and pick a region from the phone menu.
 * A subscribing shop is rung first for its region; the whisper played before
 * each call says it came from Florida Ebike Rentals. One priority partner per
 * region, managed in data/business.json. Rankings on the site are never paid:
 * the subscription buys first ring on calls, nothing else.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { esc, attr, plural } from "../util.mjs";
import { page, breadcrumbSchema } from "../layout.mjs";
import { faqBlock, faqSchema } from "../components.mjs";
import { ROOT } from "../data.mjs";
import { ownPhoto, photoFor, figure } from "../images.mjs";

export const BUSINESS_URL = "/business/";

function loadOffer() {
  return JSON.parse(readFileSync(join(ROOT, "data", "business.json"), "utf8"));
}

/** Checkout link for one region; client_reference_id tells you which region was bought. */
function checkoutUrl(offer, region) {
  const slug = region.name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${offer.stripeUrl}?client_reference_id=region-${region.key}-${slug}`;
}

/** The demo: a 16-second video of a call travelling from a rider to a partner shop, with the same steps as text. */
function demo(offer, line) {
  const region = offer.regions[0];
  return `<figure class="demo-video">
    <video src="/assets/video/how-priority-calls-work.mp4" poster="/assets/video/how-priority-calls-work.jpg" width="1280" height="720"
      autoplay muted loop playsinline controls preload="metadata"
      aria-label="Video: how a rental call reaches your shop, from the rider tapping Call to you taking the booking. No sound."></video>
  </figure>
  <ol class="demo-steps">
    <li><strong>A rider taps Call.</strong> They find shops in your area on our site and call our rental line, ${esc(line)}.</li>
    <li><strong>They pick your region.</strong> "For ${esc(region.name)}, press ${region.key}."</li>
    <li><strong>Your phone rings first.</strong> Before you're connected you hear: <em>"Rental call from Florida Ebike Rentals."</em></li>
    <li><strong>You take the booking.</strong> The rider is on the line with you. Price, booking and payment are yours.</li>
  </ol>
  <p class="muted">Don't answer? The call moves to the next shop in your region, so the rider is never left hanging.</p>`;
}

export function businessPage(site, { listings }) {
  const offer = loadOffer();
  const line = site.phone?.display || "(305) 363-1922";
  const crumbs = [
    { href: "/", label: "Home" },
    { href: BUSINESS_URL, label: "Businesses" },
  ];
  const shopsIn = (r) => listings.filter((l) => r.siteRegions.includes(l.regionSlug)).length;
  // "taken": a shop holds the slot; "closed": we are not selling lead slots there.
  const open = offer.regions.filter((r) => r.status === "open");

  const faqs = [
    {
      q: "How do I get more leads to my bike shop?",
      a: `<p>Complete your Google Business Profile, collect Google reviews from every happy customer, answer every call, get listed on directories riders use (including <a href="/cities/">this site, free</a>), and partner with vacation rentals and hotels. Priority caller status adds calls from our rental line on top. <a href="#grow">Read the full guide</a>.</p>`,
    },
    {
      q: "How do I get more customers to my e-bike store?",
      a: `<p>Show clear prices, let people book or reserve online, offer delivery and guided rides if you can, and treat every rental as a test ride with a credit toward buying the bike. <a href="#grow">More in our guide</a>.</p>`,
    },
    {
      q: "How should I run ads for my e-bike shop?",
      a: `<p>Start with Google Search ads on local, high-intent searches like "e-bike rental near me", limited to a radius around your shop and with a call button. Use Facebook and Instagram for tours and sales. Set a daily budget and judge ads on calls and bookings, not clicks. <a href="#grow">See the ad checklist</a>.</p>`,
    },
    {
      q: "What exactly do I get for $29.99 a month?",
      a: `<p>Priority caller status for one region. When a rider calls our rental line and picks your region in the phone menu, your phone rings first. Every call starts with a short whisper, "Rental call from Florida Ebike Rentals", that only you hear, so you know where it came from. Each month we send you the call report for your region.</p>`,
    },
    {
      q: "How many calls will I get?",
      a: "<p>Shops can add an additional 3 to 5 leads a month, depending on their region. It isn't a guarantee: calls depend on the season and on how many riders look for your area. You see every call in your monthly report, and you can cancel at any time if it isn't worth it to you.</p>",
    },
    {
      q: "Does paying move my shop up the rankings?",
      a: "<p>No. Rankings on this site are never paid. They come from Google rating and review count, the same for every shop. Priority status changes who our phone line rings first, nothing else.</p>",
    },
    {
      q: "What happens if I miss a call?",
      a: "<p>The call moves to the next shop in your region, so the rider still gets help. Missed calls are in your report too.</p>",
    },
    {
      q: "Can more than one shop have priority in a region?",
      a: "<p>No. There is one priority shop per region, first come, first served. When a region is taken it shows as Taken on this page.</p>",
    },
    {
      q: "How do I cancel?",
      a: `<p>Cancel any time by telling us on the <a href="/contact/">contact page</a>. Priority status ends at the end of the month you have paid for.</p>`,
    },
  ];

  const body = `
<section class="biz-hero">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Businesses</li></ol></nav>
    <span class="eyebrow">For e-bike rental shops</span>
    <h1>Get more leads and customers to your e-bike shop</h1>
    <p class="biz-hero__lead">Riders across Florida use our site to find a rental, then call our rental line. Priority caller
    status puts your shop first in line for every call in your region, for ${esc(offer.price)} a ${esc(offer.period)}.
    Shops can add an additional 3 to 5 leads a month, depending on their region.</p>
    <p><a class="btn btn--primary" href="#regions">See open regions</a> <a class="btn btn--outline-light" href="#how-it-works">How it works</a> <a class="btn btn--outline-light" href="#grow">Free guide: more leads</a></p>
    <p class="biz-hero__meta">${open.length} of ${offer.regions.length} regions open · One priority shop per region · Cancel any time</p>
  </div>
</section>

<section class="section" id="how-it-works">
  <div class="wrap">
    <h2>How it works</h2>
    <p class="muted">Heard "Rental call from Florida Ebike Rentals" when you picked up? That call came through our line. Here is the whole path a call takes.</p>
    ${demo(offer, line)}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    ${figure(photoFor("business"), { caption: null, className: "biz-figure" })}
    <h2>What you get</h2>
    <div class="grid grid--3 mt-2">
      <div class="card"><h3>First ring in your region</h3><p>When a rider picks your region in our phone menu, your phone rings before any other shop's. Shops can add an additional 3 to 5 leads a month, depending on their region.</p></div>
      <div class="card"><h3>You know it's us</h3><p>A short whisper before each call, "Rental call from Florida Ebike Rentals", so you can answer ready to book.</p></div>
      <div class="card"><h3>A monthly call report</h3><p>Every call in your region, answered and missed, with time and length, so you can judge it on results.</p></div>
    </div>
    <p class="mt-2 muted">Your listing stays where it is. Rankings on this site are never paid and never change because of a subscription.</p>
  </div>
</section>

<section class="section" id="regions">
  <div class="wrap">
    <h2>Claim your region</h2>
    <p class="muted">${esc(offer.price)} a ${esc(offer.period)} per region. One priority shop per region, first come, first served. The number is the key riders press in our phone menu.</p>
    <div class="table-wrap mt-2">
      <table class="data-table region-table">
        <thead><tr><th scope="col">Key</th><th scope="col">Region</th><th scope="col">Shops listed</th><th scope="col">Status</th><th scope="col">Claim</th></tr></thead>
        <tbody>${offer.regions
          .map((r) => {
            const taken = r.status !== "open";
            const label = { taken: "Taken", closed: "Closed" }[r.status] || "Open";
            const n = shopsIn(r);
            return `<tr${taken ? ' class="is-taken"' : ""}>
            <td><span class="region-table__key">${r.key}</span></td>
            <th scope="row">${esc(r.name)}</th>
            <td>${n} ${plural(n, "shop")}</td>
            <td><span class="region-table__status region-table__status--${taken ? "taken" : "open"}">${label}</span></td>
            <td>${
              taken
                ? r.status === "closed" ? "Closed for lead slots" : "Not available"
                : `<a class="btn btn--blue btn--sm" href="${attr(checkoutUrl(offer, r))}" rel="noopener" target="_blank">Claim for ${esc(offer.price)}/mo</a>`
            }</td>
          </tr>`;
          })
          .join("")}</tbody>
      </table>
    </div>
    <p class="small muted mt-2">Checkout is handled by Stripe. After you pay, we'll contact you to confirm your shop's phone number, and your priority ring is usually live within one business day.</p>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap grid grid--2 find-guide">
    ${ownPhoto()}
    <div class="prose">
      <h2>Who calls our line</h2>
      <p>Riders who have already decided to rent. They reach us from our town pages, regional guides and "near me"
      search, read about the shops in your area, and tap to call. By the time your phone rings, they want a bike.</p>
      <p>We list ${listings.length} rental shops and e-bike services across Florida, and every page has a
      "Call our rental line" button. Our <a href="/about/">about page</a> explains how the site works and how
      shops are ranked.</p>
    </div>
  </div>
</section>

<section class="section section--tint" id="grow">
  <div class="wrap wrap-narrow prose">
    <h2>How to get more leads to your bike shop</h2>
    <p>Most rental customers decide on their phone, often the day before or the morning of the ride, and they pick from
    the first few shops they find. Getting more leads comes down to being in those first few results and making it easy
    to call or book. Start with the free steps:</p>
    <ol>
      <li><strong>Complete your Google Business Profile.</strong> Pick the right primary category (for example "Bicycle
      rental service" or "Electric bicycle store"), add your real hours, holiday hours, services, prices and plenty of
      current photos of your bikes and storefront. This profile is what shows in Google Maps and the local results.</li>
      <li><strong>Ask every happy customer for a Google review.</strong> Rating and review count weigh heavily when riders
      choose a shop; our own rankings use them too. A QR code at the counter and a follow-up text after the ride both work.
      Reply to every review, including the bad ones.</li>
      <li><strong>Answer the phone.</strong> A missed call is usually a lost rental: the rider calls the next shop. Forward
      calls to a mobile or set up a callback, especially on weekend mornings.</li>
      <li><strong>Get listed where riders look.</strong> Directories like ours, your town's visitor bureau and the
      local chamber of commerce send riders who are already planning a trip. Your <a href="/cities/">listing on this
      site</a> is free.</li>
      <li><strong>Partner with the places tourists stay.</strong> Vacation rental managers, hotels and campgrounds get asked
      "where can we rent bikes?" every day. Offer them a flyer, a code or delivery to their guests.</li>
    </ol>

    <h2>How to get more customers to your e-bike store</h2>
    <p>Leads only pay off if they turn into rentals and sales. A few things make the difference:</p>
    <ul>
      <li><strong>Show your prices.</strong> Riders compare. A clear hourly, half-day and daily price on your website and
      Google profile gets more calls than "call for pricing".</li>
      <li><strong>Let people book online</strong>, or at least reserve, so you can take a booking at 10pm when riders plan
      the next day.</li>
      <li><strong>Offer what visitors ask for:</strong> delivery to rental houses, guided rides, family bikes and trailers,
      multi-day rates. If you offer them, say so on your profile and website.</li>
      <li><strong>Turn renters into buyers.</strong> An e-bike rental is a test ride. Offer to credit part of the rental
      fee toward buying the same model.</li>
      <li><strong>Keep in touch.</strong> Ask renters for an email or phone number and send a short note before next
      season. Florida visitors come back.</li>
    </ul>

    <h2>How to run ads for your e-bike shop</h2>
    <p>Ads work best once the free basics above are in place, because they send people to your profile and website. Keep
    it small and local at first:</p>
    <ul>
      <li><strong>Google Search ads.</strong> Target searches with buying intent, such as "e-bike rental near me" and
      "bike rentals [your town]", and limit the ads to a radius around your shop. Add your phone number as a call asset so
      riders can call straight from the ad.</li>
      <li><strong>Google Local Services and Maps.</strong> Check whether Local Services Ads are offered for your category
      in your area; if not, location assets put your address on your search ads and in Maps.</li>
      <li><strong>Facebook and Instagram ads.</strong> Better for awareness than for same-day rentals. Short videos of
      riders on your bikes in recognisable local spots, shown to people in and travelling to your town, work well for
      tours and sales.</li>
      <li><strong>Set a daily budget and measure calls and bookings</strong>, not clicks. Use a tracking number or ask every
      caller how they found you, and stop what doesn't bring rentals.</li>
      <li><strong>Run hardest in your season.</strong> Spend more around spring break, holidays and peak months in your
      area, and less when bikes would sit unused anyway.</li>
    </ul>
    <p>Want calls without managing ads? Riders already find shops through our site and call our rental line.
    <a href="#regions">Claim your region</a> and those calls ring your phone first, for ${esc(offer.price)} a ${esc(offer.period)}.</p>
  </div>
</section>

<section class="section">
  <div class="wrap wrap-narrow">
    <h2>Questions from shop owners</h2>
    ${faqBlock(faqs)}
    <h3 class="mt-3">The terms, in plain words</h3>
    <ul class="biz-terms">
      <li>${esc(offer.price)} per ${esc(offer.period)} per region, billed monthly by Stripe. Cancel any time; priority ends at the end of the paid month.</li>
      <li>We route calls to you first; we don't guarantee a number of calls, bookings or revenue.</li>
      <li>You agree to receive calls from our line at the number you give us, and to tell us if it changes.</li>
      <li>Your listing and its ranking are not affected by the subscription.</li>
      <li>We can end priority status, with a refund for the unused month, if callers report problems we can't resolve with you.</li>
    </ul>
    <p class="mt-2">Questions before you sign up? <a href="/contact/">Contact us</a>.</p>
  </div>
</section>
`;

  return page(site, {
    title: "How to Get More Leads & Customers to Your E-Bike Shop",
    description: `How to get more leads and customers to your bike or e-bike shop, and how to run ads that bring rentals. Plus priority caller status in Florida: ${offer.price} a ${offer.period}.`,
    path: BUSINESS_URL,
    body,
    ogImage: photoFor("business").og,
    schema: [breadcrumbSchema(site, crumbs), faqSchema(faqs)],
  });
}
