-- Allow drivers to be added from the dashboard before they sign in.
-- The id gets a default UUID so admin can create the row with just email/name.
-- When the driver signs in with Google, DriverClient updates the id to match auth.users.id.

alter table public.drivers alter column id set default gen_random_uuid();

-- Add unique constraint on email so we can look up drivers by email during login
create unique index if not exists drivers_email_idx on public.drivers (email);
