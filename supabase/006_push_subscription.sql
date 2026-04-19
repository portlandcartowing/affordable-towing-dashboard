-- Add push subscription storage to drivers table
alter table public.drivers add column if not exists
  push_subscription jsonb default null;
