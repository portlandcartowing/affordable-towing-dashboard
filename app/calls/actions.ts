"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { parseTranscript } from "@/lib/transcriptParser";

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

  revalidatePath("/calls");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true as const, leadId: lead.id as string };
}

/**
 * Delete a call record.
 */
export async function deleteCall(callId: string) {
  // Unlink any leads first
  await supabase.from("leads").update({ call_id: null }).eq("call_id", callId);

  const { error } = await supabase.from("calls").delete().eq("id", callId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/calls");
  revalidatePath("/call-center");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Delete all calls (for testing cleanup).
 */
export async function deleteAllCalls() {
  await supabase.from("leads").update({ call_id: null }).not("call_id", "is", null);
  const { error } = await supabase.from("calls").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/calls");
  revalidatePath("/call-center");
  revalidatePath("/dashboard");
  return { ok: true };
}
