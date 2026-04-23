import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { logError } from "@/lib/errorLog";

// ---------------------------------------------------------------------------
// Twilio Voice Webhook
//
// Every inbound call:
// 1. Tags source from tracking number
// 2. Creates call record in Supabase (triggers Realtime → driver app)
// 3. Fires push notification to driver's phone
// 4. Records the call
// 5. Forwards to driver's phone number
//
// The driver answers on their phone normally. They open the ACT app
// during or after the call — all CRM data is already populated.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData();
    const callerPhone = (body.get("From") as string) || null;
    const dialedNumber = (body.get("To") as string) || null;
    const callSid = (body.get("CallSid") as string) || null;

    // Reject obvious test/probe traffic so it doesn't pollute the calls table.
    // Twilio console validators, manual Postman hits, and common bot probes
    // use well-known placeholder values. Real calls always have a real
    // CallSid (starts with "CA") and a real E.164 caller.
    const isTestTraffic =
      callSid === "TEST" ||
      callerPhone === "+15555555555" ||
      callerPhone === "+10000000000" ||
      (callSid != null && !callSid.startsWith("CA"));
    if (isTestTraffic) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`,
        { headers: { "Content-Type": "text/xml" } },
      );
    }

    // Route calls based on which Twilio number was dialed:
    // +15034611991 (Direct)    → +15033888741
    // +15034066323 (Ads)       → +15033888741
    // +15036087014 (GMB)       → +15033888741
    const FORWARD_MAP: Record<string, string> = {
      "+15034611991": "+15033888741",
      "+15034066323": "+15033888741",
      "+15036087014": "+15033888741",
    };
    const forwardTo = (dialedNumber && FORWARD_MAP[dialedNumber])
      || process.env.FORWARD_PHONE_NUMBER
      || "+15033888741";
    const baseUrl = `https://${req.headers.get("host")}`;
    const statusCallback = `${baseUrl}/api/twilio/status`;

    // Look up source from tracking number
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

    // Create call record — triggers Supabase Realtime → driver app updates
    const { data: callRecord } = await supabase.from("calls").insert({
      caller_phone: callerPhone,
      source,
      tracking_number: dialedNumber,
      tracking_number_id: trackingNumberId,
      started_at: new Date().toISOString(),
      duration_seconds: 0,
      notes: callSid ? `twilio_sid:${callSid}` : null,
    }).select("id").single();

    // Match this call to a recent click event from the website DNI script.
    // Looks for a click on the same tracking number in the last 5 minutes
    // that hasn't been matched to a call yet.
    if (callRecord && dialedNumber) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data: click } = await supabase
        .from("click_events")
        .select("id, source, utm_campaign, utm_adgroup, utm_source, utm_medium, utm_term")
        .eq("phone_clicked", dialedNumber)
        .is("call_id", null)
        .gte("created_at", fiveMinAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (click) {
        // Link click event to this call
        await supabase
          .from("click_events")
          .update({ call_id: callRecord.id })
          .eq("id", click.id);

        // Enrich call with campaign data from the click
        const enrichedSource = click.source || source;
        const campaignNote = [
          click.utm_campaign && `campaign:${click.utm_campaign}`,
          click.utm_adgroup && `adgroup:${click.utm_adgroup}`,
          click.utm_term && `keyword:${click.utm_term}`,
        ].filter(Boolean).join(" | ");

        await supabase
          .from("calls")
          .update({
            source: enrichedSource,
            ai_summary: campaignNote || null,
          })
          .eq("id", callRecord.id);
      }
    }

    // Fire push notification to wake driver's phone (non-blocking).
    // Hits both Web Push (PWA) and Expo Push (native driver app).
    fetch(`${baseUrl}/api/push/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "incoming_call",
        caller_phone: callerPhone,
        source,
        call_id: callRecord?.id ?? null,
      }),
    }).catch(() => {});

    // Check if the call is an outbound VoIP call from a driver client
    const fromClient = body.get("Direction") === "outbound" || (body.get("From") as string)?.startsWith("client:");
    const toNumber = body.get("To") as string;

    if (fromClient && toNumber && !toNumber.startsWith("client:")) {
      // Driver is placing an outbound call via VoIP → dial the customer
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${process.env.TWILIO_PHONE_NUMBER}"
        record="record-from-answer-dual"
        recordingStatusCallback="${statusCallback}"
        recordingStatusCallbackMethod="POST">
    <Number>${toNumber}</Number>
  </Dial>
</Response>`;
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Inbound call: try VoIP client first, fall back to phone after 15s
    // Look up which driver should receive this call
    const { data: availableDriver } = await supabase
      .from("drivers")
      .select("id, email, name")
      .eq("status", "available")
      .limit(1)
      .single();

    // Build the driver's VoIP identity (email-based, sanitized)
    const driverIdentity = availableDriver?.email
      ? availableDriver.email.replace(/[^a-zA-Z0-9]/g, "_")
      : null;

    // TwiML: record + forward to driver's phone
    // Only add VoIP client if a driver is available and VoIP is configured
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
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
    await logError("twilio_voice", "Voice webhook threw — falling back to direct forward", {
      error: String(err),
    });
    const fallback = process.env.FORWARD_PHONE_NUMBER || "+15033888741";
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial><Number>${fallback}</Number></Dial>
</Response>`;
    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
