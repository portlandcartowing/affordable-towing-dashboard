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

    // Route calls based on which number was dialed:
    // - 1991 (testing) → TEST_FORWARD_NUMBER
    // - All others (7014 GMB, 6323 Ads) → FORWARD_PHONE_NUMBER (production)
    const testNumber = process.env.TWILIO_PHONE_NUMBER || "";
    const forwardTo = dialedNumber === testNumber
      ? (process.env.TEST_FORWARD_NUMBER || process.env.FORWARD_PHONE_NUMBER || "")
      : (process.env.FORWARD_PHONE_NUMBER || "");
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

    // Fire push notification to wake driver's phone (non-blocking)
    fetch(`${baseUrl}/api/push/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caller_phone: callerPhone, source }),
    }).catch(() => {});

    // TwiML: record + forward to driver's phone
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
