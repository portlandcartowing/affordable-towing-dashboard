"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { sendReviewLink } from "@/app/customers/actions";
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
  // Snapshot the job before updating so we can detect status transitions.
  const { data: jobBefore } = await supabase
    .from("jobs")
    .select("lead_id, phone, status, review_sent_at")
    .eq("id", jobId)
    .single();

  // Update job status
  const { error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId);

  if (error) return { ok: false, error: error.message };

  // Sync linked lead and call
  if (jobBefore?.lead_id) {
    const sync = JOB_TO_CALL[status];
    if (sync) {
      await supabase
        .from("leads")
        .update({ booked: sync.booked })
        .eq("id", jobBefore.lead_id);

      await supabase
        .from("calls")
        .update({
          disposition: sync.disposition,
          converted_to_job: sync.booked,
        })
        .eq("lead_id", jobBefore.lead_id);
    }
  }

  // Auto-send Google review SMS when a job flips to completed.
  // Dedup: skip if already sent for this job (review_sent_at column tracks it).
  const becameCompleted =
    status === "completed" &&
    jobBefore?.status !== "completed" &&
    !jobBefore?.review_sent_at;
  if (becameCompleted && jobBefore?.phone) {
    // Fire-and-forget: non-blocking, failure doesn't revert the status update.
    sendReviewLink(jobBefore.phone, { triggeredByJobId: jobId }).catch(() => {});
  }

  revalidateAll();
  return { ok: true };
}

// Update the pickup or dropoff address on a job. Fields are all optional —
// passing null clears them. When the pickup_city changes, mirror it to the
// linked lead so Leads / Customer-profile stay in sync.
export async function updateJobAddress(
  jobId: string,
  which: "pickup" | "dropoff",
  fields: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null },
) {
  const clean = (v: string | null | undefined) => {
    if (v === null || v === undefined) return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };

  const update: Record<string, unknown> = {};
  if ("address" in fields) update[`${which}_address`] = clean(fields.address);
  if ("city"    in fields) update[`${which}_city`]    = clean(fields.city);
  if ("state"   in fields) update[`${which}_state`]   = clean(fields.state);
  if ("zip"     in fields) update[`${which}_zip`]     = clean(fields.zip);

  if (Object.keys(update).length === 0) return { ok: false as const, error: "No fields to update" };

  const { data: job, error } = await supabase
    .from("jobs")
    .update(update)
    .eq("id", jobId)
    .select("lead_id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  // Mirror pickup city onto the lead row so Leads / Profile display stays consistent.
  if (which === "pickup" && "city" in fields && job?.lead_id) {
    await supabase.from("leads").update({ city: clean(fields.city) }).eq("id", job.lead_id);
  }

  revalidateAll();
  return { ok: true as const };
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
