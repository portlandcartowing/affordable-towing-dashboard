-- ============================================================================
-- Migration 007: DNI Click Events — website call attribution
--
-- When a visitor clicks a phone number on the website, the DNI script
-- fires a POST to /api/track/click with the visitor's source, UTM params,
-- referrer, and which number they clicked. This table stores those events.
--
-- The voice webhook can then match an incoming call to a click event by
-- phone number + timestamp proximity, giving full attribution:
--   Google Ad campaign → landing page → phone click → inbound call → job
-- ============================================================================

create table if not exists public.click_events (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- Source classification (auto-detected by DNI script)
  source          text not null,         -- "google_ads" | "google_maps" | "google_organic" | "yelp" | "facebook" | "direct" | etc.

  -- UTM parameters (from ad campaign URL)
  utm_campaign    text,
  utm_adgroup     text,
  utm_source      text,
  utm_medium      text,
  utm_term        text,
  utm_content     text,

  -- Google Ads attribution
  gclid           text,
  gbraid          text,
  wbraid          text,

  -- Visitor context
  referrer        text,
  landing_page    text,
  phone_clicked   text,                  -- which number they clicked: "+15036087014" or "+15034066323"
  visitor_ts      timestamptz,           -- when they first arrived on the site

  -- Matched call (populated by voice webhook or background job)
  call_id         uuid references public.calls(id) on delete set null
);

create index if not exists click_events_created_idx on public.click_events (created_at desc);
create index if not exists click_events_source_idx on public.click_events (source);
create index if not exists click_events_phone_idx on public.click_events (phone_clicked);
create index if not exists click_events_gclid_idx on public.click_events (gclid);
create index if not exists click_events_call_id_idx on public.click_events (call_id);

-- Enable realtime so dashboard can show live click events
alter publication supabase_realtime add table public.click_events;
