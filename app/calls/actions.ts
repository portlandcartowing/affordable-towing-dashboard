"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { parseTranscript } from "@/lib/transcriptParser";

/**
 * One-tap lead creation from an inbound call.
 *
 * Reads the call row, runs the transcript through the deterministic parser
 * in lib/transcriptParser.ts, and pre-fills as many lead fields as can be
 * confidently extracted. Anything the parser can't recognize is left blank
 * for the dispatcher to edit on /leads — the flow never breaks.
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

  // Deterministic, zero-API extraction. Fast enough to run inline.
  const parsed = parseTranscript(call.transcript);

  // Build the lead's notes: parser summary first, then any raw call notes,
  // then the full transcript as a reference block.
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
