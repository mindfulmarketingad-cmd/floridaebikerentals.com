# Rent Now bookings: setup

Riders send a request on `/rent/`. You quote them from `/admin/leads/` (the shop's
price plus your booking fee), they pay you through Stripe, and you book the shop.

## 1. Supabase

This can share a Supabase project with other sites: everything is prefixed
`fer_` (tables `fer_leads` and `fer_admins`, function `fer_is_admin()`) and the
script changes nothing else.

1. SQL Editor: run `supabase/leads.sql` (safe to run again).
2. Authentication > Users: add yourself (email + strong password), or use the user
   you already have in this project.
3. SQL Editor: `insert into public.fer_admins (email) values ('your@email');`
4. Leave "Allow new users to sign up" as your other sites need it: being signed in
   is not enough to read these leads, only emails in `fer_admins` can.
5. Project Settings > API: the Project URL and anon key go in `data/site.json`
   under `booking` (already done).

## 2. Stripe webhook

Stripe > Developers > Webhooks > Add endpoint:

- URL: `https://www.floridaebikerentals.com/api/stripe-webhook/` (keep the trailing slash)
- Event: `checkout.session.completed`

Copy the endpoint's signing secret (`whsec_...`).

## 3. Vercel environment variables

Project > Settings > Environment Variables (Production), then redeploy:

| Name | Value |
|---|---|
| `SUPABASE_URL` | the Project URL |
| `SUPABASE_ANON_KEY` | the anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret / service_role key (secret) |
| `STRIPE_SECRET_KEY` | `sk_live_...` (`sk_test_...` to test) (secret) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from step 2 (secret) |
| `SITE_URL` | `https://www.floridaebikerentals.com` |

Secrets live only in Vercel. Never put them in the code or in `data/site.json`.

## 4. Test before going live

With `sk_test_...` and a test webhook: send a request on `/rent/`, quote it in
`/admin/leads/`, pay with card `4242 4242 4242 4242`, and check the lead turns **paid**.
Then switch to live keys.

## Running a booking

1. New lead: check a matching shop has the style free on the date, and that its
   cancellation terms are no stricter than yours (full refund 24h+).
2. Enter the shop's price (including the tax it charges you), your fee and pickup details,
   then **Create payment link**, and text or email the message.
3. When it shows **Paid**, book and pay the shop, set **Booked**, and send the confirmation.
4. Cancellation 24h+ before, or the shop can't deliver: refund in Stripe (link on the lead),
   set **Refunded**.
