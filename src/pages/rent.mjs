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
import { photoFor, figure, ownPhoto } from "../images.mjs";
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

/**
 * Bike styles a rider can pick. We don't hold inventory, so a rider chooses a
 * style, not a model; we confirm the style with the shop before anything is
 * booked. Public shop profiles don't record which styles a fleet has, so the
 * lead desk shows the style for the owner to check with the shop.
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
    { href: RENT_URL, label: "Rent Now" },
  ];

  const body = `
<section class="section rent">
  <div class="wrap wrap-narrow">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Rent Now</li></ol></nav>
    <h1>Rent an e-bike in Florida</h1>
    ${figure(photoFor("rent-now"), { caption: null, className: "rent-figure", eager: true })}
    <p class="lede">Tell us where and when, and we will find a shop near you that has what you need, then send you a
    quote. Pay it securely online and we book the rental for you. Nothing is charged until you accept a quote.</p>

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
        <legend>Bike style <small class="muted">(the yellow bolt means electric)</small></legend>
        <div class="rent-styles__grid">
          ${BIKE_STYLES.map(
            (s, i) => `<label class="rent-style">
            <input type="radio" name="bike_style" value="${attr(s.value)}"${i === 0 ? " checked" : ""}>
            ${bikeIcon(s.value)}
            <span class="rent-style__body"><strong>${esc(s.label)}</strong><span>${esc(s.note)}</span></span>
          </label>`
          ).join("")}
        </div>
        <p class="rent-styles__fine small muted">You choose a style of bike, not a specific make or model: each shop
        has its own fleet, so the exact e-bike is not guaranteed. The style is. We confirm it with the shop before
        we quote, and if no shop near you has that style, we tell you and nothing is charged.</p>
      </fieldset>

      <div class="rent-form__grid">
        <label class="field">
          <span>Date</span>
          <input type="date" name="start_date">
        </label>
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
    ${ownPhoto()}
  </div>
</section>
<script type="application/json" id="rent-shops">${JSON.stringify(shopNames).replace(/</g, "\\u003c")}</script>
`;

  return page(site, {
    title: "Rent Now: E-Bike Rental Request - Florida Ebike Rentals",
    description:
      "Tell us where and when you want to ride. We find a Florida shop that has the e-bike, tour or delivery you need and get back to you to confirm.",
    path: RENT_URL,
    body,
    connectHosts: cfg ? [cfg.url] : [],
    schema: [breadcrumbSchema(site, crumbs)],
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

