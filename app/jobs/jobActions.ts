"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
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
  new_lead:           { disposition: null,       booked: false },
  quoted:             { disposition: "standby",  booked: false },
  booked:             { disposition: "booked",   booked: true },
  waiting_for_driver: { disposition: "booked",   booked: true },
  posted_to_load_board: { disposition: "booked", booked: true },
  driver_assigned:    { disposition: "booked",   booked: true },
  in_transit:         { disposition: "booked",   booked: true },
  completed:          { disposition: "booked",   booked: true },
  cancelled:          { disposition: "lost",     booked: false },
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
