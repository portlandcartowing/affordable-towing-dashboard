import { supabase } from "./supabase";
import type { Lead } from "./types";

// ---------------------------------------------------------------------------
// Time helpers — pure, no I/O.
// ---------------------------------------------------------------------------

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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
