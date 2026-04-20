import { supabase } from "./supabase";
import type { Lead } from "./types";

// ---------------------------------------------------------------------------
// Time helpers — pure, no I/O.
//
// Uses Intl to resolve "today" in the user's timezone. On Vercel (UTC),
// new Date().setHours(0,0,0,0) gives midnight UTC, not midnight Pacific.
// By formatting the current date as YYYY-MM-DD in the target zone and
// parsing back, we get the correct boundary regardless of server TZ.
// ---------------------------------------------------------------------------

// Default timezone — matches the user's business location.
const TZ = "America/Los_Angeles";

function midnightInZone(tz: string, daysAgo = 0): string {
  const now = new Date();
  if (daysAgo > 0) now.setDate(now.getDate() - daysAgo);
  // Get the calendar date in the target timezone
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "2026-04-19"
  // Get the UTC offset for midnight in that timezone on that date
  // by creating a date and checking what Intl says the time is
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const localHour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(probe),
  );
  const offsetHours = localHour - 12;
  // Midnight local = midnight + offset as UTC
  const midnight = new Date(`${dateStr}T00:00:00Z`);
  midnight.setHours(midnight.getHours() - offsetHours);
  return midnight.toISOString();
}

export function startOfToday() {
  return midnightInZone(TZ);
}

export function startOfWeek() {
  return midnightInZone(TZ, 6);
}

// ---------------------------------------------------------------------------
// Leads — one fetch, many derived numbers.
//
// The old layer ran 3 queries for today's leads (count, booked-count,
// revenue-rows) plus another for the week. This version fetches 7 days of
// leads in a single request and derives everything in memory. For a local
// towing business that's at most a few hundred rows per week.
// ---------------------------------------------------------------------------

export type LeadRow = Pick<
  Lead,
  | "id"
  | "created_at"
  | "customer"
  | "phone"
  | "service"
  | "city"
  | "source"
  | "booked"
  | "price"
  | "notes"
>;

export async function getLeadsSince(sinceIso: string): Promise<LeadRow[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, created_at, customer, phone, service, city, source, booked, price, notes")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as LeadRow[];
}

export type LeadSummary = { count: number; booked: number; revenue: number };

export function summarizeLeads(rows: LeadRow[]): LeadSummary {
  let booked = 0;
  let revenue = 0;
  for (const row of rows) {
    if (row.booked) {
      booked += 1;
      revenue += Number(row.price || 0);
    }
  }
  return { count: rows.length, booked, revenue };
}
