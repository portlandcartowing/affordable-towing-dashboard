"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function addDriver(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const hookupFee = parseFloat(formData.get("hookup_fee") as string) || 95;
  const ratePerMile = parseFloat(formData.get("rate_per_mile") as string) || 4;

  const { error } = await supabase.from("drivers").insert({
    name,
    email,
    phone,
    hookup_fee: hookupFee,
    rate_per_mile: ratePerMile,
    status: "offline",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/drivers");
}

export async function updateDriver(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const hookupFee = parseFloat(formData.get("hookup_fee") as string) || 95;
  const ratePerMile = parseFloat(formData.get("rate_per_mile") as string) || 4;
  const status = formData.get("status") as string;

  const { error } = await supabase
    .from("drivers")
    .update({ name, email, phone, hookup_fee: hookupFee, rate_per_mile: ratePerMile, status })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/drivers");
}

export async function deleteDriver(id: string) {
  const { error } = await supabase.from("drivers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/drivers");
}
