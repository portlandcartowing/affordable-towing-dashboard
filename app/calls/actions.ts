"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { parseTranscript } from "@/lib/transcriptParser";

const revalidateAll = () => {
  revalidatePath("/calls");
  revalidatePath("/call-center");
  revalidatePath("/leads");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
};

/**
 * One-tap lead creation from an inbound call.
 */
export async function createLeadFromCall(callId: string) {
  const { data: call, error: callError } = await supabase
    .from("calls")
    .select("id, caller_phone, source, transcript, notes, lead_id")
    .eq("id", callId)
    .single();

  if (callError || !call) {
    return { ok: false as const, error: callError?.message || "Call not found" };
  }
  if (call.lead_id) {
    return { ok: false as const, error: "Call already linked to a lead" };
  }

  const parsed = parseTranscript(call.transcript);

  const noteParts: string[] = [];
  if (parsed.summary) noteParts.push(parsed.summary);
  if (call.notes) noteParts.push(call.notes);
  if (call.transcript) {
    noteParts.push(`Transcript: ${call.transcript.slice(0, 240)}`);
  }
  const notes = noteParts.join("\n\n") || null;

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      customer: null,
      phone: call.caller_phone,
      service: parsed.service_type,
      city: parsed.pickup_city,
      source: "call",
      booked: false,
      price: null,
      notes,
      call_id: callId,
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return { ok: false as const, error: leadError?.message || "Failed to create lead" };
  }

  const { error: linkError } = await supabase
    .from("calls")
    .update({ lead_id: lead.id })
    .eq("id", callId);

  if (linkError) {
    return { ok: false as const, error: linkError.message };
  }

  revalidateAll();
  return { ok: true as const, leadId: lead.id as string };
}

/**
 * Update a call's disposition and sync the linked lead + job.
 *
 * - "booked" → marks linked lead as booked, linked job as "booked"
 * - "lost" / "spam" / null → marks linked lead as NOT booked
 * - "standby" / "callback" → no change to lead booking status
 */
export async function updateCallDisposition(
  callId: string,
  disposition: string | null,
) {
  const { error } = await supabase
    .from("calls")
    .update({
      disposition,
      converted_to_job: disposition === "booked",
    })
    .eq("id", callId);

  if (error) return { ok: false, error: error.message };

  // Sync linked lead and job
  const { data: call } = await supabase
    .from("calls")
    .select("lead_id")
    .eq("id", callId)
    .single();

  if (call?.lead_id) {
    // Sync lead booked status
    await supabase
      .from("leads")
      .update({ booked: disposition === "booked" })
      .eq("id", call.lead_id);

    // Sync job status — map disposition to job pipeline stage
    const jobStatusMap: Record<string, string> = {
      booked: "booked",
      standby: "quoted",
      callback: "quoted",
      lost: "cancelled",
      spam: "cancelled",
    };
    const newJobStatus = disposition ? jobStatusMap[disposition] : "new_lead";
    if (newJobStatus) {
      await supabase
        .from("jobs")
        .update({ status: newJobStatus })
        .eq("lead_id", call.lead_id);
    }
  }

  revalidateAll();
  return { ok: true };
}

/**
 * Delete a call record.
 */
export async function deleteCall(callId: string) {
  // Unlink any leads first
  await supabase.from("leads").update({ call_id: null }).eq("call_id", callId);

  const { error } = await supabase.from("calls").delete().eq("id", callId);
  if (error) return { ok: false, error: error.message };

  revalidateAll();
  return { ok: true };
}

/**
 * Delete all calls (for testing cleanup).
 */
export async function deleteAllCalls() {
  await supabase.from("leads").update({ call_id: null }).not("call_id", "is", null);
  const { error } = await supabase.from("calls").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) return { ok: false, error: error.message };

  revalidateAll();
  return { ok: true };
}
