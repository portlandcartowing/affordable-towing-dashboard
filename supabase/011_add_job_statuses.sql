-- Add standby, callback, lost, and spam as valid job statuses
-- so job status can match call/lead dispositions exactly.
-- Drop the old constraint and add a new one with all values.

alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check
  check (status in (
    'new_lead',
    'quoted',
    'booked',
    'standby',
    'callback',
    'lost',
    'spam',
    'waiting_for_driver',
    'posted_to_load_board',
    'driver_assigned',
    'in_transit',
    'completed',
    'cancelled'
  ));
