"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export async function updateTrackingNumberSource(id: string, source: string) {
  const trimmed = source.trim();
  if (!trimmed) return { ok: false as const, error: "Source cannot be empty" };

  const { error } = await supabase
    .from("tracking_numbers")
    .update({ source: trimmed })
    .eq("id", id);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/calls");
  revalidatePath("/call-center");
  return { ok: true as const };
}
