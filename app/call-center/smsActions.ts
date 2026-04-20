"use server";

import { supabase } from "@/lib/supabase";
import { getTwilioClient, twilioNumber } from "@/lib/twilio";

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

  try {
    const msg = await getTwilioClient().messages.create({
      to,
      from: twilioNumber,
      body,
    });

    // Log to messages table
    await supabase.from("messages").insert({
      direction: "outbound",
      from_number: twilioNumber,
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
