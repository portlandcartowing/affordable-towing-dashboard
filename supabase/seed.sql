-- ============================================================================
-- Affordable Car Towing CRM — sample seed data
--
-- Run AFTER schema.sql. Safe to run multiple times: it clears the sample
-- rows before re-inserting. If you have real data, do NOT run this — it
-- will wipe the four tables.
-- ============================================================================

-- Wipe (dev only)
truncate table public.ad_spend_daily restart identity cascade;
truncate table public.jobs           restart identity cascade;
truncate table public.calls          restart identity cascade;
truncate table public.leads          restart identity cascade;

-- ----------------------------------------------------------------------------
-- Leads (3 rows)
-- ----------------------------------------------------------------------------
insert into public.leads (id, created_at, customer, phone, service, city, source, booked, price, notes)
values
  ('11111111-1111-1111-1111-111111111111',
   now() - interval '2 hours',
   'Maria Lopez', '555-210-4411', 'Tow', 'Phoenix', 'Google Ads',
   true, 185.00, 'Sedan, dead battery, running now'),

  ('22222222-2222-2222-2222-222222222222',
   now() - interval '5 hours',
   'James Carter', '555-887-2031', 'Jump Start', 'Tempe', 'Facebook',
   true, 75.00, 'Parking lot near mall'),

  ('33333333-3333-3333-3333-333333333333',
   now() - interval '20 minutes',
   'Alicia Nguyen', '555-663-9090', 'Lockout', 'Mesa', 'SEO',
   false, null, 'Waiting on callback');

-- ----------------------------------------------------------------------------
-- Calls (5 rows) — two linked to leads, one converted, rest open
-- ----------------------------------------------------------------------------
insert into public.calls (caller_phone, source, tracking_number, started_at,
                          duration_seconds, transcript, converted_to_job, lead_id, notes)
values
  ('555-210-4411', 'google_ads', '602-555-0110',
   now() - interval '2 hours 5 minutes', 182,
   'Caller needs tow from parking lot, sedan not starting. Confirmed pickup address.',
   true, '11111111-1111-1111-1111-111111111111', 'Converted to booked tow'),

  ('555-887-2031', 'facebook', '602-555-0120',
   now() - interval '5 hours 3 minutes', 96,
   'Jump start request. Customer said battery dead after lights left on.',
   true, '22222222-2222-2222-2222-222222222222', null),

  ('555-663-9090', 'seo', '602-555-0130',
   now() - interval '22 minutes', 45,
   'Lockout, keys inside. Asked for ETA, said they would call back.',
   false, '33333333-3333-3333-3333-333333333333', 'Follow up in 30 min'),

  ('555-404-1212', 'google_ads', '602-555-0110',
   now() - interval '1 hour', 12,
   'Hung up after quoting price.',
   false, null, 'Price shopper'),

  ('555-909-7788', 'organic', '602-555-0140',
   now() - interval '3 hours', 210,
   'Wants transport for non-running truck to Tucson. Long distance.',
   false, null, 'Potential national lead — route through dispatch');

-- ----------------------------------------------------------------------------
-- Jobs (2 rows) — created from the two booked leads
-- ----------------------------------------------------------------------------
insert into public.jobs (lead_id, status, customer, phone,
                         vehicle_year, vehicle_make, vehicle_model, vehicle_running,
                         pickup_city, pickup_state, dropoff_city, dropoff_state,
                         distance_miles, price, driver_pay, notes, scheduled_for)
values
  ('11111111-1111-1111-1111-111111111111',
   'in_transit',
   'Maria Lopez', '555-210-4411',
   2018, 'Honda', 'Civic', true,
   'Phoenix', 'AZ', 'Phoenix', 'AZ',
   6.4, 185.00, 110.00,
   'Local tow, customer waiting on scene',
   now() - interval '1 hour'),

  ('22222222-2222-2222-2222-222222222222',
   'completed',
   'James Carter', '555-887-2031',
   2015, 'Ford', 'F-150', false,
   'Tempe', 'AZ', 'Tempe', 'AZ',
   2.1, 75.00, 45.00,
   'Jump start, resolved on site',
   now() - interval '4 hours');

-- ----------------------------------------------------------------------------
-- Ad spend (2 rows)
-- ----------------------------------------------------------------------------
insert into public.ad_spend_daily (date, campaign, cost, clicks, conversions)
values
  (current_date,                     'Phoenix — Local Tow',    142.50, 38, 4),
  (current_date - interval '1 day',  'Phoenix — Local Tow',    128.00, 31, 3);
