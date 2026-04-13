// ---------------------------------------------------------------------------
// Call tracking integration layer — STRUCTURE ONLY.
//
// Defines the contract for pulling call data from telephony providers
// (CallRail, Twilio, etc). Real implementations plug in as adapters that
// implement CallTrackingAdapter. No third-party APIs are called yet.
//
// The CRM reads calls from Supabase. A future sync worker will pull from
// the provider and upsert rows into the `calls` table — this file is where
// that logic will live.
// ---------------------------------------------------------------------------

import { supabase } from "./supabase";
import type { Call } from "./types";

export type CallTrackingProvider = "callrail" | "twilio" | "manual" | "other";

export interface CallTrackingAdapter {
  provider: CallTrackingProvider;
  label: string;

  /** Pull calls from the provider for a date range and upsert into Supabase. */
  sync(range: { from: string; to: string }): Promise<{ synced: number }>;

  /** Fetch a single call's recording URL (some providers require auth). */
  getRecordingUrl(call: Call): Promise<string | null>;
}

const adapters = new Map<CallTrackingProvider, CallTrackingAdapter>();

export function registerCallAdapter(adapter: CallTrackingAdapter) {
  adapters.set(adapter.provider, adapter);
}

export function getCallAdapter(
  provider: CallTrackingProvider,
): CallTrackingAdapter | null {
  return adapters.get(provider) ?? null;
}

export const AVAILABLE_CALL_PROVIDERS: {
  value: CallTrackingProvider;
  label: string;
}[] = [
  { value: "callrail", label: "CallRail" },
  { value: "twilio", label: "Twilio" },
  { value: "manual", label: "Manual Entry" },
  { value: "other", label: "Other" },
];

// ---------------------------------------------------------------------------
// Read queries — used by the Calls page and Dashboard KPIs.
//
// Single fetch, in-memory derivation. Safe before the `calls` table exists:
// returns an empty array on error so the UI renders cleanly.
// ---------------------------------------------------------------------------

export async function getCalls(limit = 100): Promise<Call[]> {
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as Call[];
}

export type CallSummary = {
  today: number;
  week: number;
  convertedToday: number;
};

/** Derive today/week/converted counts from an already-fetched list of calls. */
export function summarizeCalls(
  calls: Call[],
  todayStartIso: string,
  weekStartIso: string,
): CallSummary {
  let today = 0;
  let week = 0;
  let convertedToday = 0;
  for (const call of calls) {
    const ts = call.started_at ?? call.created_at;
    if (!ts) continue;
    if (ts >= weekStartIso) week += 1;
    if (ts >= todayStartIso) {
      today += 1;
      if (call.converted_to_job) convertedToday += 1;
    }
  }
  return { today, week, convertedToday };
}
