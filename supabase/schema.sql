-- ============================================================================
-- Affordable Car Towing CRM — base schema
--
-- Run this once in the Supabase SQL editor for a fresh project.
-- Safe to re-run: every statement uses IF NOT EXISTS.
--
-- Tables created:
--   leads           — top of funnel (local jobs)
--   calls           — inbound call tracking (CallRail / Twilio / manual)
--   jobs            — operational units a dispatcher works
--   ad_spend_daily  — daily marketing spend rollup per campaign
--
-- Column shapes mirror the TypeScript interfaces in lib/types.ts.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- leads
-- ----------------------------------------------------------------------------
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  customer    text,
  phone       text,
  service     text,
  city        text,
  source      text,
  booked      boolean not null default false,
  price       numeric(10, 2),
  notes       text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_booked_idx     on public.leads (booked);
create index if not exists leads_source_idx     on public.leads (source);

-- ----------------------------------------------------------------------------
-- calls
-- ----------------------------------------------------------------------------
create table if not exists public.calls (
  id                uuid primary key default gen_random_uuid(),
  caller_phone      text,
  source            text,
  tracking_number   text,
  started_at        timestamptz,
  duration_seconds  integer,
  recording_url     text,
  transcript        text,
  converted_to_job  boolean not null default false,
  lead_id           uuid references public.leads(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists calls_started_at_idx       on public.calls (started_at desc);
create index if not exists calls_tracking_number_idx  on public.calls (tracking_number);
create index if not exists calls_lead_id_idx          on public.calls (lead_id);
create index if not exists calls_converted_idx        on public.calls (converted_to_job);

-- ----------------------------------------------------------------------------
-- jobs
-- ----------------------------------------------------------------------------
-- Job status enum matches JOB_STATUSES in lib/types.ts. Using a CHECK
-- constraint instead of a pg enum so new statuses can be added without
-- ALTER TYPE gymnastics.
create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid references public.leads(id) on delete set null,
  created_at      timestamptz not null default now(),
  status          text not null default 'new_lead'
                  check (status in (
                    'new_lead',
                    'quoted',
                    'booked',
                    'waiting_for_driver',
                    'posted_to_load_board',
                    'driver_assigned',
                    'in_transit',
                    'completed',
                    'cancelled'
                  )),

  customer        text,
  phone           text,

  vehicle_year    integer,
  vehicle_make    text,
  vehicle_model   text,
  vehicle_running boolean,

  pickup_address  text,
  pickup_city     text,
  pickup_state    text,
  pickup_zip      text,

  dropoff_address text,
  dropoff_city    text,
  dropoff_state   text,
  dropoff_zip     text,

  distance_miles  numeric(8, 2),
  price           numeric(10, 2),
  driver_pay      numeric(10, 2),
  notes           text,

  driver_id       uuid,
  scheduled_for   timestamptz
);

create index if not exists jobs_created_at_idx    on public.jobs (created_at desc);
create index if not exists jobs_status_idx        on public.jobs (status);
create index if not exists jobs_lead_id_idx       on public.jobs (lead_id);
create index if not exists jobs_scheduled_for_idx on public.jobs (scheduled_for);

-- ----------------------------------------------------------------------------
-- ad_spend_daily
-- ----------------------------------------------------------------------------
create table if not exists public.ad_spend_daily (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  campaign     text not null,
  cost         numeric(10, 2) not null default 0,
  clicks       integer not null default 0,
  conversions  integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (date, campaign)
);

create index if not exists ad_spend_daily_date_idx on public.ad_spend_daily (date desc);

-- ----------------------------------------------------------------------------
-- Row level security
--
-- For development we leave RLS OFF so the anon key used by the Next.js
-- client can read and write. When deploying to production:
--   1. Enable RLS on each table
--   2. Add policies tied to auth.uid() or a dispatcher role
-- ----------------------------------------------------------------------------
-- alter table public.leads          enable row level security;
-- alter table public.calls          enable row level security;
-- alter table public.jobs           enable row level security;
-- alter table public.ad_spend_daily enable row level security;
