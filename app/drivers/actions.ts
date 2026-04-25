"use server";

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { revalidatePath } from "next/cache";

function readDriverPayFields(formData: FormData) {
  const hookup = parseFloat(formData.get("hookup_fee") as string);
  const rate = parseFloat(formData.get("rate_per_mile") as string);
  const commission = parseInt(formData.get("commission_pct") as string, 10);
  return {
    hookup_fee: Number.isFinite(hookup) ? hookup : 95,
    rate_per_mile: Number.isFinite(rate) ? rate : 4,
    commission_pct: Number.isFinite(commission)
      ? Math.max(0, Math.min(100, commission))
      : 50,
  };
}

export async function addDriver(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const pay = readDriverPayFields(formData);

  const { error } = await supabase.from("drivers").insert({
    name,
    email,
    phone,
    ...pay,
    status: "offline",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/drivers");
}

export async function updateDriver(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const status = formData.get("status") as string;
  const pay = readDriverPayFields(formData);

  const { error } = await supabase
    .from("drivers")
    .update({ name, email, phone, status, ...pay })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/drivers");
  revalidatePath("/jobs");
}

export async function deleteDriver(id: string) {
  const { error } = await supabase.from("drivers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/drivers");
}
