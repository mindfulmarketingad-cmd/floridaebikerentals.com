-- Florida Ebike Rentals: add the ride time to Rent Now leads.
-- Run once in Supabase > SQL Editor. Safe to run again. Touches only fer_leads.

alter table public.fer_leads add column if not exists time_of_day text
  check (time_of_day in ('morning', 'midday', 'afternoon', 'sunset', 'flexible'));

alter table public.fer_leads add column if not exists start_time time;

-- Make the API see the new columns straight away.
notify pgrst, 'reload schema';
