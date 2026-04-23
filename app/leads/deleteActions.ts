"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

/**
 * Delete a lead record.
 */
export async function deleteLead(leadId: string) {
  // Unlink any calls referencing this lead
  await supabase.from("calls").update({ lead_id: null }).eq("lead_id", leadId);
  // Unlink any jobs
  await supabase.from("jobs").update({ lead_id: null }).eq("lead_id", leadId);

  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/leads");
  revalidatePath("/calls");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Delete all leads (for testing cleanup).
 */
export async function deleteAllLeads() {
  await supabase.from("calls").update({ lead_id: null }).not("lead_id", "is", null);
  await supabase.from("jobs").update({ lead_id: null }).not("lead_id", "is", null);
  const { error } = await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/leads");
  revalidatePath("/calls");
  revalidatePath("/dashboard");
  return { ok: true };
}
