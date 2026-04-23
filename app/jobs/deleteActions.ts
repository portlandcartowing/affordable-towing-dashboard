"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export async function deleteJob(jobId: string) {
  const { error } = await supabase.from("jobs").delete().eq("id", jobId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/jobs");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true };
}
