"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

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
  return updateLeadStatus(id, booked ? "booked" : "new_lead");
}

/**
 * Inline-edit a single field on a lead row. Whitelisted to the columns
 * dispatchers are allowed to adjust. Also propagates service/city/price
 * to the linked job (if any) so the Jobs page stays in sync.
 */
export async function updateLeadField(
  leadId: string,
  field: "service" | "city" | "source" | "price",
  value: string | number | null,
) {
  let cleanValue: string | number | null;
  if (field === "price") {
    if (value === null || value === "" || value === undefined) cleanValue = null;
    else {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n) || n < 0 || n > 20000) {
        return { ok: false as const, error: "Enter 0–20000" };
      }
      cleanValue = Math.round(n * 100) / 100;
    }
  } else {
    const s = typeof value === "string" ? value.trim() : "";
    cleanValue = s.length > 0 ? s : null;
  }

  const { error } = await supabase
    .from("leads")
    .update({ [field]: cleanValue })
    .eq("id", leadId);
  if (error) return { ok: false as const, error: error.message };

  // Mirror mutable fields onto the linked job so dispatch-facing views match.
  const jobMirror: Record<string, unknown> = {};
  if (field === "service") {
    // jobs table doesn't have a service column, so skip — field lives on lead only.
  } else if (field === "city") {
    jobMirror.pickup_city = cleanValue;
  } else if (field === "price") {
    jobMirror.price = cleanValue;
  }
  if (Object.keys(jobMirror).length > 0) {
    await supabase.from("jobs").update(jobMirror).eq("lead_id", leadId);
  }

  revalidatePath("/leads");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/call-center");
  return { ok: true as const };
}

/**
 * Update a lead's status and sync across calls + jobs.
 * Uses the same status values as call dispositions so everything matches.
 */
export async function updateLeadStatus(leadId: string, status: string) {
  const booked = status === "booked";
  const disposition = status === "new_lead" ? null : status;

  // Update lead
  const { error } = await supabase
    .from("leads")
    .update({ booked })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  // Sync linked call
  const { data: lead } = await supabase
    .from("leads")
    .select("call_id")
    .eq("id", leadId)
    .single();

  if (lead?.call_id) {
    await supabase
      .from("calls")
      .update({
        disposition,
        converted_to_job: booked,
      })
      .eq("id", lead.call_id);
  }

  // Sync linked job — 1:1 mapping now
  const jobStatusMap: Record<string, string> = {
    booked: "booked",
    standby: "standby",
    callback: "callback",
    lost: "lost",
    spam: "spam",
    new_lead: "new_lead",
  };
  const newJobStatus = jobStatusMap[status];
  if (newJobStatus) {
    await supabase
      .from("jobs")
      .update({ status: newJobStatus })
      .eq("lead_id", leadId);
  }

  revalidatePath("/leads");
  revalidatePath("/calls");
  revalidatePath("/call-center");
  revalidatePath("/jobs");
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
