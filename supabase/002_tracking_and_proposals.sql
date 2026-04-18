-- ============================================================================
-- Migration 002: Call source attribution + proposal system
--
-- New tables:
--   tracking_numbers  — maps each phone number to a source/channel
--   proposals         — standby quotes sent to customers with accept link
--
-- Extended tables:
--   calls             — adds tracking_number_id FK, dispatcher fields,
--                       call disposition, structured transcript storage
--   leads             — adds proposal_id FK
--
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / IF NOT).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- tracking_numbers — the attribution layer.
--
-- Each phone number you put on an ad, on GMB, or on your website maps to
-- exactly one row here. When a call comes in via Twilio, the webhook looks
-- up which tracking number was dialed and tags the call with its source.
-- ----------------------------------------------------------------------------
create table if not exists public.tracking_numbers (
  id           uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  label        text not null,          -- human name: "Google Ads — Portland"
  source       text not null,          -- canonical: "google_ads" | "gbp" | "website" | "facebook" | "craigslist"
  channel      text not null,          -- "paid" | "organic" | "direct" | "referral"
  campaign     text,                   -- optional campaign tag
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists tn_source_idx on public.tracking_numbers (source);
create index if not exists tn_active_idx on public.tracking_numbers (active);

-- ----------------------------------------------------------------------------
-- proposals — the standby/follow-up system.
--
-- When dad marks a call as "standby", we generate a proposal with a unique
-- token. Customer gets an SMS link to /proposal/[token] where they can see
-- the quote, ETA, and hit Accept. accepted_at serves as legal proof.
-- ----------------------------------------------------------------------------
create table if not exists public.proposals (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid references public.leads(id) on delete set null,
  call_id         uuid references public.calls(id) on delete set null,
  token           text not null unique default encode(gen_random_bytes(16), 'hex'),

  -- Quote details
  service_type    text,
  quoted_price    numeric(10, 2),
  eta_min         integer,             -- minutes low end
  eta_max         integer,             -- minutes high end
  driver_area     text,                -- "SE Portland", "Gresham area" — vague on purpose
  route_summary   text,                -- "8.2 mi via I-205 S"
  vehicle_desc    text,                -- "2015 Toyota Camry"
  pickup_address  text,
  dropoff_address text,
  notes           text,

  -- Customer interaction
  sent_at         timestamptz,         -- when SMS was sent
  viewed_at       timestamptz,         -- when customer opened the link
  accepted_at     timestamptz,         -- when customer clicked Accept (legal proof)
  expired_at      timestamptz,         -- auto-expire after N hours

  status          text not null default 'draft'
                  check (status in ('draft', 'sent', 'viewed', 'accepted', 'expired', 'cancelled')),

  created_at      timestamptz not null default now()
);

create index if not exists proposals_token_idx   on public.proposals (token);
create index if not exists proposals_lead_id_idx on public.proposals (lead_id);
create index if not exists proposals_call_id_idx on public.proposals (call_id);
create index if not exists proposals_status_idx  on public.proposals (status);

-- ----------------------------------------------------------------------------
-- Extend calls — add attribution + dispatcher workflow fields.
--
-- ALTER TABLE ADD COLUMN IF NOT EXISTS is safe to re-run.
-- ----------------------------------------------------------------------------

-- Attribution: links to the tracking number that was dialed
alter table public.calls add column if not exists
  tracking_number_id uuid references public.tracking_numbers(id) on delete set null;

-- Dispatcher workflow
alter table public.calls add column if not exists
  disposition text default null
  check (disposition is null or disposition in (
    'booked',
    'standby',
    'lost',
    'callback',
    'spam'
  ));

alter table public.calls add column if not exists
  lost_reason text;

alter table public.calls add column if not exists
  callback_at timestamptz;

alter table public.calls add column if not exists
  dispatcher text;

alter table public.calls add column if not exists
  proposal_id uuid references public.proposals(id) on delete set null;

alter table public.calls add column if not exists
  quoted_price numeric(10, 2);

alter table public.calls add column if not exists
  ai_summary text;

-- Structured transcript (array of {speaker, text, at} objects)
-- Kept as jsonb so we can append chunks without a join table.
alter table public.calls add column if not exists
  transcript_chunks jsonb default '[]'::jsonb;

-- New indexes
create index if not exists calls_disposition_idx     on public.calls (disposition);
create index if not exists calls_tracking_number_id  on public.calls (tracking_number_id);
create index if not exists calls_proposal_id_idx     on public.calls (proposal_id);

-- ----------------------------------------------------------------------------
-- Extend leads — link back to proposal if one exists
-- ----------------------------------------------------------------------------
alter table public.leads add column if not exists
  proposal_id uuid references public.proposals(id) on delete set null;

alter table public.leads add column if not exists
  call_id uuid references public.calls(id) on delete set null;

-- ----------------------------------------------------------------------------
-- Seed tracking numbers — REPLACE these with your real Twilio numbers.
--
-- Format: E.164 (+1XXXXXXXXXX) so Twilio webhook matching is exact.
-- For now these are placeholder numbers. Update the phone_number column
-- once you buy the Twilio numbers.
-- ----------------------------------------------------------------------------
insert into public.tracking_numbers (phone_number, label, source, channel, campaign)
values
  ('+15035550101', 'Google Ads — Portland Tow', 'google_ads', 'paid', 'portland_tow_local'),
  ('+15035550102', 'Google Business Profile',   'gbp',        'organic', null),
  ('+15035550103', 'Website — Main',            'website',    'direct',  null),
  ('+15035550104', 'Facebook Ads',              'facebook',   'paid',    'fb_portland_tow')
on conflict (phone_number) do nothing;

-- ============================================================================
-- Done. Your tables now:
--
--   tracking_numbers ──┐
--                      ├──→ calls ──→ leads ──→ jobs
--   proposals ─────────┘           ↘ proposals
--
-- Next: update your Twilio numbers in the tracking_numbers table,
-- then wire the Twilio webhook to tag each call automatically.
-- ============================================================================
