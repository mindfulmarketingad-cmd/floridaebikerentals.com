/**
 * POST /api/book/ — create an instant booking and its Stripe Checkout session.
 *
 * Body: { shop_id, style, qty, start_date, days, rider_name, rider_email,
 *   rider_phone } (email or phone required, like fer_leads).
 *
 * Only onboarded Miami shops are bookable here: this is the pilot gate, and
 * lifting the city check is the multi-city step. The shop, its fleet rate
 * and its blocks are re-read server-side and availability is re-checked
 * before any payment is created, so a rider can never pay for bikes that
 * are not free. Prices come from fer_fleet, never from the request.
 *
 * This chunk collects payment to the site's Stripe account, exactly like
 * the quote flow does today (api/quote.js). Stripe Connect transfers to
 * shops are a follow-up step, not this chunk.
 *
 * Known limit, shared with the quote flow: two riders booking the last
 * bikes at the same moment could both pass the check. A future database
 * function with row locking would close that gap; for the pilot, the shop
 * confirms the booking (status 'confirmed') after payment.
 */
import { env, send, readBody, supabase, stripe, HttpError } from "./_lib.js";

const STYLES = {
  cruiser: "beach cruiser e-bike",
  "fat-tire": "fat-tire e-bike",
  "step-through": "step-through e-bike",
  hybrid: "commuter / hybrid e-bike",
  trike: "electric trike",
  cargo: "family / cargo e-bike",
  pedal: "regular beach cruiser",
};
const MAX_CENTS = 1000000; // $10,000 per booking, a sanity cap (mirrors quote.js)
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
    if (req.method !== "POST") throw new HttpError(405, "Use POST.");
    const input = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const shopId = String(input.shop_id || "");
    if (!/^[0-9a-f-]{36}$/.test(shopId)) throw new HttpError(400, "Missing shop.");
    const style = String(input.style || "");
    if (!Object.hasOwn(STYLES, style)) throw new HttpError(400, "Unknown bike style.");
    const qty = Math.round(Number(input.qty));
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) throw new HttpError(400, "Qty must be 1 to 50.");
    const days = Math.round(Number(input.days || 1));
    if (!Number.isInteger(days) || days < 1 || days > 30) throw new HttpError(400, "Days must be 1 to 30.");
    const startDate = String(input.start_date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(`${startDate}T12:00:00Z`))) {
      throw new HttpError(400, "Give a date like 2026-11-05.");
    }
    if (startDate < dayString(new Date())) throw new HttpError(400, "That date has passed.");
    const name = String(input.rider_name || "").slice(0, 120);
    if (!name) throw new HttpError(400, "Give your name.");
    const email = String(input.rider_email || "").slice(0, 180);
    const phone = String(input.rider_phone || "").slice(0, 40);
    if (!email && !phone) throw new HttpError(400, "Give an email or a phone number.");

    const endDate = addDays(startDate, days);
    const dates = dateRange(startDate, days);
    const service = env("SUPABASE_SERVICE_ROLE_KEY");

    const [shop] = await supabase(`/rest/v1/fer_partner_shops?id=eq.${shopId}&select=*`, { token: service });
    if (!shop) throw new HttpError(404, "Shop not found.");
    if (!shop.onboarded) throw new HttpError(409, "This shop is not bookable instantly yet.");
    if (shop.city !== "miami") throw new HttpError(409, "Instant booking is Miami only in this pilot.");
    const [fleet] = await supabase(
      `/rest/v1/fer_fleet?shop_id=eq.${shopId}&style=eq.${style}&select=*`,
      { token: service }
    );
    if (!fleet || !(fleet.total > 0)) throw new HttpError(409, "This shop does not offer that style.");
    const blocks = await supabase(
      `/rest/v1/fer_booking_blocks?shop_id=eq.${shopId}&style=eq.${style}&block_date=gte.${startDate}&block_date=lt.${endDate}&select=*`,
      { token: service }
    );
    const bookings = await supabase(
      `/rest/v1/fer_bookings?shop_id=eq.${shopId}&style=eq.${style}&start_date=lt.${endDate}&end_date=gt.${startDate}&status=in.(paid,confirmed,pending)&select=*`,
      { token: service }
    );
    const blockedByDate = new Map(blocks.map((b) => [b.block_date, b]));
    const holdSince = Date.now() - PENDING_HOLD_MS;
    for (const d of dates) {
      const b = blockedByDate.get(d);
      const blocked = b ? (b.full_block ? fleet.total : b.blocked) : 0;
      let booked = 0;
      for (const bk of bookings) {
        if (bk.status === "pending" && Date.parse(bk.created_at) < holdSince) continue;
        if (bk.start_date <= d && d < bk.end_date) booked += bk.qty;
      }
      if (fleet.total - blocked - booked < qty) {
        throw new HttpError(409, `Not enough bikes free on ${d}.`);
      }
    }

    const rental = fleet.day_cents * qty * days;
    const fee = feeCents();
    const total = rental + fee;
    if (!(rental > 0 && total <= MAX_CENTS)) throw new HttpError(400, "That booking is priced out of range.");

    const [booking] = await supabase("/rest/v1/fer_bookings", {
      token: service,
      method: "POST",
      prefer: "return=representation",
      body: {
        shop_id: shopId,
        style,
        qty,
        start_date: startDate,
        end_date: endDate,
        days,
        rider_name: name,
        rider_email: email || null,
        rider_phone: phone || null,
        status: "pending",
        rental_cents: rental,
        fee_cents: fee,
        total_cents: total,
        source: "instant",
      },
    });

    const site = env("SITE_URL").replace(/\/+$/, "");
    const when = `${startDate} for ${days} day${days === 1 ? "" : "s"}`;
    const expiresAt = Math.floor(Date.now() / 1000) + 23 * 3600;
    const params = {
      mode: "payment",
      success_url: `${site}/rent/paid/?booking_id=${booking.id}`,
      cancel_url: `${site}/rent/`,
      expires_at: String(expiresAt),
      "metadata[booking_id]": booking.id,
      "payment_intent_data[metadata][booking_id]": booking.id,
      "payment_intent_data[description]": `Instant booking ${booking.id.slice(0, 8)} - ${shop.shop_name}`,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(rental),
      "line_items[0][price_data][product_data][name]": `${qty} x ${STYLES[style]} in Miami`.slice(0, 250),
      "line_items[0][price_data][product_data][description]": `${when} at ${shop.shop_name}`.slice(0, 250),
      "custom_text[submit][message]": `Full refund if you cancel 24 hours or more before your rental; no refund after that. Booking terms: ${site}/terms/#rent-now-bookings`.slice(0, 1000),
    };
    if (fee > 0) {
      params["line_items[1][quantity]"] = "1";
      params["line_items[1][price_data][currency]"] = "usd";
      params["line_items[1][price_data][unit_amount]"] = String(fee);
      params["line_items[1][price_data][product_data][name]"] = "Booking fee";
    }
    if (email) params.customer_email = email;
    const session = await stripe("/checkout/sessions", params);

    await supabase(`/rest/v1/fer_bookings?id=eq.${booking.id}`, {
      token: service,
      method: "PATCH",
      prefer: "return=minimal",
      body: { stripe_session_id: session.id },
    });
    send(res, 200, {
      url: session.url,
      booking: {
        id: booking.id,
        shop_id: shopId,
        shop_name: shop.shop_name,
        style,
        qty,
        start_date: startDate,
        days,
        rental_cents: rental,
        fee_cents: fee,
        total_cents: total,
      },
    });
  } catch (err) {
    send(res, err.status || 500, { error: err.message || "Something went wrong." });
  }
}
