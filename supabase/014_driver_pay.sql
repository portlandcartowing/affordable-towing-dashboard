-- 014_driver_pay.sql
-- Driver pay model:
--   total = hookup_fee + (rate_per_mile * miles) + adjustment
--   driver_pay = total * commission_pct
--   gross_profit = total - driver_pay
--
-- Drivers already carry hookup_fee + rate_per_mile (005). This migration
-- adds the commission % and the per-job adjustment fields, plus a column
-- for the actually-collected amount (separate from the quoted/calculated
-- total) so we can reconcile what the customer paid against what we billed.

-- 1. commission_pct on drivers (0-100 stored as integer for clarity).
--    Default 50% to match the verbal example Davey gave.
alter table public.drivers
  add column if not exists commission_pct integer not null default 50
    check (commission_pct between 0 and 100);

-- 2. Per-job adjustment + reason. Drivers cannot override the auto-computed
--    total but can add or subtract from it with a short note explaining
--    why (e.g. "winch-out fee", "discount for repeat customer").
alter table public.jobs
  add column if not exists adjustment       numeric(10, 2) not null default 0,
  add column if not exists adjustment_note  text;

-- 3. Actual amount collected from customer at job completion. Separate from
--    `price` (which can be the quoted/calculated total) so we can show
--    quoted vs paid side by side and notice gaps.
alter table public.jobs
  add column if not exists paid_amount      numeric(10, 2);

-- 4. Convenience: helpful indexes for filtering jobs by driver and date.
create index if not exists jobs_driver_id_idx     on public.jobs (driver_id);
create index if not exists jobs_completed_at_idx  on public.jobs (completed_at);
