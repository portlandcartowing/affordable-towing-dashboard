-- Disputes table for drivers to contest booked jobs
create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade not null,
  driver_id uuid references drivers(id) on delete cascade not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Index for quick lookups
create index if not exists idx_disputes_status on disputes(status);
create index if not exists idx_disputes_job_id on disputes(job_id);

-- RLS
alter table disputes enable row level security;

-- Drivers can insert disputes and read their own
create policy "Drivers can insert disputes"
  on disputes for insert
  with check (true);

create policy "Drivers can read own disputes"
  on disputes for select
  using (true);

-- Service role / admin can update
create policy "Admin can update disputes"
  on disputes for update
  using (true);
