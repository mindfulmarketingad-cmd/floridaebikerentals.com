/**
 * POST /api/quote/  — the lead desk creates a Stripe payment link for a lead.
 *
 * Only a signed-in admin can call it: the caller's Supabase token is checked
 * with fer_is_admin(), and the lead is read and updated with that same token, so
 * row-level security applies exactly as it does in the lead desk.
 *
 * The rider sees two lines at checkout: the shop's rental price, and our
 * booking fee. The link expires after 23 hours (Stripe allows at most 24).
 */
import { env, send, readBody, supabase, stripe, HttpError } from "./_lib.js";

const MAX_CENTS = 1000000; // $10,000 per booking, a sanity cap
// Same styles as BIKE_STYLES in src/pages/rent.mjs.
const STYLE_LABELS = {
  cruiser: "beach cruiser e-bike", "fat-tire": "fat-tire e-bike", "step-through": "step-through e-bike",
  hybrid: "commuter / hybrid e-bike", trike: "electric trike", cargo: "family / cargo e-bike",
  pedal: "regular beach cruiser", any: "",
};
const SERVICE_LABELS = {
  "ebike-rental": "e-bike rental", "bike-rental": "bike rental", "guided-tour": "guided e-bike tour",
  delivery: "rental with delivery", scooter: "scooter rental", repair: "e-bike repair",
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw new HttpError(405, "Use POST.");
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Sign in first.");
    const isAdmin = await supabase("/rest/v1/rpc/fer_is_admin", { token, method: "POST", body: {} });
    if (isAdmin !== true) throw new HttpError(403, "This account cannot send quotes.");

    const input = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const id = String(input.lead_id || "");
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "Missing lead.");
    const rental = Math.round(Number(input.rental_cents));
    const fee = Math.round(Number(input.fee_cents));
    if (!(rental > 0 && rental <= MAX_CENTS)) throw new HttpError(400, "Enter the shop's rental price.");
    if (!(fee >= 0 && fee <= MAX_CENTS)) throw new HttpError(400, "Enter the booking fee (0 or more).");
    const shop = String(input.shop || "").slice(0, 200);
    const details = String(input.details || "").slice(0, 1000);

    const [lead] = await supabase(`/rest/v1/fer_leads?id=eq.${id}&select=*`, { token });
    if (!lead) throw new HttpError(404, "Lead not found.");
    if (lead.status === "paid" || lead.status === "booked") throw new HttpError(409, "This lead is already paid.");

    const site = env("SITE_URL").replace(/\/+$/, "");
    const style = STYLE_LABELS[lead.bike_style] || "";
    const service = SERVICE_LABELS[lead.service] || "rental";
    const what = `${lead.bikes ? `${lead.bikes} x ` : ""}${style ? `${style}, ` : ""}${service}`;
    const where = lead.town_name || lead.town;
    const when = [lead.start_date, lead.duration].filter(Boolean).join(", ");
    const expiresAt = Math.floor(Date.now() / 1000) + 23 * 3600;
    const params = {
      mode: "payment",
      success_url: `${site}/rent/paid/`,
      cancel_url: `${site}/rent/`,
      expires_at: String(expiresAt),
      "metadata[lead_id]": id,
      "payment_intent_data[metadata][lead_id]": id,
      "payment_intent_data[description]": `Rental booking ${id.slice(0, 8)} - ${where}`,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(rental),
      "line_items[0][price_data][product_data][name]": `${what} in ${where}`.slice(0, 250),
      "line_items[0][price_data][product_data][description]": (when || "Rental").slice(0, 250),
      "custom_text[submit][message]": `Full refund if you cancel 24 hours or more before your rental; no refund after that. Booking terms: ${site}/terms/#rent-now-bookings`.slice(0, 1000),
    };
    if (fee > 0) {
      params["line_items[1][quantity]"] = "1";
      params["line_items[1][price_data][currency]"] = "usd";
      params["line_items[1][price_data][unit_amount]"] = String(fee);
      params["line_items[1][price_data][product_data][name]"] = "Booking fee";
    }
    if (lead.email) params.customer_email = lead.email;
    const session = await stripe("/checkout/sessions", params);

    const [updated] = await supabase(`/rest/v1/fer_leads?id=eq.${id}`, {
      token,
      method: "PATCH",
      prefer: "return=representation",
      body: {
        status: "quoted",
        quote_shop: shop || null,
        quote_details: details || null,
        quote_rental_cents: rental,
        quote_fee_cents: fee,
        quote_url: session.url,
        quote_session_id: session.id,
        quote_expires_at: new Date(expiresAt * 1000).toISOString(),
      },
    });
    send(res, 200, { url: session.url, lead: updated });
  } catch (err) {
    send(res, err.status || 500, { error: err.message || "Something went wrong." });
  }
}
