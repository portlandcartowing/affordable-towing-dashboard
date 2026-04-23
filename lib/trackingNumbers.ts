import { supabaseAdmin as supabase } from "./supabaseAdmin";
import type { TrackingNumber } from "./types";

/**
 * Get all active tracking numbers. Used by the settings page and by the
 * Twilio webhook to look up which number was dialed.
 */
export async function getTrackingNumbers(): Promise<TrackingNumber[]> {
  const { data, error } = await supabase
    .from("tracking_numbers")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as TrackingNumber[];
}

/**
 * Look up a tracking number by the phone number string (E.164 format).
 * This is the core attribution function — called by the Twilio webhook
 * to tag every inbound call with its source.
 */
export async function lookupTrackingNumber(
  phoneNumber: string,
): Promise<TrackingNumber | null> {
  const { data, error } = await supabase
    .from("tracking_numbers")
    .select("*")
    .eq("phone_number", phoneNumber)
    .eq("active", true)
    .single();
  if (error || !data) return null;
  return data as TrackingNumber;
}

/**
 * Get call counts grouped by source for a date range. Powers the
 * "Calls by Source" analytics widget on the dashboard.
 */
export async function getCallCountsBySource(
  sinceIso: string,
): Promise<{ source: string; total: number; booked: number }[]> {
  const { data, error } = await supabase
    .from("calls")
    .select("source, disposition")
    .gte("started_at", sinceIso);
  if (error || !data) return [];

  const map = new Map<string, { total: number; booked: number }>();
  for (const row of data) {
    const source = (row.source as string) || "unknown";
    const existing = map.get(source) ?? { total: 0, booked: 0 };
    existing.total += 1;
    if (row.disposition === "booked") existing.booked += 1;
    map.set(source, existing);
  }

  return Array.from(map.entries())
    .map(([source, counts]) => ({ source, ...counts }))
    .sort((a, b) => b.total - a.total);
}
