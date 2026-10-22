-- Florida Ebike Rentals: Rent Now booking leads.
--
-- Everything here is prefixed fer_ (Florida Ebike Rentals) so it lives beside
-- other sites' tables in the same Supabase project without touching them:
-- it creates fer_leads, fer_admins and fer_is_admin(), and changes nothing else.
--
-- Run once in Supabase > SQL Editor (safe to run again). Then:
--   1. Authentication > Users > Add user: your email + a strong password
--      (skip if you already have a user for yourself in this project).
--   2. Run:  insert into public.fer_admins (email) values ('you@example.com');
--      Only emails in fer_admins can read Florida Ebike Rentals leads.
--
-- The site only uses the project URL and the anon (publishable) key. The
-- service_role / secret key goes only in Vercel, for the Stripe webhook.

create extension if not exists pgcrypto;

create table if not exists public.fer_leads (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  status                text not null default 'new'
                          check (status in ('new', 'contacted', 'matched', 'quoted', 'paid', 'booked', 'cancelled', 'refunded', 'lost')),
  name                  text not null check (char_length(name) between 1 and 120),
  phone                 text check (char_length(phone) <= 40),
  email                 text check (char_length(email) <= 180),
  town                  text not null check (char_length(town) between 1 and 80),
  town_name             text check (char_length(town_name) <= 120),
  service               text not null
                          check (service in ('ebike-rental', 'bike-rental', 'guided-tour', 'delivery', 'scooter', 'repair')),
  bike_style            text check (bike_style in ('cruiser', 'fat-tire', 'step-through', 'hybrid', 'trike', 'cargo', 'pedal', 'any')),
  start_date            date,
  time_of_day           text check (time_of_day in ('morning', 'midday', 'afternoon', 'sunset', 'flexible')),
  start_time            time,
  duration              text check (duration in ('1-2 hours', 'half day', 'full day', 'multi-day', 'not sure')),
  bikes                 int check (bikes between 1 and 50),
  notes                 text check (char_length(notes) <= 2000),
  listing               text check (char_length(listing) <= 200),
  source                text check (char_length(source) <= 300),
  admin_notes           text,
  assigned_listing      text,
  quote_shop            text,
  quote_details         text check (char_length(quote_details) <= 1000),
  quote_rental_cents    int check (quote_rental_cents between 0 and 10000000),
  quote_fee_cents       int check (quote_fee_cents between 0 and 10000000),
  quote_url             text,
  quote_session_id      text,
  quote_expires_at      timestamptz,
  paid_at               timestamptz,
  paid_cents            int,
  stripe_payment_intent text,
  constraint fer_leads_contact_required check (coalesce(phone, '') <> '' or coalesce(email, '') <> '')
);

-- Added 2026-10-22 (safe to run again; needed if fer_leads already existed).
alter table public.fer_leads add column if not exists time_of_day text
  check (time_of_day in ('morning', 'midday', 'afternoon', 'sunset', 'flexible'));
alter table public.fer_leads add column if not exists start_time time;

create index if not exists fer_leads_created_at_idx on public.fer_leads (created_at desc);

create table if not exists public.fer_admins (
  email text primary key
);

alter table public.fer_leads  enable row level security;
alter table public.fer_admins enable row level security;
-- No policies on fer_admins: nobody can read or change it through the API.

create or replace function public.fer_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.fer_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "fer: anyone can send a booking request" on public.fer_leads;
create policy "fer: anyone can send a booking request" on public.fer_leads
  for insert to anon, authenticated
  with check (
    status = 'new' and admin_notes is null and assigned_listing is null
    and quote_shop is null and quote_details is null and quote_rental_cents is null and quote_fee_cents is null
    and quote_url is null and quote_session_id is null and quote_expires_at is null
    and paid_at is null and paid_cents is null and stripe_payment_intent is null
  );

drop policy if exists "fer: admins read leads" on public.fer_leads;
create policy "fer: admins read leads" on public.fer_leads
  for select to authenticated using (public.fer_is_admin());

drop policy if exists "fer: admins update leads" on public.fer_leads;
create policy "fer: admins update leads" on public.fer_leads
  for update to authenticated using (public.fer_is_admin()) with check (public.fer_is_admin());

drop policy if exists "fer: admins delete leads" on public.fer_leads;
create policy "fer: admins delete leads" on public.fer_leads
  for delete to authenticated using (public.fer_is_admin());

grant insert on public.fer_leads to anon;
grant select, insert, update, delete on public.fer_leads to authenticated;
revoke all on public.fer_admins from anon, authenticated;
revoke all on function public.fer_is_admin() from public, anon;
grant execute on function public.fer_is_admin() to authenticated;
