"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

export type LeadInput = {
  customer: string;
  phone: string;
  service: string;
  city: string;
  source: string;
  price: number | null;
  notes: string;
  booked: boolean;
};

export async function createLead(input: LeadInput) {
  const { error } = await supabase.from("leads").insert({
    customer: input.customer,
    phone: input.phone,
    service: input.service,
    city: input.city,
    source: input.source,
    price: input.price,
    notes: input.notes,
    booked: input.booked,
    created_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/leads");
  return { ok: true };
}

export async function toggleLeadBooked(id: string, booked: boolean) {
  const { error } = await supabase.from("leads").update({ booked }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * One-tap job creation from a booked lead.
 *
 * Copies lead fields into a new job row, links it via lead_id, and defaults
 * the status to "waiting_for_driver" so the dispatcher can immediately start
 * assigning or posting to a load board.
 */
export async function createJobFromLead(leadId: string) {
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, customer, phone, service, city, price, notes")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return { ok: false as const, error: leadError?.message || "Lead not found" };
  }

  // Prevent double-creation if a job already exists for this lead.
  const { data: existing, error: existingError } = await supabase
    .from("jobs")
    .select("id")
    .eq("lead_id", leadId)
    .limit(1);

  if (existingError) {
    return { ok: false as const, error: existingError.message };
  }
  if (existing && existing.length > 0) {
    return { ok: false as const, error: "Job already exists for this lead" };
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      lead_id: lead.id,
      status: "waiting_for_driver",
      customer: lead.customer,
      phone: lead.phone,
      pickup_city: lead.city,
      price: lead.price,
      notes: lead.notes,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return { ok: false as const, error: jobError?.message || "Failed to create job" };
  }

  revalidatePath("/leads");
  revalidatePath("/jobs");
  revalidatePath("/dispatch");
  revalidatePath("/dashboard");
  return { ok: true as const, jobId: job.id as string };
}
