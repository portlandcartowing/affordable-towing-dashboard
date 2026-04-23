import { supabaseAdmin as supabase } from "./supabaseAdmin";
import { startOfToday } from "./queries";
import type { Job } from "./types";

/**
 * Returns the set of lead IDs that already have a linked job. Used by the
 * Leads and Calls pages to disable "Create Job" / "Create Lead" buttons and
 * to render an "in job" badge. One tiny query, one column.
 */
export async function getLeadIdsWithJobs(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("jobs")
    .select("lead_id")
    .not("lead_id", "is", null);
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.lead_id as string));
}

/**
 * For each lead_id, the most-recent linked job's id + status. Used by the
 * Leads page to render inline Mark-Complete / Delete / Convert actions
 * without an extra round-trip per row.
 */
export async function getJobsByLeadId(): Promise<
  Record<string, { jobId: string; status: string }>
> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, lead_id, status, created_at")
    .not("lead_id", "is", null)
    .order("created_at", { ascending: false });
  if (error || !data) return {};
  const out: Record<string, { jobId: string; status: string }> = {};
  for (const row of data) {
    const leadId = row.lead_id as string;
    if (!out[leadId]) {
      out[leadId] = { jobId: row.id as string, status: row.status as string };
    }
  }
  return out;
}

export async function getJobs(limit = 100): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as Job[];
}

export type JobsMetrics = {
  scheduled: number;
  inProgress: number;
  completedToday: number;
  avgTicket: number;
};

/** Derive metrics from an already-fetched list of jobs. One Supabase round-trip
 *  feeds both the KPI cards and the job queue table. */
export function summarizeJobs(jobs: Job[]): JobsMetrics {
  const todayStart = startOfToday();
  let scheduled = 0;
  let inProgress = 0;
  let completedToday = 0;
  let pricedSum = 0;
  let pricedCount = 0;

  for (const j of jobs) {
    if (j.status === "booked" || j.status === "waiting_for_driver") scheduled += 1;
    if (j.status === "in_transit" || j.status === "driver_assigned") inProgress += 1;
    if (j.status === "completed" && j.created_at >= todayStart) completedToday += 1;
    if (j.price != null) {
      pricedSum += Number(j.price);
      pricedCount += 1;
    }
  }

  return {
    scheduled,
    inProgress,
    completedToday,
    avgTicket: pricedCount > 0 ? pricedSum / pricedCount : 0,
  };
}
