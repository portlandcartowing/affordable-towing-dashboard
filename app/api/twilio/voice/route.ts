import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Twilio Voice Webhook
//
// 1. Tags source from tracking number
// 2. Creates call record in Supabase
// 3. Rings all available driver browser Clients (VoIP)
// 4. Falls back to phone number if no one answers in 20s
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

    // Look up source
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

    // Create call record
    await supabase.from("calls").insert({
      caller_phone: callerPhone,
      source,
      tracking_number: dialedNumber,
      tracking_number_id: trackingNumberId,
      started_at: new Date().toISOString(),
      duration_seconds: 0,
      notes: callSid ? `twilio_sid:${callSid}` : null,
    });

    // Fire push notification to wake drivers' phones
    try {
      await fetch(`${baseUrl}/api/push/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caller_phone: callerPhone, source }),
      });
    } catch {
      // Don't let push failure block the call
    }

    // Look up available drivers
    const { data: drivers } = await supabase
      .from("drivers")
      .select("id")
      .eq("status", "available");

    // Build Client tags — ring every available driver's browser
    let clientTags = "";
    if (drivers && drivers.length > 0) {
      clientTags = drivers
        .map((d) => `    <Client>${d.id}</Client>`)
        .join("\n");
    }

    // TwiML: try browser clients first, then phone fallback
    // NO transcription tag — keeping it simple until VoIP is confirmed working
    let twiml: string;

    if (clientTags) {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
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
    } else {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-answer-dual"
        recordingStatusCallback="${statusCallback}"
        recordingStatusCallbackMethod="POST">
    <Number>${forwardTo}</Number>
  </Dial>
</Response>`;
    }

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
