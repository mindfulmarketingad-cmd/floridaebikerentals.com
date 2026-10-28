/**
 * GET /api/availability/ — live availability for onboarded shops.
 *
 * Query: ?city=miami&date=YYYY-MM-DD&style=cruiser&qty=2&days=1
 * Public and read-only. Shops, fleet rates and blocks are read with the anon
 * key, so row-level security decides what is visible (only onboarded shops).
 * Bookings are private (no anon policy), so they are read server-side with
 * the service key and only aggregated counts leave this route: the response
 * never contains rider names, emails, phones or payment details.
 *
 * A shop is bookable for a stay when, for EVERY day in the stay, its fleet
 * total minus blocked bikes minus already-booked bikes is >= qty. Bookings
 * counted: paid and confirmed, plus pending ones created in the last 24h
 * (a pending hold matches the Stripe session expiry; an unpaid session
 * releases the bikes when it expires). api/book.js re-checks the same
 * counts before taking payment.
 *
 * Prices always come from fer_fleet on the server, never from the browser.
 */
import { env, send, supabase, HttpError } from "./_lib.js";

const STYLES = ["cruiser", "fat-tire", "step-through", "hybrid", "trike", "cargo", "pedal"];
const PENDING_HOLD_MS = 24 * 3600 * 1000;

function dayString(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayString(d);
}

function dateRange(start, days) {
  const out = [];
  for (let i = 0; i < days; i++) out.push(addDays(start, i));
  return out;
}

function feeCents() {
  const v = Number(process.env.BOOKING_FEE_CENTS || 2500);
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : 2500;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw new HttpError(405, "Use GET.");
    const url = new URL(req.url, "http://localhost");
    const city = (url.searchParams.get("city") || "miami").toLowerCase();
    if (!/^[a-z0-9-]{1,80}$/.test(city)) throw new HttpError(400, "Bad city.");
    const date = url.searchParams.get("date") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
      throw new HttpError(400, "Give a date like 2026-11-05.");
    }
    if (date < dayString(new Date())) throw new HttpError(400, "That date has passed.");
    const style = url.searchParams.get("style") || "";
    if (!STYLES.includes(style)) throw new HttpError(400, "Unknown bike style.");
    const qty = Number(url.searchParams.get("qty") || 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) throw new HttpError(400, "Qty must be 1 to 50.");
    const days = Number(url.searchParams.get("days") || 1);
    if (!Number.isInteger(days) || days < 1 || days > 30) throw new HttpError(400, "Days must be 1 to 30.");

    const anon = env("SUPABASE_ANON_KEY");
    const service = env("SUPABASE_SERVICE_ROLE_KEY");
    const end = addDays(date, days);
    const dates = dateRange(date, days);

    const shops = await supabase(
      `/rest/v1/fer_partner_shops?select=id,shop_name,city,city_name,address,neighborhood,phone_public,website,delivery_available&city=eq.${city}&onboarded=eq.true&order=shop_name`,
      { token: anon }
    );
    if (!shops.length) {
      return send(res, 200, { city, date, days, style, qty, booking_fee_cents: feeCents(), shops: [] });
    }
    const ids = shops.map((s) => s.id).join(",");
    const fleet = await supabase(
      `/rest/v1/fer_fleet?select=shop_id,style,total,day_cents,half_day_cents,week_cents&shop_id=in.(${ids})&style=eq.${style}`,
      { token: anon }
    );
    const blocks = await supabase(
      `/rest/v1/fer_booking_blocks?select=shop_id,style,block_date,blocked,full_block&shop_id=in.(${ids})&style=eq.${style}&block_date=gte.${date}&block_date=lt.${end}`,
      { token: anon }
    );
    // Bookings are private, so only the server side (service key) may read
    // them. Only counts are used below; nothing rider-identifying is returned.
    const bookings = await supabase(
      `/rest/v1/fer_bookings?select=shop_id,style,qty,start_date,end_date,status,created_at&shop_id=in.(${ids})&style=eq.${style}&start_date=lt.${end}&end_date=gt.${date}&status=in.(paid,confirmed,pending)`,
      { token: service }
    );

    const fleetByShop = new Map(fleet.map((f) => [f.shop_id, f]));
    const blockedByKey = new Map();
    for (const b of blocks) blockedByKey.set(`${b.shop_id}|${b.block_date}`, b);
    const bookedByKey = new Map();
    const holdSince = Date.now() - PENDING_HOLD_MS;
    for (const bk of bookings) {
      if (bk.status === "pending" && Date.parse(bk.created_at) < holdSince) continue;
      for (const d of dates) {
        if (bk.start_date <= d && d < bk.end_date) {
          const key = `${bk.shop_id}|${d}`;
          bookedByKey.set(key, (bookedByKey.get(key) || 0) + bk.qty);
        }
      }
    }

    const out = [];
    for (const shop of shops) {
      const f = fleetByShop.get(shop.id);
      if (!f || !(f.total > 0)) continue;
      let available = f.total;
      for (const d of dates) {
        const b = blockedByKey.get(`${shop.id}|${d}`);
        const blocked = b ? (b.full_block ? f.total : b.blocked) : 0;
        const booked = bookedByKey.get(`${shop.id}|${d}`) || 0;
        available = Math.min(available, f.total - blocked - booked);
      }
      if (available < qty) continue;
      const rental = f.day_cents * qty * days;
      out.push({
        shop_id: shop.id,
        shop_name: shop.shop_name,
        city: shop.city,
        city_name: shop.city_name,
        address: shop.address,
        neighborhood: shop.neighborhood,
        phone_public: shop.phone_public,
        website: shop.website,
        delivery_available: shop.delivery_available,
        day_cents: f.day_cents,
        available,
        rental_cents: rental,
        fee_cents: feeCents(),
        total_cents: rental + feeCents(),
      });
    }
    send(res, 200, { city, date, days, style, qty, booking_fee_cents: feeCents(), shops: out });
  } catch (err) {
    send(res, err.status || 500, { error: err.message || "Something went wrong." });
  }
}
