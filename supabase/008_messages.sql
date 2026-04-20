-- ============================================================================
-- Migration 008: SMS Messages — inbound and outbound text tracking
--
-- Stores every SMS sent to or received from customers. Linked to calls
-- and leads by phone number match. Enables:
--   - Full message thread view per customer in the call center
--   - Smart processing of inbound texts (name, address, vehicle extraction)
--   - Proposal acceptance via text reply
--   - Push notifications on incoming texts
-- ============================================================================

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- Direction: did we send it or did the customer send it?
  direction       text not null check (direction in ('inbound', 'outbound')),

  -- Phone numbers
  from_number     text not null,
  to_number       text not null,

  -- Message content
  body            text,

  -- Linked records (populated by webhook processing)
  call_id         uuid references public.calls(id) on delete set null,
  lead_id         uuid references public.leads(id) on delete set null,
  job_id          uuid references public.jobs(id) on delete set null,

  -- Processing results
  parsed_fields   jsonb default '{}'::jsonb,  -- extracted name, address, vehicle, etc.

  -- Twilio metadata
  twilio_sid      text,
  status          text default 'received'     -- received, sent, delivered, failed
);

create index if not exists messages_created_idx    on public.messages (created_at desc);
create index if not exists messages_from_idx       on public.messages (from_number);
create index if not exists messages_to_idx         on public.messages (to_number);
create index if not exists messages_call_id_idx    on public.messages (call_id);
create index if not exists messages_lead_id_idx    on public.messages (lead_id);
create index if not exists messages_job_id_idx     on public.messages (job_id);

-- Enable realtime so the call center can show live incoming texts
alter publication supabase_realtime add table public.messages;
