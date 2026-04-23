"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { JobStatus } from "@/lib/types";

const revalidateAll = () => {
  revalidatePath("/jobs");
  revalidatePath("/leads");
  revalidatePath("/calls");
  revalidatePath("/call-center");
  revalidatePath("/dashboard");
};

// Maps job status back to call disposition + lead booked state
const JOB_TO_CALL: Record<string, { disposition: string | null; booked: boolean }> = {
  new_lead:           { disposition: null,        booked: false },
  quoted:             { disposition: "standby",   booked: false },
  standby:            { disposition: "standby",   booked: false },
  callback:           { disposition: "callback",  booked: false },
  lost:               { disposition: "lost",      booked: false },
  spam:               { disposition: "spam",      booked: false },
  booked:             { disposition: "booked",    booked: true },
  waiting_for_driver: { disposition: "booked",    booked: true },
  posted_to_load_board: { disposition: "booked",  booked: true },
  driver_assigned:    { disposition: "booked",    booked: true },
  in_transit:         { disposition: "booked",    booked: true },
  completed:          { disposition: "booked",    booked: true },
  cancelled:          { disposition: "lost",      booked: false },
};

export async function updateJobStatus(jobId: string, status: JobStatus) {
  // Get linked lead before updating
  const { data: job } = await supabase
    .from("jobs")
    .select("lead_id")
    .eq("id", jobId)
    .single();

  // Update job status
  const { error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId);

  if (error) return { ok: false, error: error.message };

  // Sync linked lead and call
  if (job?.lead_id) {
    const sync = JOB_TO_CALL[status];
    if (sync) {
      // Update lead
      await supabase
        .from("leads")
        .update({ booked: sync.booked })
        .eq("id", job.lead_id);

      // Update linked call
      await supabase
        .from("calls")
        .update({
          disposition: sync.disposition,
          converted_to_job: sync.booked,
        })
        .eq("lead_id", job.lead_id);
    }
  }

  revalidateAll();
  return { ok: true };
}

// Update the customer-facing price on a booked job. Also syncs the
// linked lead's price so the Revenue dashboard KPI reflects the new
// total. Drivers will adjust this once the vehicle is hooked up and
// the real mileage is known (base + per-mile).
export async function updateJobPrice(jobId: string, price: number | null) {
  const clean = price == null || Number.isNaN(price) ? null : Math.round(price * 100) / 100;

  const { data: job, error } = await supabase
    .from("jobs")
    .update({ price: clean })
    .eq("id", jobId)
    .select("lead_id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  if (job?.lead_id) {
    await supabase.from("leads").update({ price: clean }).eq("id", job.lead_id);
  }

  revalidateAll();
  return { ok: true as const };
}
