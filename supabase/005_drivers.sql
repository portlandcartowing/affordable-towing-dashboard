-- Drivers table — each driver/user who logs into the ACT app
-- The id column matches auth.users(id) from Supabase Auth (Google sign-in)

create table if not exists public.drivers (
  id             uuid primary key,
  name           text,
  phone          text,
  email          text,
  status         text not null default 'available'
                 check (status in ('available', 'busy', 'offline')),
  area           text,
  hookup_fee     numeric(10, 2) not null default 95,
  rate_per_mile  numeric(10, 2) not null default 4,
  created_at     timestamptz not null default now()
);

create index if not exists drivers_status_idx on public.drivers (status);

-- For now, insert dad as a driver with a placeholder UUID.
-- Once he signs in with Google, the app will upsert with his real auth ID.
-- This row ensures the webhook finds at least one driver to ring.
insert into public.drivers (id, name, phone, status, hookup_fee, rate_per_mile)
values (
  '00000000-0000-0000-0000-000000000001',
  'Dad',
  '+15033888741',
  'available',
  95,
  4
) on conflict (id) do nothing;
