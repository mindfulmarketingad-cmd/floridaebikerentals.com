-- Florida Ebike Rentals: booking leads.
--
-- Run once in Supabase > SQL Editor. Then:
--   1. Authentication > Users > Add user: your email + a strong password.
--   2. Run:  insert into public.admins (email) values ('you@example.com');
--      with the same email. Only emails in public.admins can read leads.
--   3. Authentication > Sign In / Providers: turn OFF "Allow new users to sign up".
--
-- The site only ever uses the project URL and the anon (publishable) key.
-- Never put the service_role / secret key in the site or in data/site.json.

create extension if not exists pgcrypto;

create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  status           text not null default 'new'
                     check (status in ('new', 'contacted', 'matched', 'booked', 'lost')),
  name             text not null check (char_length(name) between 1 and 120),
  phone            text check (char_length(phone) <= 40),
  email            text check (char_length(email) <= 180),
  town             text not null check (char_length(town) between 1 and 80),
  town_name        text check (char_length(town_name) <= 120),
  service          text not null
                     check (service in ('ebike-rental', 'bike-rental', 'guided-tour', 'delivery', 'scooter', 'repair')),
  start_date       date,
  bike_style       text check (bike_style in ('cruiser', 'fat-tire', 'step-through', 'hybrid', 'trike', 'cargo', 'pedal', 'any')),
  duration         text check (duration in ('1-2 hours', 'half day', 'full day', 'multi-day', 'not sure')),
  bikes            int check (bikes between 1 and 50),
  notes            text check (char_length(notes) <= 2000),
  listing          text check (char_length(listing) <= 200),
  source           text check (char_length(source) <= 300),
  admin_notes      text,
  assigned_listing text,
  constraint leads_contact_required check (coalesce(phone, '') <> '' or coalesce(email, '') <> '')
);

-- Added after the first version: safe to run again on an existing table.
alter table public.leads add column if not exists bike_style text
  check (bike_style in ('cruiser', 'fat-tire', 'step-through', 'hybrid', 'trike', 'cargo', 'pedal', 'any'));

create index if not exists leads_created_at_idx on public.leads (created_at desc);

create table if not exists public.admins (
  email text primary key
);

alter table public.leads  enable row level security;
alter table public.admins enable row level security;
-- No policies on admins: nobody can read or change it through the API.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "anyone can send a booking request" on public.leads;
create policy "anyone can send a booking request" on public.leads
  for insert to anon, authenticated
  with check (status = 'new' and admin_notes is null and assigned_listing is null);

drop policy if exists "admins read leads" on public.leads;
create policy "admins read leads" on public.leads
  for select to authenticated using (public.is_admin());

drop policy if exists "admins update leads" on public.leads;
create policy "admins update leads" on public.leads
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete leads" on public.leads;
create policy "admins delete leads" on public.leads
  for delete to authenticated using (public.is_admin());

grant insert on public.leads to anon;
grant select, insert, update, delete on public.leads to authenticated;
revoke all on public.admins from anon, authenticated;
