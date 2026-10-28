/**
 * POST /api/stripe-webhook/ — Stripe tells us a rider has paid.
 *
 * Set up in Stripe > Developers > Webhooks: endpoint
 * https://www.floridaebikerentals.com/api/stripe-webhook/ with the event
 * checkout.session.completed, then put its signing secret in
 * STRIPE_WEBHOOK_SECRET. Every request's signature is checked before
 * anything is written; the lead or booking is then marked paid with the
 * service key (there is no signed-in user here).
 *
 * Two session kinds arrive here, told apart by metadata:
 *   * lead_id (api/quote.js): the quote flow marks fer_leads paid.
 *   * booking_id (api/book.js): instant booking marks fer_bookings paid.
 * The lead branch below is unchanged from before instant booking existed.
 */
import { env, send, readBody, supabase, verifyStripeSignature, HttpError } from "./_lib.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw new HttpError(405, "Use POST.");
    const raw = await readBody(req);
    if (!verifyStripeSignature(raw, req.headers["stripe-signature"], env("STRIPE_WEBHOOK_SECRET"))) {
      throw new HttpError(400, "Bad signature.");
    }
    const event = JSON.parse(raw.toString("utf8"));
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const id = s.metadata && s.metadata.lead_id;
      if (id && /^[0-9a-f-]{36}$/.test(id) && s.payment_status === "paid") {
        await supabase(`/rest/v1/fer_leads?id=eq.${id}&quote_session_id=eq.${encodeURIComponent(s.id)}`, {
          token: env("SUPABASE_SERVICE_ROLE_KEY"),
          method: "PATCH",
          prefer: "return=minimal",
          body: {
            status: "paid",
            paid_at: new Date().toISOString(),
            paid_cents: s.amount_total,
            stripe_payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : null,
          },
        });
      }
    }
    // Instant bookings (api/book.js): a session carrying booking_id marks
    // the fer_bookings row paid. The session-id filter mirrors the lead
    // branch, so a stray event cannot mark the wrong booking.
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const bookingId = s.metadata && s.metadata.booking_id;
      if (bookingId && /^[0-9a-f-]{36}$/.test(bookingId) && s.payment_status === "paid") {
        await supabase(
          `/rest/v1/fer_bookings?id=eq.${bookingId}&stripe_session_id=eq.${encodeURIComponent(s.id)}`,
          {
            token: env("SUPABASE_SERVICE_ROLE_KEY"),
            method: "PATCH",
            prefer: "return=minimal",
            body: {
              status: "paid",
              paid_at: new Date().toISOString(),
              paid_cents: s.amount_total,
              stripe_payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : null,
            },
          }
        );
      }
    }
    send(res, 200, { received: true });
  } catch (err) {
    send(res, err.status || 500, { error: err.message || "Something went wrong." });
  }
}
