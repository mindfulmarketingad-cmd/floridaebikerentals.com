-- Florida Ebike Rentals: instant booking (Miami pilot).
--
-- New tables for onboarded partner shops with live availability, following
-- the fer_leads pattern in supabase/leads.sql (same fer_ prefix, same RLS
-- style). This file creates fer_partner_shops, fer_shop_users, fer_fleet,
-- fer_booking_blocks and fer_bookings, and changes nothing else.
--
-- Run once in Supabase > SQL Editor (safe to run again). It is NOT applied
-- by any agent: a human runs it, then the preview branch can be tested.
-- Depends on supabase/leads.sql already applied (for fer_is_admin()).
--
-- Access model (mirrors leads.sql):
--   * Anyone (anon) can read onboarded shops, their fleet rates and their
--     blocks: that is exactly what the public availability check needs.
--   * Bookings are private: no anon access at all. The server route
--     (api/book.js) writes them with the service key; a signed-in shop user
--     reads/updates only its own rows, via fer_shop_ids() below.
--   * fer_shop_users maps a sign-in email to a shop, like fer_admins maps
--     admin emails. It has no policies: nobody reads it through the API.
--   * Payouts are NOT handled here. This chunk collects payment to the
--     site's Stripe account (same as the quote flow); Stripe Connect
--     transfers to shops are a follow-up step. payout_status is a
--     placeholder ('pending' until Connect onboarding exists).

create extension if not exists pgcrypto;

create table if not exists public.fer_partner_shops (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  shop_name           text not null check (char_length(shop_name) between 1 and 200),
  listing_slug        text check (char_length(listing_slug) <= 200),
  city                text not null check (char_length(city) between 1 and 80),
  city_name           text check (char_length(city_name) <= 120),
  address             text check (char_length(address) <= 300),
  neighborhood        text check (char_length(neighborhood) <= 120),
  phone_public        text check (char_length(phone_public) <= 40),
  website             text check (char_length(website) <= 300),
  delivery_available  boolean not null default false,
  onboarded           boolean not null default false,
  payout_status       text not null default 'pending'
                        check (payout_status in ('pending', 'connected'))
);

create table if not exists public.fer_shop_users (
  email      text primary key check (char_length(email) <= 180),
  shop_id    uuid not null references public.fer_partner_shops (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Shops a signed-in user may act for, by sign-in email. Security definer so
-- it can read fer_shop_users, exactly like fer_is_admin() reads fer_admins.
create or replace function public.fer_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select shop_id from public.fer_shop_users
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- One row per shop and bike style. Rates are public by design: the booking
-- page shows them before a rider pays. Never trust a rate from the browser:
-- api/book.js always prices from this table.
create table if not exists public.fer_fleet (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  shop_id        uuid not null references public.fer_partner_shops (id) on delete cascade,
  style          text not null
                   check (style in ('cruiser', 'fat-tire', 'step-through', 'hybrid', 'trike', 'cargo', 'pedal')),
  total          int not null check (total between 0 and 500),
  day_cents      int not null check (day_cents between 0 and 10000000),
  half_day_cents int check (half_day_cents between 0 and 10000000),
  week_cents     int check (week_cents between 0 and 10000000),
  constraint fer_fleet_shop_style_unique unique (shop_id, style)
);

-- Bikes held back on a day: either a count, or the whole fleet (full_block).
create table if not exists public.fer_booking_blocks (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  shop_id    uuid not null references public.fer_partner_shops (id) on delete cascade,
  style      text not null
               check (style in ('cruiser', 'fat-tire', 'step-through', 'hybrid', 'trike', 'cargo', 'pedal')),
  block_date date not null,
  blocked    int not null default 0 check (blocked between 0 and 500),
  full_block boolean not null default false,
  constraint fer_booking_blocks_shop_style_date_unique unique (shop_id, style, block_date)
);

-- A rider's instant booking. end_date is exclusive (start_date + days), so
-- "does this booking cover 2026-11-05?" is start_date <= day < end_date.
-- status 'pending' means a Stripe session was created and payment is awaited
-- (pending holds release after 24h, matching the session expiry); the
-- webhook moves it to 'paid'. 'confirmed' is for a later shop-confirm step.
create table if not exists public.fer_bookings (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  shop_id               uuid not null references public.fer_partner_shops (id) on delete cascade,
  style                 text not null
                          check (style in ('cruiser', 'fat-tire', 'step-through', 'hybrid', 'trike', 'cargo', 'pedal')),
  qty                   int not null check (qty between 1 and 50),
  start_date            date not null,
  end_date              date not null check (end_date > start_date),
  days                  int not null check (days between 1 and 30),
  rider_name            text not null check (char_length(rider_name) between 1 and 120),
  rider_email           text check (char_length(rider_email) <= 180),
  rider_phone           text check (char_length(rider_phone) <= 40),
  status                text not null default 'pending'
                          check (status in ('pending', 'paid', 'confirmed', 'completed', 'cancelled', 'refunded')),
  rental_cents          int not null check (rental_cents between 0 and 10000000),
  fee_cents             int not null check (fee_cents between 0 and 10000000),
  total_cents           int not null check (total_cents between 0 and 10000000),
  stripe_session_id     text,
  stripe_payment_intent text,
  paid_at               timestamptz,
  paid_cents            int,
  source                text not null default 'instant' check (char_length(source) <= 40),
  constraint fer_bookings_contact_required check (coalesce(rider_email, '') <> '' or coalesce(rider_phone, '') <> '')
);

create index if not exists fer_booking_blocks_shop_date_idx
  on public.fer_booking_blocks (shop_id, block_date);
create index if not exists fer_bookings_shop_start_idx
  on public.fer_bookings (shop_id, start_date);
create unique index if not exists fer_bookings_session_unique_idx
  on public.fer_bookings (stripe_session_id) where stripe_session_id is not null;

alter table public.fer_partner_shops enable row level security;
alter table public.fer_shop_users      enable row level security;
alter table public.fer_fleet           enable row level security;
alter table public.fer_booking_blocks  enable row level security;
alter table public.fer_bookings        enable row level security;
-- No policies on fer_shop_users: nobody can read or change it through the API.

drop policy if exists "fer: anyone can see onboarded partner shops" on public.fer_partner_shops;
create policy "fer: anyone can see onboarded partner shops" on public.fer_partner_shops
  for select to anon using (onboarded = true);

drop policy if exists "fer: admins and own shop read partner shops" on public.fer_partner_shops;
create policy "fer: admins and own shop read partner shops" on public.fer_partner_shops
  for select to authenticated
  using (public.fer_is_admin() or id in (select public.fer_shop_ids()));

drop policy if exists "fer: admins manage partner shops" on public.fer_partner_shops;
create policy "fer: admins manage partner shops" on public.fer_partner_shops
  for all to authenticated
  using (public.fer_is_admin()) with check (public.fer_is_admin());

drop policy if exists "fer: anyone can see onboarded fleet" on public.fer_fleet;
create policy "fer: anyone can see onboarded fleet" on public.fer_fleet
  for select to anon using (
    exists (select 1 from public.fer_partner_shops s where s.id = shop_id and s.onboarded)
  );

drop policy if exists "fer: admins and own shop read fleet" on public.fer_fleet;
create policy "fer: admins and own shop read fleet" on public.fer_fleet
  for select to authenticated
  using (public.fer_is_admin() or shop_id in (select public.fer_shop_ids()));

drop policy if exists "fer: admins and own shop write fleet" on public.fer_fleet;
create policy "fer: admins and own shop write fleet" on public.fer_fleet
  for all to authenticated
  using (public.fer_is_admin() or shop_id in (select public.fer_shop_ids()))
  with check (public.fer_is_admin() or shop_id in (select public.fer_shop_ids()));

drop policy if exists "fer: anyone can see onboarded blocks" on public.fer_booking_blocks;
create policy "fer: anyone can see onboarded blocks" on public.fer_booking_blocks
  for select to anon using (
    exists (select 1 from public.fer_partner_shops s where s.id = shop_id and s.onboarded)
  );

drop policy if exists "fer: admins and own shop read blocks" on public.fer_booking_blocks;
create policy "fer: admins and own shop read blocks" on public.fer_booking_blocks
  for select to authenticated
  using (public.fer_is_admin() or shop_id in (select public.fer_shop_ids()));

drop policy if exists "fer: admins and own shop write blocks" on public.fer_booking_blocks;
create policy "fer: admins and own shop write blocks" on public.fer_booking_blocks
  for all to authenticated
  using (public.fer_is_admin() or shop_id in (select public.fer_shop_ids()))
  with check (public.fer_is_admin() or shop_id in (select public.fer_shop_ids()));

drop policy if exists "fer: admins and own shop read bookings" on public.fer_bookings;
create policy "fer: admins and own shop read bookings" on public.fer_bookings
  for select to authenticated
  using (public.fer_is_admin() or shop_id in (select public.fer_shop_ids()));

drop policy if exists "fer: admins and own shop update bookings" on public.fer_bookings;
create policy "fer: admins and own shop update bookings" on public.fer_bookings
  for update to authenticated
  using (public.fer_is_admin() or shop_id in (select public.fer_shop_ids()))
  with check (public.fer_is_admin() or shop_id in (select public.fer_shop_ids()));

drop policy if exists "fer: admins delete bookings" on public.fer_bookings;
create policy "fer: admins delete bookings" on public.fer_bookings
  for delete to authenticated using (public.fer_is_admin());

grant select on public.fer_partner_shops, public.fer_fleet, public.fer_booking_blocks to anon;
grant select, insert, update, delete
  on public.fer_partner_shops, public.fer_fleet, public.fer_booking_blocks, public.fer_bookings
  to authenticated;
revoke all on public.fer_shop_users from anon, authenticated;
revoke all on function public.fer_shop_ids() from public, anon;
grant execute on function public.fer_shop_ids() to authenticated;

-- ============================================================ EXAMPLE SEED DATA
-- The Miami pilot's one onboarded shop, so the instant flow is testable
-- before any real shop onboards. THESE RATES AND FLEET COUNTS ARE PLACEHOLDERS:
-- replace them with the shop's real rates at onboarding, and never take a
-- real payment against seed rates. No shop sign-in is seeded here: onboarding
-- inserts the shop's email into fer_shop_users (never invent an address).
-- ============================================================
insert into public.fer_partner_shops
  (id, shop_name, city, city_name, address, neighborhood, delivery_available, onboarded, payout_status)
values
  ('11111111-1111-4111-8111-111111111111',
   'SunCycling Cycle and Fitness Shop', 'miami', 'Miami',
   '3001 SW 27th Ave, Miami, FL 33133', 'Coconut Grove', true, true, 'pending')
on conflict (id) do nothing;

-- EXAMPLE SEED DATA: placeholder fleet and rates for SunCycling.
insert into public.fer_fleet (shop_id, style, total, day_cents, half_day_cents, week_cents) values
  ('11111111-1111-4111-8111-111111111111', 'cruiser', 12, 6500, 4000, 35000),
  ('11111111-1111-4111-8111-111111111111', 'fat-tire', 6, 8500, 5500, 45000),
  ('11111111-1111-4111-8111-111111111111', 'step-through', 8, 7000, 4500, 40000)
on conflict (shop_id, style) do nothing;
