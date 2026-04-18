import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Twilio Voice Webhook — fires on every inbound call.
//
// 1. Looks up tracking number → tags source
// 2. Creates call record in Supabase
// 3. Looks up all available drivers
// 4. Returns TwiML that:
//    - Records the call
//    - Rings ALL available driver browser Clients simultaneously
//    - Falls back to FORWARD_PHONE_NUMBER if no one answers in 20s
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData();
    const callerPhone = (body.get("From") as string) || null;
    const dialedNumber = (body.get("To") as string) || null;
    const callSid = (body.get("CallSid") as string) || null;

    const forwardTo = process.env.FORWARD_PHONE_NUMBER || "";
    const baseUrl = `https://${req.headers.get("host")}`;
    const statusCallback = `${baseUrl}/api/twilio/status`;

    // Look up source from tracking_numbers table
    let source = "unknown";
    let trackingNumberId: string | null = null;

    if (dialedNumber) {
      const { data: tn } = await supabase
        .from("tracking_numbers")
        .select("id, source")
        .eq("phone_number", dialedNumber)
        .eq("active", true)
        .single();

      if (tn) {
        source = tn.source;
        trackingNumberId = tn.id;
      }
    }

    // Create call record in Supabase
    await supabase.from("calls").insert({
      caller_phone: callerPhone,
      source,
      tracking_number: dialedNumber,
      tracking_number_id: trackingNumberId,
      started_at: new Date().toISOString(),
      duration_seconds: 0,
      notes: callSid ? `twilio_sid:${callSid}` : null,
    });

    // Look up available drivers to ring their browser clients
    const { data: drivers } = await supabase
      .from("drivers")
      .select("id")
      .eq("status", "available");

    // Build <Client> tags for each available driver
    let clientTags = "";
    if (drivers && drivers.length > 0) {
      clientTags = drivers.map((d) => `    <Client>${d.id}</Client>`).join("\n");
    } else {
      // No drivers in DB — use generic "driver" identity as fallback
      clientTags = "    <Client>driver</Client>";
    }

    // TwiML: ring browser clients first, fall back to phone
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-answer-dual"
        recordingStatusCallback="${statusCallback}"
        recordingStatusCallbackMethod="POST"
        timeout="20">
${clientTags}
  </Dial>
  <Dial record="record-from-answer-dual"
        recordingStatusCallback="${statusCallback}"
        recordingStatusCallbackMethod="POST">
    <Number>${forwardTo}</Number>
  </Dial>
</Response>`;

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    const fallback = process.env.FORWARD_PHONE_NUMBER || "";
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial><Number>${fallback}</Number></Dial>
</Response>`;
    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
