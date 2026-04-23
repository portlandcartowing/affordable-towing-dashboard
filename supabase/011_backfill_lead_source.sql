-- Backfill leads.source from the tracking number the caller dialed.
--
-- Matches via the lead's linked call → call.tracking_number phone string →
-- tracking_numbers.source. Runs only when the new source differs from the
-- current value, so it's idempotent and safe to re-run.

update public.leads l
set source = tn.source
from public.calls c
join public.tracking_numbers tn
  on tn.phone_number = c.tracking_number
where l.call_id = c.id
  and l.source is distinct from tn.source;

-- Also mirror onto jobs.source? The jobs table doesn't currently have a
-- source column — leads is the canonical profile source.
