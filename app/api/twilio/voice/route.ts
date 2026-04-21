import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

    // Route calls based on which Twilio number was dialed:
    // +15034611991 (testing)   → +13609544215
    // +15034066323 (Ads)       → +13603888741
    // +15036087014 (GMB)       → +13603888741
    const FORWARD_MAP: Record<string, string> = {
      "+15034611991": "+13609544215",
      "+15034066323": "+13603888741",
      "+15036087014": "+13603888741",
    };
    const forwardTo = (dialedNumber && FORWARD_MAP[dialedNumber])
      || process.env.FORWARD_PHONE_NUMBER
      || "+13603888741";
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
