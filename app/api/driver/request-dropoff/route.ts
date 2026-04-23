import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getTwilioClient, twilioNumber } from "@/lib/twilio";

// ---------------------------------------------------------------------------
// Driver app posts here when they tap "Start Navigation" on the PICKUP leg
// of a Tow job that doesn't yet have a dropoff. The server:
//   1. Confirms the job is actually a Tow and still has no dropoff
//   2. Sends "Please reply with your dropoff address" to the customer
//      FROM the tracking number they originally dialed (if known) so the
//      SMS thread stays tied to the same number
//   3. Sets jobs.dropoff_requested_at so the inbound SMS webhook can match
//      the customer's reply to this request
// ---------------------------------------------------------------------------

const DROPOFF_REQUEST_BODY =
  "Portland Car Towing: your driver is on the way. Please reply with your drop-off address (street, city). We'll use it to plan the route.";

export async function POST(req: NextRequest) {
  const { jobId } = (await req.json()) as { jobId?: string };
  if (!jobId) return NextResponse.json({ ok: false, error: "jobId required" }, { status: 400 });

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, phone, lead_id, dropoff_address, dropoff_city, dropoff_requested_at, tracking_token")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }
  if (!job.phone) {
    return NextResponse.json({ ok: false, error: "Job has no phone number" }, { status: 400 });
  }
  if (job.dropoff_address || job.dropoff_city) {
    return NextResponse.json({ ok: true, skipped: "dropoff already set" });
  }

  // Gate on service_type = Tow (from the linked lead).
  if (job.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("service")
      .eq("id", job.lead_id)
      .single();
    if (lead?.service && lead.service.toLowerCase() !== "tow") {
      return NextResponse.json({ ok: true, skipped: `service is ${lead.service}, not Tow` });
    }
  }

  // Don't re-send if we already asked within the last 30 minutes.
  if (job.dropoff_requested_at) {
    const ageMs = Date.now() - new Date(job.dropoff_requested_at).getTime();
    if (ageMs < 30 * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: "already requested" });
    }
  }

  // Resolve "from" number — prefer the tracking number on the latest inbound
  // message from this phone, fall back to TWILIO_PHONE_NUMBER.
  let fromNumber = twilioNumber;
  const { data: lastInbound } = await supabase
    .from("messages")
    .select("to_number")
    .eq("direction", "inbound")
    .eq("from_number", job.phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastInbound?.to_number) fromNumber = lastInbound.to_number;

  // Ensure a tracking token exists for the public /track/[token] page
  let trackingToken = job.tracking_token as string | null;
  if (!trackingToken) {
    trackingToken = randomBytes(12).toString("hex"); // 24-char opaque id
    await supabase.from("jobs").update({ tracking_token: trackingToken }).eq("id", jobId);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${req.headers.get("host")}`;
  const trackUrl = `${baseUrl}/track/${trackingToken}`;
  const combinedBody = `${DROPOFF_REQUEST_BODY}\n\nTrack your driver: ${trackUrl}`;

  try {
    const msg = await getTwilioClient().messages.create({
      to: job.phone,
      from: fromNumber,
      body: combinedBody,
    });

    await supabase.from("messages").insert({
      direction: "outbound",
      from_number: fromNumber,
      to_number: job.phone,
      body: combinedBody,
      job_id: jobId,
      lead_id: job.lead_id,
      twilio_sid: msg.sid,
      status: "sent",
      parsed_fields: { kind: "dropoff_request" },
    });

    await supabase
      .from("jobs")
      .update({ dropoff_requested_at: new Date().toISOString() })
      .eq("id", jobId);

    return NextResponse.json({ ok: true, sid: msg.sid, trackingToken });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
