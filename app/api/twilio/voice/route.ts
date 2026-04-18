import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { forwardNumber } from "@/lib/twilio";

// ---------------------------------------------------------------------------
// Twilio Voice Webhook — fires on every inbound call to your Twilio number.
//
// 1. Looks up the tracking number to determine source (google_ads / gbp / etc)
// 2. Creates a call record in Supabase with source auto-tagged
// 3. Returns TwiML that records the call and forwards it to dad's phone
//
// Configure this URL in Twilio Console:
//   Phone Numbers → your number → Voice Configuration → "A call comes in"
//   → Webhook → POST → https://yourdomain.com/api/twilio/voice
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.formData();
  const callerPhone = body.get("From") as string | null;
  const dialedNumber = body.get("To") as string | null;
  const callSid = body.get("CallSid") as string | null;

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

  // Return TwiML: start real-time transcription + record + forward to dad
  const statusCallback = new URL("/api/twilio/status", req.url).toString();
  const transcriptionCallback = new URL("/api/twilio/transcription", req.url).toString();

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
        recordingStatusCallbackMethod="POST">
    <Number>${forwardNumber}</Number>
  </Dial>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
