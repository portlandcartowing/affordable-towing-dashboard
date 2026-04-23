"use server";

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getTwilioClient, twilioNumber } from "@/lib/twilio";

// ---------------------------------------------------------------------------
// Resolve which tracking number to send FROM so the customer receives a
// reply from the same number they originally dialed/texted.
//
// Priority:
//   1. calls.tracking_number attached to callId (most authoritative)
//   2. Most recent inbound message's to_number from this caller
//   3. Fallback: TWILIO_PHONE_NUMBER env default
// ---------------------------------------------------------------------------
async function resolveFromNumber(
  to: string,
  callId: string | null,
): Promise<string> {
  if (callId) {
    const { data: call } = await supabase
      .from("calls")
      .select("tracking_number")
      .eq("id", callId)
      .single();
    if (call?.tracking_number) return call.tracking_number;
  }

  const { data: lastInbound } = await supabase
    .from("messages")
    .select("to_number")
    .eq("direction", "inbound")
    .eq("from_number", to)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (lastInbound?.to_number) return lastInbound.to_number;

  return twilioNumber;
}

// ---------------------------------------------------------------------------
// Send an SMS to a customer and log it in the messages table.
// Called from the MessagesPanel compose input.
// ---------------------------------------------------------------------------

export async function getTwilioSendAction(
  to: string,
  body: string,
  callId: string | null,
) {
  if (!to || !body.trim()) {
    return { ok: false, error: "Missing phone or message body" };
  }

  // Find linked lead/job
  let leadId: string | null = null;
  let jobId: string | null = null;

  if (callId) {
    const { data: call } = await supabase
      .from("calls")
      .select("lead_id")
      .eq("id", callId)
      .single();
    if (call?.lead_id) {
      leadId = call.lead_id;
      const { data: job } = await supabase
        .from("jobs")
        .select("id")
        .eq("lead_id", leadId)
        .limit(1)
        .single();
      if (job) jobId = job.id;
    }
  }

  const fromNumber = await resolveFromNumber(to, callId);

  try {
    const msg = await getTwilioClient().messages.create({
      to,
      from: fromNumber,
      body,
    });

    // Log to messages table
    await supabase.from("messages").insert({
      direction: "outbound",
      from_number: fromNumber,
      to_number: to,
      body,
      call_id: callId,
      lead_id: leadId,
      job_id: jobId,
      twilio_sid: msg.sid,
      status: "sent",
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
