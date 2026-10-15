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

/** The demo: a call travelling from a rider to a partner shop, step by step. */
function demo(offer, line) {
  const region = offer.regions[0];
  return `<div class="call-demo" role="img" aria-label="How a call reaches your shop: a rider calls our rental line, presses ${region.key} for ${esc(region.name)}, your phone rings first and you hear a short message that the call came from Florida Ebike Rentals, then you take the booking.">
  <ol class="call-demo__steps">
    <li class="call-demo__step" style="--i:0">
      <span class="call-demo__icon" aria-hidden="true">1</span>
      <strong>A rider calls</strong>
      <span>They tap "Call our rental line" on a page about your area: ${esc(line)}.</span>
    </li>
    <li class="call-demo__step" style="--i:1">
      <span class="call-demo__icon" aria-hidden="true">2</span>
      <strong>They pick your region</strong>
      <span>"For ${esc(region.name)}, press ${region.key}."</span>
    </li>
    <li class="call-demo__step call-demo__step--you" style="--i:2">
      <span class="call-demo__icon" aria-hidden="true">3</span>
      <strong>Your phone rings first</strong>
      <span>Before you're connected you hear: <em>"Rental call from Florida Ebike Rentals."</em></span>
    </li>
    <li class="call-demo__step" style="--i:3">
      <span class="call-demo__icon" aria-hidden="true">4</span>
      <strong>You take the booking</strong>
      <span>The rider is on the line with you. Price, booking and payment are yours.</span>
    </li>
  </ol>
  <div class="call-demo__phone" aria-hidden="true">
    <div class="call-demo__screen">
      <span class="call-demo__label">Incoming call</span>
      <span class="call-demo__from">Florida Ebike Rentals</span>
      <span class="call-demo__region">${esc(region.name)} · rider</span>
      <span class="call-demo__whisper">"Rental call from Florida Ebike Rentals."</span>
      <span class="call-demo__buttons"><span class="call-demo__decline"></span><span class="call-demo__accept"></span></span>
    </div>
  </div>
  <p class="call-demo__note">Don't answer? The call moves to the next shop in your region, so the rider is never left hanging.</p>
</div>`;
}

export function businessPage(site, { listings }) {
  const offer = loadOffer();
  const line = site.phone?.display || "(305) 363-1922";
  const crumbs = [
    { href: "/", label: "Home" },
    { href: BUSINESS_URL, label: "For businesses" },
  ];
  const shopsIn = (r) => listings.filter((l) => r.siteRegions.includes(l.regionSlug)).length;
  const open = offer.regions.filter((r) => r.status !== "taken");

  const faqs = [
    {
      q: "What exactly do I get for $29.99 a month?",
      a: `<p>Priority caller status for one region. When a rider calls our rental line and picks your region in the phone menu, your phone rings first. Every call starts with a short whisper, "Rental call from Florida Ebike Rentals", that only you hear, so you know where it came from. Each month we send you the call report for your region.</p>`,
    },
    {
      q: "How many calls will I get?",
      a: "<p>We can't promise a number: calls depend on the season and on how many riders look for your area. You see every call in your monthly report, and you can cancel at any time if it isn't worth it to you.</p>",
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
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">For businesses</li></ol></nav>
    <span class="eyebrow">For e-bike rental shops</span>
    <h1>Get the e-bike rental calls in your region, first</h1>
    <p class="biz-hero__lead">Riders across Florida use our site to find a rental, then call our rental line. Priority caller
    status puts your shop first in line for every call in your region, for ${esc(offer.price)} a ${esc(offer.period)}.</p>
    <p><a class="btn btn--primary" href="#regions">See open regions</a> <a class="btn btn--outline-light" href="#how-it-works">How it works</a></p>
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
    ${figure(photoFor("business"), { alt: "Illustration of riders on e-bikes in Florida", caption: null, className: "biz-figure" })}
    <h2>What you get</h2>
    <div class="grid grid--3 mt-2">
      <div class="card"><h3>First ring in your region</h3><p>When a rider picks your region in our phone menu, your phone rings before any other shop's.</p></div>
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
    <div class="region-board mt-2">${offer.regions
      .map((r) => {
        const taken = r.status === "taken";
        const n = shopsIn(r);
        return `<div class="region-slot${taken ? " is-taken" : ""}">
        <span class="region-slot__key">${r.key}</span>
        <span class="region-slot__name">${esc(r.name)}</span>
        <span class="region-slot__meta">${n} ${plural(n, "shop")} listed in this region</span>
        ${
          taken
            ? `<span class="region-slot__status">Taken</span>`
            : `<a class="btn btn--blue btn--sm" href="${attr(checkoutUrl(offer, r))}" rel="noopener" target="_blank">Claim for ${esc(offer.price)}/mo</a>`
        }
      </div>`;
      })
      .join("")}</div>
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
    title: "For Businesses: Get E-Bike Rental Calls First",
    description: `Priority caller status for Florida e-bike rental shops: your phone rings first for every rental call in your region, for ${offer.price} a ${offer.period}. One shop per region.`,
    path: BUSINESS_URL,
    body,
    ogImage: "/assets/img/scenes/atlantic.jpg",
    schema: [breadcrumbSchema(site, crumbs), faqSchema(faqs)],
  });
}
