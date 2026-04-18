-- Enable Supabase Realtime on the calls table so the driver app
-- gets instant updates when a new call comes in or transcript updates.
-- Run this in the Supabase SQL Editor.

alter publication supabase_realtime add table public.calls;
alter publication supabase_realtime add table public.proposals;
