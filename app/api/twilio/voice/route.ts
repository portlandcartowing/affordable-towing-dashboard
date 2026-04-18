import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Twilio Voice Webhook — fires on every inbound call.
//
// 1. Looks up tracking number → tags source
// 2. Creates call record in Supabase
// 3. Returns TwiML that:
//    - Records the call
//    - Rings the browser-based Twilio Client ("driver" identity)
//    - Falls back to phone forwarding if Client doesn't answer in 20s
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
    const transcriptionCallback = `${baseUrl}/api/twilio/transcription`;

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

    // TwiML: record + try browser Client first, fall back to phone
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Transcription
      statusCallbackUrl="${transcriptionCallback}"
      statusCallbackMethod="POST"
      inboundTrackLabel="caller"
      outboundTrackLabel="dispatcher"
      partialResults="true"
      languageCode="en-US" />
  </Start>
  <Dial record="record-from-answer-dual"
        recordingStatusCallback="${statusCallback}"
        recordingStatusCallbackMethod="POST"
        timeout="20">
    <Client>driver</Client>
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
    // Fallback — still forward the call
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
