"use server";

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { revalidatePath } from "next/cache";

export async function resolveDispute(
  disputeId: string,
  status: "approved" | "rejected",
  adminNotes: string,
) {
  const { error } = await supabase
    .from("disputes")
    .update({
      status,
      admin_notes: adminNotes || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId);

  if (error) throw new Error(error.message);

  // If approved, cancel the job
  if (status === "approved") {
    const { data: dispute } = await supabase
      .from("disputes")
      .select("job_id")
      .eq("id", disputeId)
      .single();

    if (dispute?.job_id) {
      await supabase
        .from("jobs")
        .update({ status: "cancelled" })
        .eq("id", dispute.job_id);
    }
  }

  revalidatePath("/disputes");
}
