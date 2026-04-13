# Supabase Setup

SQL for the Affordable Car Towing CRM database.

## Files

- `schema.sql` — creates the four core tables (`leads`, `calls`, `jobs`, `ad_spend_daily`), indexes, foreign keys, and a CHECK constraint for job status. Safe to re-run (`IF NOT EXISTS`).
- `seed.sql` — wipes and repopulates the tables with a small set of realistic sample rows for local development. **Do not run against production data.**

## First-time setup

1. Open the Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the contents of `schema.sql` and run it.
3. (Optional, dev only) Paste the contents of `seed.sql` and run it.
4. Confirm the Next.js app's `.env.local` has:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
5. Restart `next dev`.

## Row Level Security

RLS is currently **disabled** so the anon key can read/write during development. Before shipping to production, enable RLS (commented block at the bottom of `schema.sql`) and add policies — either tied to `auth.uid()` or to a dispatcher role.

## Schema ↔ types

Column shapes match the TypeScript interfaces in [`lib/types.ts`](../lib/types.ts) (`Lead`, `Call`, `Job`). If you change one, update the other.
