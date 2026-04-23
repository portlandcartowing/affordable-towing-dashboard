-- Phase N2: customer-facing live tracking link.
--
-- tracking_token    → opaque token used in the public /track/[token] URL
-- current_lat/lng   → driver's last-reported coordinates (used by existing
--                     /api/driver/location endpoint)
-- location_updated_at → timestamp of that push (stale-after threshold)

alter table public.jobs
  add column if not exists tracking_token        text,
  add column if not exists current_lat           double precision,
  add column if not exists current_lng           double precision,
  add column if not exists location_updated_at   timestamptz;

create unique index if not exists jobs_tracking_token_uk
  on public.jobs (tracking_token)
  where tracking_token is not null;
