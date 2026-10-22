/**
 * Booking requests ("Rent Now") and the private lead desk.
 *
 * /rent/          A rider says where, when and what they need. The request is
 *                 saved straight to the site owner's Supabase table `fer_leads`
 *                 (supabase/leads.sql) with the public anon key; row-level
 *                 security lets the public insert a lead and nothing else.
 * /admin/leads/   The owner signs in with their Supabase account and sees every
 *                 lead, with the shops in or near that town that offer the
 *                 service asked for, so the request can be passed to one.
 *
 * Nothing is charged on the form. We confirm with a shop, send the rider a quote
 * (the shop's price and our booking fee, shown separately) with a Stripe payment
 * link from the lead desk (/api/quote/), and book the shop once it is paid.
 */
import { esc, attr } from "../util.mjs";
import { page, breadcrumbSchema } from "../layout.mjs";
import { faqBlock, faqSchema } from "../components.mjs";
import { photoFor, figure, ownPhoto, sitePhoto } from "../images.mjs";
import { bikeIcon } from "../bike-icons.mjs";

export const RENT_URL = "/rent/";
export const ADMIN_LEADS_URL = "/admin/leads/";
export const ADMIN_SHOPS_JSON = "/admin/shops.json";

/** What a rider can ask for. `match` decides which shops can fulfil it. */
export const SERVICES = [
  { value: "ebike-rental", label: "E-bike rental", match: (l) => l.is_ebike && has(l, "Rentals") },
  { value: "bike-rental", label: "Bike or beach cruiser rental", match: (l) => has(l, "Rentals") },
  { value: "guided-tour", label: "Guided e-bike tour", match: (l) => has(l, "Guided tours") },
  { value: "delivery", label: "Rental delivered to my hotel or rental house", match: (l) => has(l, "Delivery available") },
  { value: "scooter", label: "Scooter or moped rental", match: (l) => has(l, "Scooters") },
  { value: "repair", label: "E-bike repair or battery help", match: (l) => has(l, "Repairs & service") || l.is_ebike },
];
const DURATIONS = ["not sure", "1-2 hours", "half day", "full day", "multi-day"];

/** When in the day the rider wants the bikes. Values match the fer_leads check. */
export const TIMES_OF_DAY = [
  { value: "morning", label: "Morning", hint: "8 to 11am", from: 7, to: 11 },
  { value: "midday", label: "Midday", hint: "11am to 2pm", from: 11, to: 14 },
  { value: "afternoon", label: "Afternoon", hint: "2 to 5pm", from: 14, to: 17 },
  { value: "sunset", label: "Evening / sunset", hint: "5pm to close", from: 17, to: 21 },
  { value: "flexible", label: "Flexible", hint: "Any time that day" },
];

/** Half-hour start times a shop is plausibly open, 7:00 AM to 7:30 PM. */
function startTimeOptions() {
  const out = ['<option value="">No exact time</option>'];
  for (let m = 7 * 60; m <= 19 * 60 + 30; m += 30) {
    const h = Math.floor(m / 60), min = m % 60;
    const value = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    const label = `${((h + 11) % 12) + 1}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
    out.push(`<option value="${value}">${label}</option>`);
  }
  return out.join("");
}

/**
 * Bike styles a rider can prefer. We don't hold inventory, so the style is a
 * preference, not a promise: shops' fleets vary, and the quote says what the
 * shop actually has before the rider pays. Public shop profiles don't record
 * which styles a fleet has, so the lead desk shows it for the owner to check.
 */
export const BIKE_STYLES = [
  { value: "cruiser", label: "Beach cruiser e-bike", note: "Upright seat, wide handlebars, easy riding on beach paths" },
  { value: "fat-tire", label: "Fat-tire e-bike", note: "Wide tires for sand, gravel and rougher paths" },
  { value: "step-through", label: "Step-through e-bike", note: "Low frame that is easy to get on and off" },
  { value: "hybrid", label: "Commuter / hybrid e-bike", note: "Lighter and quicker on paved trails and roads" },
  { value: "trike", label: "Electric trike", note: "Three wheels, the most stable choice" },
  { value: "cargo", label: "Family / cargo e-bike", note: "Room for a child seat, a kid or gear" },
  { value: "pedal", label: "Regular beach cruiser", note: "No motor, pedal power only" },
  { value: "any", label: "No preference", note: "Whatever the shop has that suits you" },
];
/** Services where the style of bike matters. */
const STYLE_SERVICES = ["ebike-rental", "bike-rental", "delivery"];

function has(listing, tag) {
  return (listing.tags || []).includes(tag);
}

export function bookingConfig(site) {
  const b = site.booking || {};
  const url = String(b.supabaseUrl || "").replace(/\/+$/, "");
  const key = String(b.supabaseAnonKey || "");
  const ok = b.enabled !== false && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && key.length > 20;
  return ok ? { url, key } : null;
}

/** Every town with shops, grouped by region, for the "Where" picker. */
function townOptions(index, selected = "") {
  const regions = [...index.regions].sort((a, b) => a.name.localeCompare(b.name));
  return regions
    .map((r) => {
      const towns = [...r.cities, ...(r.thinCities || [])].sort((a, b) => a.name.localeCompare(b.name));
      return `<optgroup label="${attr(r.name)}">${towns
        .map((t) => `<option value="${attr(t.slug)}"${t.slug === selected ? " selected" : ""}>${esc(t.name)}</option>`)
        .join("")}</optgroup>`;
    })
    .join("");
}

/**
 * A short "rent this" form for content pages. It submits to /rent/ with the town,
 * day and style filled in, so the rider finishes the same request form there.
 */
export function quickRent(index, { style = "", service = "ebike-rental", heading = "Rent this e-bike", town = "" } = {}) {
  return `<form class="quick-rent" action="${RENT_URL}" method="get">
  <p class="quick-rent__title">${esc(heading)}</p>
  <input type="hidden" name="service" value="${attr(service)}">
  ${style ? `<input type="hidden" name="style" value="${attr(style)}">` : ""}
  <label class="field"><span>Where</span><select name="town" required><option value="">Choose a town</option>${townOptions(index, town)}</select></label>
  <label class="field"><span>Day</span><input type="date" name="date" required></label>
  <button class="btn btn--primary" type="submit">Book Now</button>
  <p class="quick-rent__note small muted">Next you add the time and your contact details. Nothing is charged until you accept a quote.</p>
</form>`;
}

/** Questions people ask when they want a bike today. Every answer matches how Rent Now works. */
const RENT_FAQS = [
  {
    q: "Can I rent an ebike today?",
    a: "<p>Often, yes. Send a booking request with today's date and the time you want to ride, and we check with shops in your town that have electric bikes free. Same-day rentals depend on what shops have left, so the earlier in the day you ask, the better your chances.</p>",
  },
  {
    q: "How do I rent an ebike now?",
    a: "<p>Fill in the form on this page: your town, the day and time, the style of bike you would like and how to reach you. We send you a quote with the shop's price and our booking fee. Pay it online and we book the bike for you.</p>",
  },
  {
    q: "Do I pay anything to send a request?",
    a: "<p>No. Nothing is charged until you accept and pay a quote, and you can cancel for a full refund up to 24 hours before your rental.</p>",
  },
  {
    q: "Will I get the exact e-bike I pick?",
    a: "<p>The bike style is a preference. Each shop has its own fleet, so the exact style may or may not be available on your day, and your quote tells you what the shop has before you pay.</p>",
  },
];

/** A "Rent Now" link that carries the town (and shop) it was clicked from. */
export function rentHref({ town = "", listing = "", service = "" } = {}) {
  const q = new URLSearchParams();
  if (town) q.set("town", town);
  if (listing) q.set("listing", listing);
  if (service) q.set("service", service);
  const s = q.toString();
  return s ? `${RENT_URL}?${s}` : RENT_URL;
}

export function rentPage(site, { index, listings }) {
  const cfg = bookingConfig(site);
  const line = site.phone?.display ? site.phone : null;
  const shopNames = Object.fromEntries(listings.map((l) => [l.slug, [l.name, l.citySlug]]));
  const crumbs = [
    { href: "/", label: "Home" },
    { href: RENT_URL, label: "Book Now" },
  ];

  const body = `
<section class="section rent">
  <div class="wrap wrap-narrow">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Book Now</li></ol></nav>
    <h1>Rent an Ebike Today in Florida</h1>
    <p class="lede">Rent an ebike now: send one request and we handle the rest. We find a shop near you with an
    electric bike free, send you one quote, and book the rental on your behalf once you pay. Nothing is
    charged until you accept a quote.</p>
    <figure class="demo-video rent-video">
      <video src="/assets/video/how-rent-now-works.mp4" poster="/assets/video/how-rent-now-works.jpg" width="1280" height="720"
        autoplay muted loop playsinline controls preload="metadata"
        aria-label="Video: how booking works. You request a rental, we find a shop with your bike, you approve one quote, and we book it for you. No sound."></video>
      <figcaption class="rent-video__steps"><span><b>1</b> You request</span><span><b>2</b> We find the shop</span><span><b>3</b> You approve one quote</span><span><b>4</b> We book it</span></figcaption>
    </figure>

    <form class="rent-form" data-rent-form${cfg ? ` data-endpoint="${attr(cfg.url)}" data-key="${attr(cfg.key)}"` : ""} novalidate>
      <p class="rent-form__shop" data-rent-shop hidden></p>

      <div class="rent-form__grid">
        <label class="field">
          <span>Where</span>
          <select name="town" required>
            <option value="">Choose a town</option>
            ${townOptions(index)}
          </select>
        </label>
        <label class="field">
          <span>What do you need?</span>
          <select name="service" required>
            ${SERVICES.map((s) => `<option value="${attr(s.value)}">${esc(s.label)}</option>`).join("")}
          </select>
        </label>
      </div>

      <fieldset class="rent-styles" data-rent-styles data-style-services="${attr(STYLE_SERVICES.join(" "))}">
        <legend>Preferred bike style <small class="muted">(the yellow bolt means electric; <a href="/electric-bike-types/">compare e-bike types</a>)</small></legend>
        <div class="rent-styles__grid">
          ${BIKE_STYLES.map(
            (s, i) => `<label class="rent-style">
            <input type="radio" name="bike_style" value="${attr(s.value)}"${i === 0 ? " checked" : ""}>
            ${bikeIcon(s.value)}
            <span class="rent-style__body"><strong>${esc(s.label)}</strong><span>${esc(s.note)}</span></span>
          </label>`
          ).join("")}
        </div>
        <p class="rent-styles__fine small muted">This is your preference, not a guarantee. Each shop has its own fleet, so
        the exact style may or may not be available on your day, and the exact make and model are up to the shop. Your
        quote says what the shop has before you pay, so you can decline it if it isn't what you want.</p>
      </fieldset>

      <fieldset class="rent-when">
        <legend>When do you want to ride?</legend>
        <div class="rent-form__grid">
          <label class="field">
            <span>Day</span>
            <input type="date" name="start_date" required>
            <small class="rent-when__day muted" data-rent-day aria-live="polite"></small>
          </label>
          <label class="field">
            <span>Exact start time <small class="muted">(optional)</small></span>
            <select name="start_time" data-rent-start>${startTimeOptions()}</select>
          </label>
        </div>
        <div class="rent-when__tod" role="radiogroup" aria-label="Time of day">
          ${TIMES_OF_DAY.map(
            (t) => `<label class="rent-tod">
            <input type="radio" name="time_of_day" value="${attr(t.value)}"${t.from != null ? ` data-from="${t.from}" data-to="${t.to}"` : ""}>
            <span><strong>${esc(t.label)}</strong><small>${esc(t.hint)}</small></span>
          </label>`
          ).join("")}
        </div>
      </fieldset>

      <div class="rent-form__grid">
        <label class="field">
          <span>How long?</span>
          <select name="duration">
            ${DURATIONS.map((d) => `<option value="${attr(d)}">${esc(d[0].toUpperCase() + d.slice(1))}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>How many bikes?</span>
          <input type="number" name="bikes" min="1" max="50" value="2" inputmode="numeric">
        </label>
        <label class="field">
          <span>Your name</span>
          <input type="text" name="name" required maxlength="120" autocomplete="name">
        </label>
        <label class="field">
          <span>Phone</span>
          <input type="tel" name="phone" maxlength="40" autocomplete="tel" inputmode="tel">
        </label>
        <label class="field">
          <span>Email</span>
          <input type="email" name="email" maxlength="180" autocomplete="email">
        </label>
      </div>
      <label class="field">
        <span>Anything else? <small class="muted">(optional)</small></span>
        <textarea name="notes" rows="3" maxlength="2000" placeholder="Riders' heights, a child seat, where you're staying, a time..."></textarea>
      </label>
      <label class="rent-form__hp" aria-hidden="true">Leave this empty <input type="text" name="fer_hp" tabindex="-1" autocomplete="off" value=""></label>
      <label class="rent-form__consent">
        <input type="checkbox" name="consent" required>
        <span>You can call or text me about this request, and share the booking details with the shop you book.
        See our <a href="/privacy/">privacy policy</a> and <a href="/terms/#rent-now-bookings">booking terms</a>.</span>
      </label>
      <p class="small muted">Give us a phone number or an email, so we can reach you.</p>
      <button class="btn btn--primary btn--block" type="submit">Send my request</button>
      <p class="rent-form__status" data-rent-status role="status" aria-live="polite"></p>
      ${line ? `<p class="small muted rent-form__call">Prefer to call? <a href="tel:${attr(line.number)}">${esc(line.display)}</a></p>` : ""}
    </form>

    <div class="rent-done" data-rent-done hidden>
      <h2>Thanks, we have your request</h2>
      <p>We will check with shops near you and send you a quote with the price and a secure payment link.
      Nothing is charged until you pay it.</p>
      <p><a class="btn btn--outline" href="/cities/">Browse shops while you wait</a></p>
    </div>

    <p class="small muted mt-3">Full refund if you cancel 24 hours or more before your rental; no refund after that. If the
    shop cancels or can't provide your booking, you get a full refund. <a href="/terms/#rent-now-bookings">Booking terms</a>.</p>

    <h2 class="mt-3">Ebike rental today, or any day</h2>
    <p>Most Florida rental shops can hand over an electric bike the same day when they have bikes free, and the
    quickest way to find one is to ask several at once. That is what this form does: send it with today's date and a
    time, and we check with shops in your town while you get ready. Weekends, holidays and spring break book up
    first, so for those days rent your ebike as early as you can.</p>
    ${sitePhoto("cruiser-ebikes-baskets", { className: "rent-figure" })}
    ${ownPhoto()}
    ${faqBlock(RENT_FAQS)}
  </div>
</section>
<script type="application/json" id="rent-shops">${JSON.stringify(shopNames).replace(/</g, "\\u003c")}</script>
`;

  return page(site, {
    title: "Rent an Ebike Today in Florida - Ebike Rental Now",
    description:
      "Rent an ebike now or for any day: pick your town, day and time, and we find a Florida shop with an electric bike for you. Ebike rental today, quoted before you pay.",
    path: RENT_URL,
    body,
    connectHosts: cfg ? [cfg.url] : [],
    schema: [breadcrumbSchema(site, crumbs), faqSchema(RENT_FAQS)],
  });
}

/** Where Stripe sends a rider after paying. */
export const RENT_PAID_URL = "/rent/paid/";
export function rentPaidPage(site) {
  const line = site.phone?.display ? site.phone : null;
  const body = `
<section class="section rent">
  <div class="wrap wrap-narrow">
    <h1>Payment received, thank you</h1>
    ${figure(photoFor("rent-paid"), { caption: null, className: "rent-figure", eager: true })}
    <p class="lede">We are booking your rental with the shop now. When it is confirmed we will send you the shop's
    name, where to collect your bikes and when.</p>
    <p>Stripe emails your receipt to the address you gave at checkout. Need to change or cancel? Reply to your quote
    message${line ? `, call us on <a href="tel:${attr(line.number)}">${esc(line.display)}</a>,` : ""} or use our
    <a href="/contact/">contact page</a>. Cancel 24 hours or more before your rental for a full refund
    (<a href="/terms/#rent-now-bookings">booking terms</a>).</p>
    <p><a class="btn btn--outline" href="/trails/">Find somewhere to ride</a></p>
    ${ownPhoto()}
  </div>
</section>`;
  return page(site, {
    title: "Payment Received - Florida Ebike Rentals",
    description: "Your rental payment was received. We are booking it with the shop.",
    path: RENT_PAID_URL,
    body,
    noindex: true,
  });
}

/** The owner's lead desk. Not linked, not indexed; reads need a signed-in admin. */
export function adminLeadsPage(site) {
  const cfg = bookingConfig(site);
  const body = `
<section class="section admin">
  <div class="wrap">
    <h1>Leads</h1>
    ${
      cfg
        ? ""
        : `<p class="notice">Booking is not connected yet. Add your Supabase project URL and anon key to <code>data/site.json</code> under <code>booking</code>.</p>`
    }
    <div data-admin${cfg ? ` data-endpoint="${attr(cfg.url)}" data-key="${attr(cfg.key)}"` : ""} data-shops="${attr(ADMIN_SHOPS_JSON)}"
      data-services="${attr(JSON.stringify(SERVICES.map((s) => [s.value, s.label])))}"
      data-styles="${attr(JSON.stringify(BIKE_STYLES.map((s) => [s.value, s.label])))}">
      <form class="admin-login" data-admin-login>
        <label class="field"><span>Email</span><input type="email" name="email" required autocomplete="username"></label>
        <label class="field"><span>Password</span><input type="password" name="password" required autocomplete="current-password"></label>
        <button class="btn btn--blue" type="submit">Sign in</button>
        <p class="small" data-admin-login-status role="status"></p>
      </form>

      <div data-admin-app hidden>
        <div class="admin-bar">
          <label class="field"><span>Status</span>
            <select data-admin-filter>
              <option value="open">To do (new to paid)</option>
              <option value="">All</option>
              <option value="new">New</option><option value="contacted">Contacted</option>
              <option value="matched">Matched</option><option value="quoted">Quoted</option>
              <option value="paid">Paid: book the shop</option><option value="booked">Booked</option>
              <option value="cancelled">Cancelled</option><option value="refunded">Refunded</option><option value="lost">Lost</option>
            </select>
          </label>
          <button class="btn btn--outline btn--sm" type="button" data-admin-refresh>Refresh</button>
          <button class="btn btn--outline btn--sm" type="button" data-admin-logout>Sign out</button>
          <span class="small muted" data-admin-count></span>
        </div>
        <div class="admin-grid">
          <ol class="admin-leads" data-admin-leads></ol>
          <div class="admin-detail" data-admin-detail><p class="muted">Choose a lead to see the shops that can fulfil it.</p></div>
        </div>
      </div>
    </div>
  </div>
</section>`;

  return page(site, {
    title: "Leads - Florida Ebike Rentals",
    description: "Lead desk.",
    path: ADMIN_LEADS_URL,
    body,
    noindex: true,
    connectHosts: cfg ? [cfg.url] : [],
  });
}

/**
 * The shops the lead desk matches against. Public business details from each
 * shop's Google profile (phone and website included, so the owner can call
 * them); served only under /admin/, which is disallowed for crawlers.
 */
export function adminShopsJson(rawListings, index) {
  const towns = {};
  for (const t of [...index.cities, ...index.thinCities]) {
    towns[t.slug] = { n: t.name, r: t.region, lat: t.lat, lng: t.lng };
  }
  const shops = rawListings.map((l) => ({
    s: l.slug,
    n: l.name,
    t: l.citySlug,
    c: l.city,
    u: l.url,
    lat: l.lat,
    lng: l.lng,
    ra: l.rating || 0,
    rv: l.reviews || 0,
    p: l.phone || "",
    w: l.website || "",
    m: l.maps_link || "",
    sv: SERVICES.filter((s) => s.match(l)).map((s) => s.value),
    tg: l.tags || [],
  }));
  return JSON.stringify({ towns, shops });
}

