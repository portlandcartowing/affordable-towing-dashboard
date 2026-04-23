import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getTwilioClient, twilioNumber } from "@/lib/twilio";
import { logError } from "@/lib/errorLog";

// ---------------------------------------------------------------------------
// Driver updates job status. Side effects:
//   - Transitioning to `in_transit` generates a tracking_token (if missing)
//     and SMSes the customer the tracking link.
//   - Transitioning to `completed` stops location updates and (next phase)
//     fires a review-request SMS.
// ---------------------------------------------------------------------------

const PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://affordable-towing-dashboard.vercel.app";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing auth" }, { status: 401 });
  }

  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: userData, error: userErr } = await verifier.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  const { jobId, status } = await req.json();
  if (!jobId || !status) {
    return NextResponse.json({ ok: false, error: "Missing jobId/status" }, { status: 400 });
  }

  // Load job so we can decide on side effects
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, status, phone, tracking_token, customer")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = { status };
  let trackingLink: string | null = null;

  // Generate + share tracking link on first transition into in_transit
  if (status === "in_transit") {
    const existingToken = job.tracking_token as string | null;
    const trackToken = existingToken || randomUUID();
    if (!existingToken) update.tracking_token = trackToken;
    trackingLink = `${PUBLIC_ORIGIN}/track/${trackToken}`;
  }
  if (status === "completed") {
    update.completed_at = new Date().toISOString();
  }

  const { error: updErr } = await supabase.from("jobs").update(update).eq("id", jobId);
  if (updErr) {
    await logError("sms_send", "Failed to update job status", { jobId, status, error: updErr.message });
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  // Send tracking SMS (fire-and-forget — don't block status update on SMS failure)
  if (status === "in_transit" && trackingLink && job.phone) {
    const firstName = (job.customer || "").split(/\s+/)[0] || "";
    const greeting = firstName ? `Hi ${firstName}, ` : "";
    const body = `${greeting}your ACT Dispatch driver is on the way. Track live: ${trackingLink}`;
    try {
      await getTwilioClient().messages.create({
        to: job.phone,
        from: twilioNumber,
        body,
      });
      await supabase.from("messages").insert({
        direction: "outbound",
        from_number: twilioNumber,
        to_number: job.phone,
        body,
        job_id: jobId,
        status: "sent",
      });
    } catch (err) {
      await logError("sms_send", "Failed to send tracking SMS", {
        jobId,
        phone: job.phone,
        error: String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, trackingLink });
}
