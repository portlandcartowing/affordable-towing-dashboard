-- Track when the "please reply with dropoff" SMS was sent to a customer.
-- The inbound SMS webhook uses this to decide whether an address-shaped
-- reply should be auto-filled into jobs.dropoff_*.

alter table public.jobs
  add column if not exists dropoff_requested_at timestamptz;

create index if not exists jobs_dropoff_requested_idx
  on public.jobs (dropoff_requested_at);
