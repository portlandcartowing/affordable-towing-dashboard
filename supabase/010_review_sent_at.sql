-- Track when the Google review SMS was auto-sent for a job so the trigger
-- in updateJobStatus() doesn't fire twice on repeat status flips.

alter table public.jobs
  add column if not exists review_sent_at timestamptz;

create index if not exists jobs_review_sent_at_idx
  on public.jobs (review_sent_at);
