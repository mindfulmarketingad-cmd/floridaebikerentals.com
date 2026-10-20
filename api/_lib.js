/**
 * Shared helpers for the booking API. Files starting with "_" are not routes.
 *
 * Environment (Vercel > Project > Settings > Environment Variables):
 *   SUPABASE_URL               https://<project>.supabase.co
 *   SUPABASE_ANON_KEY          the anon / publishable key (also in data/site.json)
 *   SUPABASE_SERVICE_ROLE_KEY  secret; only the Stripe webhook uses it
 *   STRIPE_SECRET_KEY          sk_live_... (or sk_test_... while testing)
 *   STRIPE_WEBHOOK_SECRET      whsec_... from the webhook endpoint in Stripe
 *   SITE_URL                   https://www.floridaebikerentals.com
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function env(name) {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `Server is missing ${name}.`);
  return v;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

/** Calls Supabase's REST API with the given bearer token (a user's, or the service key). */
export async function supabase(path, { token, method = "GET", body, prefer } = {}) {
  const res = await fetch(`${env("SUPABASE_URL")}${path}`, {
    method,
    headers: {
      apikey: token === process.env.SUPABASE_SERVICE_ROLE_KEY ? token : env("SUPABASE_ANON_KEY"),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new HttpError(res.status === 401 ? 401 : 502, (data && (data.message || data.msg)) || `Supabase ${res.status}`);
  return data;
}

/** Calls Stripe's REST API (form-encoded, as Stripe expects). */
export async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new HttpError(502, (data.error && data.error.message) || `Stripe ${res.status}`);
  return data;
}

/**
 * Checks a Stripe-Signature header against the raw body, as Stripe documents:
 * HMAC-SHA256 of "<timestamp>.<body>" with the endpoint secret, within 5 minutes.
 */
export function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1)];
    })
  );
  const t = Number(parts.t);
  const signatures = header
    .split(",")
    .filter((p) => p.trim().startsWith("v1="))
    .map((p) => p.trim().slice(3));
  if (!t || !signatures.length) return false;
  if (Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody.toString("utf8")}`).digest("hex");
  return signatures.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
