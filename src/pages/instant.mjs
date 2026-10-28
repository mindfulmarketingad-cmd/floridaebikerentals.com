/**
 * Instant booking (Miami pilot) and the partner dashboard.
 *
 * /cities/miami/book/  A rider picks a date, a bike style, how many bikes
 *                      and how many days, and sees ONLY shops with live
 *                      availability from /api/availability/ — onboarded
 *                      Miami shops with fleet to cover the stay. Booking
 *                      goes through /api/book/ to Stripe Checkout. Anything
 *                      that is not bookable instantly falls back to the
 *                      existing quote-request flow at /rent/, untouched.
 * /admin/partner/      A partner shop signs in with a Supabase magic link,
 *                      sees its bookings, and sets fleet counts and blocked
 *                      dates. Not linked, not indexed.
 *
 * Both pages carry their own inline script: the script text is rendered in
 * the body and passed in `inlineScripts` so the layout hashes it into the
 * Content-Security-Policy, exactly like the AdSense inline script. The
 * shared app.js is untouched, so no existing page changes.
 */
import { esc, attr } from "../util.mjs";
import { page, breadcrumbSchema } from "../layout.mjs";
import { bookingConfig, BIKE_STYLES } from "./rent.mjs";
import { ownPhoto, sitePhoto } from "../images.mjs";

export const MIAMI_BOOK_URL = "/cities/miami/book/";
export const PARTNER_DASHBOARD_URL = "/admin/partner/";

/** Fleet styles only: a fleet row never carries the "any" preference. */
const BOOK_STYLES = BIKE_STYLES.filter((s) => s.value !== "any");

const BOOK_JS = [
  "(function () {",
  "  var form = document.querySelector('[data-instant-search]');",
  "  if (!form) return;",
  "  var results = document.querySelector('[data-instant-results]');",
  "  var status = document.querySelector('[data-instant-status]');",
  "  var bookBox = document.querySelector('[data-instant-book]');",
  "  var bookForm = document.querySelector('[data-instant-book-form]');",
  "  var bookSummary = document.querySelector('[data-instant-book-summary]');",
  "  var bookStatus = document.querySelector('[data-instant-book-status]');",
  "  var shops = [];",
  "  var chosen = null;",
  "  var search = null;",
  "  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); }",
  "  function money(c) { return '$' + (c / 100).toFixed(2); }",
  "  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }",
  "  var dateInput = form.querySelector('input[name=\"date\"]');",
  "  dateInput.min = today();",
  "  if (!dateInput.value) dateInput.value = today();",
  "  form.addEventListener('submit', function (e) {",
  "    e.preventDefault();",
  "    var f = new FormData(form);",
  "    search = { date: f.get('date'), style: f.get('style'), qty: parseInt(f.get('qty'), 10) || 1, days: parseInt(f.get('days'), 10) || 1 };",
  "    status.textContent = 'Checking live availability…';",
  "    results.innerHTML = '';",
  "    bookBox.hidden = true;",
  "    chosen = null;",
  "    var q = 'city=miami&date=' + encodeURIComponent(search.date) + '&style=' + encodeURIComponent(search.style) + '&qty=' + search.qty + '&days=' + search.days;",
  "    fetch('/api/availability?' + q).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (res) {",
  "      if (!res.ok) { status.textContent = res.j.error || 'Could not check availability.'; return; }",
  "      shops = res.j.shops || [];",
  "      if (!shops.length) { status.textContent = 'Nothing bookable instantly for that date and style yet. Send a regular request and we will find one for you.'; return; }",
  "      status.textContent = shops.length + ' shop' + (shops.length === 1 ? '' : 's') + ' bookable instantly:';",
  "      results.innerHTML = shops.map(function (s) {",
  "        return '<article class=\"card\"><h3>' + esc(s.shop_name) + '</h3>' +",
  "          '<p class=\"card__count\">' + esc(s.neighborhood ? s.neighborhood + ', ' : '') + esc(s.address || '') + '</p>' +",
  "          (s.delivery_available ? '<p><strong>Delivery available</strong></p>' : '') +",
  "          '<p>' + money(s.day_cents) + ' per day · ' + s.available + ' bike' + (s.available === 1 ? '' : 's') + ' free</p>' +",
  "          '<p>Rental ' + money(s.rental_cents) + ' + booking fee ' + money(s.fee_cents) + ' = <strong>' + money(s.total_cents) + '</strong></p>' +",
  "          '<button class=\"btn btn--primary\" type=\"button\" data-book-shop=\"' + esc(s.shop_id) + '\">Book this shop</button></article>';",
  "      }).join('');",
  "      var btns = results.querySelectorAll('[data-book-shop]');",
  "      btns.forEach(function (b) { b.addEventListener('click', function () {",
  "        var id = b.getAttribute('data-book-shop');",
  "        chosen = null;",
  "        shops.forEach(function (s) { if (s.shop_id === id) chosen = s; });",
  "        if (!chosen) return;",
  "        bookSummary.innerHTML = '<p><strong>' + esc(chosen.shop_name) + '</strong><br>' + esc(search.date) + ' for ' + search.days + ' day' + (search.days === 1 ? '' : 's') + ' · ' + search.qty + ' bike' + (search.qty === 1 ? '' : 's') + '<br>Rental ' + money(chosen.rental_cents) + ' + booking fee ' + money(chosen.fee_cents) + ' = <strong>' + money(chosen.total_cents) + '</strong></p>';",
  "        bookStatus.textContent = '';",
  "        bookBox.hidden = false;",
  "        bookBox.scrollIntoView();",
  "      }); });",
  "    }).catch(function () { status.textContent = 'Could not check availability. Try again.'; });",
  "  });",
  "  bookForm.addEventListener('submit', function (e) {",
  "    e.preventDefault();",
  "    if (!chosen || !search) return;",
  "    var f = new FormData(bookForm);",
  "    bookStatus.textContent = 'Creating your checkout…';",
  "    fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({",
  "      shop_id: chosen.shop_id, style: search.style, qty: search.qty, start_date: search.date, days: search.days,",
  "      rider_name: f.get('rider_name'), rider_email: f.get('rider_email'), rider_phone: f.get('rider_phone')",
  "    }) }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (res) {",
  "      if (!res.ok || !res.j.url) { bookStatus.textContent = res.j.error || 'Could not start checkout.'; return; }",
  "      window.location = res.j.url;",
  "    }).catch(function () { bookStatus.textContent = 'Could not start checkout. Try again.'; });",
  "  });",
  "})();",
].join("\n");

export function miamiBookPage(site) {
  const crumbs = [
    { href: "/", label: "Home" },
    { href: "/cities/miami/", label: "Miami" },
    { href: MIAMI_BOOK_URL, label: "Book instantly" },
  ];
  const body = `
<section class="section rent">
  <div class="wrap wrap-narrow">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/cities/miami/">Miami</a></li><li aria-current="page">Book instantly</li></ol></nav>
    <h1>Book an Ebike Instantly in Miami</h1>
    <p class="lede">Instant booking is in pilot in Miami: the shops below publish live availability, so what you see is
    actually free on your day. Pick a date and a style, book and pay on the spot — no waiting for a quote.</p>
    <form class="rent-form" data-instant-search novalidate>
      <div class="rent-form__grid">
        <label class="field">
          <span>Day</span>
          <input type="date" name="date" required>
        </label>
        <label class="field">
          <span>How many bikes?</span>
          <input type="number" name="qty" min="1" max="50" value="2" inputmode="numeric">
        </label>
        <label class="field">
          <span>How many days?</span>
          <input type="number" name="days" min="1" max="30" value="1" inputmode="numeric">
        </label>
      </div>
      <fieldset class="rent-styles">
        <legend>Bike style</legend>
        <div class="rent-styles__grid">
          ${BOOK_STYLES.map(
            (s, i) => `<label class="rent-style">
            <input type="radio" name="style" value="${attr(s.value)}"${i === 0 ? " checked" : ""}>
            <span class="rent-style__body"><strong>${esc(s.label)}</strong><span>${esc(s.note)}</span></span>
          </label>`
          ).join("")}
        </div>
      </fieldset>
      <button class="btn btn--primary btn--block" type="submit">Check availability</button>
      <p class="rent-form__status" data-instant-status role="status" aria-live="polite"></p>
    </form>
    <div data-instant-results></div>
    <div data-instant-book hidden>
      <h2>Book this shop</h2>
      <div data-instant-book-summary></div>
      <form class="rent-form" data-instant-book-form novalidate>
        <div class="rent-form__grid">
          <label class="field">
            <span>Your name</span>
            <input type="text" name="rider_name" required maxlength="120" autocomplete="name">
          </label>
          <label class="field">
            <span>Phone</span>
            <input type="tel" name="rider_phone" maxlength="40" autocomplete="tel" inputmode="tel">
          </label>
          <label class="field">
            <span>Email</span>
            <input type="email" name="rider_email" maxlength="180" autocomplete="email">
          </label>
        </div>
        <label class="rent-form__consent">
          <input type="checkbox" name="consent" required>
          <span>You can call or text me about this booking, and share the booking details with the shop.
          See our <a href="/privacy/">privacy policy</a> and <a href="/terms/#rent-now-bookings">booking terms</a>.</span>
        </label>
        <p class="small muted">Give us a phone number or an email, so we can reach you.</p>
        <button class="btn btn--primary btn--block" type="submit">Continue to secure checkout</button>
        <p class="rent-form__status" data-instant-book-status role="status" aria-live="polite"></p>
      </form>
    </div>
    <p class="small muted mt-3">Don't see the shop, style or date you need? <a href="/rent/">Send a regular request</a> and
    we will find one for you, the way the rest of the site works. Full refund if you cancel 24 hours or more before
    your rental; no refund after that. <a href="/terms/#rent-now-bookings">Booking terms</a>.</p>
    ${sitePhoto("cruiser-ebikes-baskets", { className: "rent-figure" })}
    ${ownPhoto()}
  </div>
</section>
<script>${BOOK_JS}</script>`;

  return page(site, {
    title: "Book an Ebike Instantly in Miami - Florida Ebike Rentals",
    description:
      "Book an e-bike instantly in Miami: live availability from onboarded rental shops, priced before you pay. No waiting for a quote.",
    path: MIAMI_BOOK_URL,
    body,
    inlineScripts: [BOOK_JS],
    schema: [breadcrumbSchema(site, crumbs)],
  });
}

const PARTNER_JS = [
  "(function () {",
  "  var root = document.querySelector('[data-partner]');",
  "  if (!root) return;",
  "  var endpoint = root.getAttribute('data-endpoint');",
  "  var key = root.getAttribute('data-key');",
  "  var loginForm = root.querySelector('[data-partner-login]');",
  "  var loginStatus = root.querySelector('[data-partner-login-status]');",
  "  var app = root.querySelector('[data-partner-app]');",
  "  var S = null;",
  "  var shopId = null;",
  "  function save() { try { sessionStorage.setItem('fer-partner', JSON.stringify(S)); } catch (e) {} }",
  "  function load() { try { var v = JSON.parse(sessionStorage.getItem('fer-partner') || 'null'); if (v && v.t) S = v; } catch (e) {} }",
  "  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); }",
  "  function money(c) { return '$' + (c / 100).toFixed(2); }",
  "  function cents(v) { var n = Math.round(parseFloat(v) * 100); return isNaN(n) ? 0 : n; }",
  "  function headers(extra) { var h = { apikey: key, Authorization: 'Bearer ' + S.t, 'Content-Type': 'application/json' }; for (var k in extra) h[k] = extra[k]; return h; }",
  "  function api(path, opts) {",
  "    opts = opts || {};",
  "    var req = { method: opts.method || 'GET', headers: headers(opts.headers) };",
  "    if (opts.body) req.body = JSON.stringify(opts.body);",
  "    return fetch(endpoint + path, req)",
  "      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });",
  "  }",
  "  function refresh() {",
  "    if (!S || !S.r) return Promise.resolve(false);",
  "    return fetch(endpoint + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: S.r }) })",
  "      .then(function (r) { return r.json(); }).then(function (j) {",
  "        if (!j.access_token) return false;",
  "        S = { t: j.access_token, r: j.refresh_token || S.r, x: Date.now() + (j.expires_in || 3600) * 1000 }; save(); return true;",
  "      }).catch(function () { return false; });",
  "  }",
  "  function authed() {",
  "    if (S && S.x > Date.now() + 60000) return Promise.resolve(true);",
  "    if (S && S.r) return refresh();",
  "    return Promise.resolve(false);",
  "  }",
  "  function setStatus(el, msg) { if (el) el.textContent = msg || ''; }",
  "  function showApp(show) { loginForm.hidden = show; app.hidden = !show; }",
  "  function loadBookings() {",
  "    var box = root.querySelector('[data-partner-bookings]');",
  "    box.textContent = 'Loading bookings…';",
  "    api('/rest/v1/fer_bookings?shop_id=eq.' + shopId + '&order=created_at.desc&limit=100&select=*').then(function (res) {",
  "      if (!res.ok) { box.textContent = 'Could not load bookings.'; return; }",
  "      var rows = res.j || [];",
  "      if (!rows.length) { box.textContent = 'No bookings yet.'; return; }",
  "      box.innerHTML = '<table><thead><tr><th>Dates</th><th>Style</th><th>Bikes</th><th>Rider</th><th>Status</th><th>Total</th></tr></thead><tbody>' + rows.map(function (b) {",
  "        return '<tr><td>' + esc(b.start_date) + ' (' + b.days + 'd)</td><td>' + esc(b.style) + '</td><td>' + b.qty + '</td><td>' + esc(b.rider_name) + '</td><td>' + esc(b.status) + '</td><td>' + money(b.total_cents) + '</td></tr>';",
  "      }).join('') + '</tbody></table>';",
  "    });",
  "  }",
  "  function loadFleet() {",
  "    var box = root.querySelector('[data-partner-fleet]');",
  "    box.textContent = 'Loading fleet…';",
  "    api('/rest/v1/fer_fleet?shop_id=eq.' + shopId + '&order=style&select=*').then(function (res) {",
  "      if (!res.ok) { box.textContent = 'Could not load fleet.'; return; }",
  "      var rows = res.j || [];",
  "      box.innerHTML = rows.map(function (f) {",
  "        return '<form class=\"rent-form\" data-fleet-row=\"' + esc(f.id) + '\"><strong>' + esc(f.style) + '</strong> ' +",
  "          '<label class=\"field\"><span>Bikes</span><input type=\"number\" name=\"total\" min=\"0\" max=\"500\" value=\"' + f.total + '\"></label> ' +",
  "          '<label class=\"field\"><span>Day $</span><input type=\"number\" name=\"day\" min=\"0\" step=\"0.01\" value=\"' + (f.day_cents / 100).toFixed(2) + '\"></label> ' +",
  "          '<label class=\"field\"><span>Half day $</span><input type=\"number\" name=\"half\" min=\"0\" step=\"0.01\" value=\"' + (f.half_day_cents == null ? '' : (f.half_day_cents / 100).toFixed(2)) + '\"></label> ' +",
  "          '<label class=\"field\"><span>Week $</span><input type=\"number\" name=\"week\" min=\"0\" step=\"0.01\" value=\"' + (f.week_cents == null ? '' : (f.week_cents / 100).toFixed(2)) + '\"></label> ' +",
  "          '<button class=\"btn btn--outline btn--sm\" type=\"submit\">Save</button> <span data-fleet-status></span></form>';",
  "      }).join('') || '<p class=\"muted\">No fleet rows yet. Add a style below.</p>';",
  "      box.querySelectorAll('[data-fleet-row]').forEach(function (fm) {",
  "        fm.addEventListener('submit', function (e) {",
  "          e.preventDefault();",
  "          var d = new FormData(fm);",
  "          var st = fm.querySelector('[data-fleet-status]');",
  "          api('/rest/v1/fer_fleet?id=eq.' + fm.getAttribute('data-fleet-row'), { method: 'PATCH', body: {",
  "            total: parseInt(d.get('total'), 10) || 0, day_cents: cents(d.get('day')),",
  "            half_day_cents: d.get('half') === '' ? null : cents(d.get('half')),",
  "            week_cents: d.get('week') === '' ? null : cents(d.get('week')) } }).then(function (r) {",
  "            setStatus(st, r.ok ? 'Saved.' : 'Could not save.');",
  "          });",
  "        });",
  "      });",
  "    });",
  "  }",
  "  function loadBlocks() {",
  "    var box = root.querySelector('[data-partner-blocks]');",
  "    box.textContent = 'Loading blocked dates…';",
  "    api('/rest/v1/fer_booking_blocks?shop_id=eq.' + shopId + '&order=block_date&select=*').then(function (res) {",
  "      if (!res.ok) { box.textContent = 'Could not load blocked dates.'; return; }",
  "      var rows = res.j || [];",
  "      box.innerHTML = rows.map(function (b) {",
  "        return '<p>' + esc(b.block_date) + ' · ' + esc(b.style) + ' · ' + (b.full_block ? 'fully blocked' : b.blocked + ' blocked') +",
  "          ' <button class=\"btn btn--outline btn--sm\" type=\"button\" data-block-del=\"' + esc(b.id) + '\">Remove</button></p>';",
  "      }).join('') || '<p class=\"muted\">No blocked dates.</p>';",
  "      box.querySelectorAll('[data-block-del]').forEach(function (btn) {",
  "        btn.addEventListener('click', function () {",
  "          api('/rest/v1/fer_booking_blocks?id=eq.' + btn.getAttribute('data-block-del'), { method: 'DELETE' }).then(function () { loadBlocks(); });",
  "        });",
  "      });",
  "    });",
  "  }",
  "  function start() {",
  "    authed().then(function (ok) {",
  "      if (!ok) { showApp(false); return; }",
  "      showApp(true);",
  "      api('/rest/v1/fer_partner_shops?select=*').then(function (res) {",
  "        var rows = (res.ok && res.j) || [];",
  "        var head = root.querySelector('[data-partner-shop]');",
  "        if (!rows.length) { head.textContent = 'No partner shop is linked to this email yet.'; return; }",
  "        shopId = rows[0].id;",
  "        head.textContent = rows[0].shop_name;",
  "        loadBookings(); loadFleet(); loadBlocks();",
  "      });",
  "    });",
  "  }",
  "  loginForm.addEventListener('submit', function (e) {",
  "    e.preventDefault();",
  "    var email = new FormData(loginForm).get('email');",
  "    setStatus(loginStatus, 'Sending your sign-in link…');",
  "    fetch(endpoint + '/auth/v1/otp', { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },",
  "      body: JSON.stringify({ email: email, create_user: false, redirect_to: window.location.href.split('#')[0] }) })",
  "      .then(function () { setStatus(loginStatus, 'If this email is linked to a partner shop, you will receive a sign-in link.'); })",
  "      .catch(function () { setStatus(loginStatus, 'Could not send a link. Try again.'); });",
  "  });",
  "  root.querySelector('[data-partner-logout]').addEventListener('click', function () {",
  "    S = null; shopId = null;",
  "    try { sessionStorage.removeItem('fer-partner'); } catch (e) {}",
  "    showApp(false);",
  "  });",
  "  var addFleet = root.querySelector('[data-partner-add-fleet]');",
  "  addFleet.addEventListener('submit', function (e) {",
  "    e.preventDefault();",
  "    var d = new FormData(addFleet);",
  "    api('/rest/v1/fer_fleet', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: {",
  "      shop_id: shopId, style: d.get('style'), total: parseInt(d.get('total'), 10) || 0, day_cents: cents(d.get('day')),",
  "      half_day_cents: d.get('half') === '' ? null : cents(d.get('half')),",
  "      week_cents: d.get('week') === '' ? null : cents(d.get('week')) } }).then(function (r) {",
  "      setStatus(root.querySelector('[data-partner-add-fleet-status]'), r.ok ? 'Added.' : 'Could not add (that style may already exist).');",
  "      if (r.ok) loadFleet();",
  "    });",
  "  });",
  "  var addBlock = root.querySelector('[data-partner-add-block]');",
  "  addBlock.addEventListener('submit', function (e) {",
  "    e.preventDefault();",
  "    var d = new FormData(addBlock);",
  "    api('/rest/v1/fer_booking_blocks', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: {",
  "      shop_id: shopId, style: d.get('style'), block_date: d.get('block_date'),",
  "      blocked: d.get('full') ? 0 : (parseInt(d.get('blocked'), 10) || 0), full_block: !!d.get('full') } }).then(function (r) {",
  "      setStatus(root.querySelector('[data-partner-add-block-status]'), r.ok ? 'Added.' : 'Could not add.');",
  "      if (r.ok) loadBlocks();",
  "    });",
  "  });",
  "  (function () {",
  "    var m = /access_token=([^&]+)/.exec(window.location.hash);",
  "    if (m) {",
  "      var r = /refresh_token=([^&]+)/.exec(window.location.hash);",
  "      var x = /expires_in=([^&]+)/.exec(window.location.hash);",
  "      S = { t: decodeURIComponent(m[1]), r: r ? decodeURIComponent(r[1]) : null, x: Date.now() + (parseInt(x ? x[1] : '3600', 10)) * 1000 };",
  "      save();",
  "      history.replaceState(null, '', window.location.pathname + window.location.search);",
  "    } else { load(); }",
  "  })();",
  "  start();",
  "})();",
].join("\n");

export function partnerDashboardPage(site) {
  const cfg = bookingConfig(site);
  const body = `
<section class="section admin">
  <div class="wrap">
    <h1>Partner Dashboard</h1>
    ${
      cfg
        ? ""
        : `<p class="notice">Booking is not connected yet. Add your Supabase project URL and anon key to <code>data/site.json</code> under <code>booking</code>.</p>`
    }
    <div data-partner${cfg ? ` data-endpoint="${attr(cfg.url)}" data-key="${attr(cfg.key)}"` : ""}>
      <form class="admin-login" data-partner-login>
        <label class="field"><span>Email</span><input type="email" name="email" required autocomplete="username"></label>
        <button class="btn btn--blue" type="submit">Email me a sign-in link</button>
        <p class="small" data-partner-login-status role="status"></p>
      </form>
      <div data-partner-app hidden>
        <div class="admin-bar">
          <span data-partner-shop></span>
          <button class="btn btn--outline btn--sm" type="button" data-partner-logout>Sign out</button>
        </div>
        <h2>Bookings</h2>
        <div data-partner-bookings></div>
        <h2>Fleet and rates</h2>
        <div data-partner-fleet></div>
        <form class="rent-form" data-partner-add-fleet>
          <div class="rent-form__grid">
            <label class="field"><span>Style</span><select name="style" required>
              ${BOOK_STYLES.map((s) => `<option value="${attr(s.value)}">${esc(s.label)}</option>`).join("")}
            </select></label>
            <label class="field"><span>Bikes</span><input type="number" name="total" min="0" max="500" value="0"></label>
            <label class="field"><span>Day $</span><input type="number" name="day" min="0" step="0.01"></label>
            <label class="field"><span>Half day $</span><input type="number" name="half" min="0" step="0.01"></label>
            <label class="field"><span>Week $</span><input type="number" name="week" min="0" step="0.01"></label>
          </div>
          <button class="btn btn--outline btn--sm" type="submit">Add style</button>
          <span data-partner-add-fleet-status></span>
        </form>
        <h2>Blocked dates</h2>
        <div data-partner-blocks></div>
        <form class="rent-form" data-partner-add-block>
          <div class="rent-form__grid">
            <label class="field"><span>Date</span><input type="date" name="block_date" required></label>
            <label class="field"><span>Style</span><select name="style" required>
              ${BOOK_STYLES.map((s) => `<option value="${attr(s.value)}">${esc(s.label)}</option>`).join("")}
            </select></label>
            <label class="field"><span>Bikes blocked</span><input type="number" name="blocked" min="0" max="500" value="0"></label>
            <label class="rent-form__consent"><input type="checkbox" name="full"><span>Block the whole fleet that day</span></label>
          </div>
          <button class="btn btn--outline btn--sm" type="submit">Block date</button>
          <span data-partner-add-block-status></span>
        </form>
      </div>
    </div>
  </div>
</section>
<script>${PARTNER_JS}</script>`;

  return page(site, {
    title: "Partner Dashboard - Florida Ebike Rentals",
    description: "Partner dashboard.",
    path: PARTNER_DASHBOARD_URL,
    body,
    noindex: true,
    inlineScripts: [PARTNER_JS],
    connectHosts: cfg ? [cfg.url] : [],
  });
}
