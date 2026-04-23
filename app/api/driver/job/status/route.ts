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
const REVIEW_URL = process.env.GOOGLE_REVIEW_URL || "";

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

  const { jobId, status, finalAmount, completionNotes } = await req.json();
  if (!jobId || !status) {
    return NextResponse.json({ ok: false, error: "Missing jobId/status" }, { status: 400 });
  }

  // Completion requires a confirmed final amount — this is the gate.
  if (status === "completed") {
    const n = Number(finalAmount);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json(
        { ok: false, error: "Final amount is required to complete a job" },
        { status: 400 },
      );
    }
  }

  // Load job so we can decide on side effects
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, status, phone, tracking_token, customer, photos_after")
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
    update.final_amount = Number(finalAmount);
    if (typeof completionNotes === "string" && completionNotes.trim()) {
      update.completion_notes = completionNotes.trim();
    }
    update.price = Number(finalAmount); // Keep canonical `price` in sync with final total
  }

  const { error: updErr } = await supabase.from("jobs").update(update).eq("id", jobId);
  if (updErr) {
    await logError("sms_send", "Failed to update job status", { jobId, status, error: updErr.message });
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  // Completion SMS: final amount + review link + (photo link if photos exist)
  if (status === "completed" && job.phone) {
    const firstName = (job.customer || "").split(/\s+/)[0] || "";
    const greeting = firstName ? `Hi ${firstName}, ` : "";
    const total = Number(finalAmount).toFixed(0);
    const photosArr = Array.isArray(job.photos_after) ? (job.photos_after as unknown[]) : [];
    const hasPhotos = photosArr.length > 0;

    const lines = [
      `${greeting}your ACT Dispatch service is complete. Final total: $${total}.`,
    ];
    if (hasPhotos) {
      lines.push(`View photos: ${PUBLIC_ORIGIN}/track/${job.tracking_token}`);
    }
    if (REVIEW_URL) {
      lines.push(`If we saved the day, a quick Google review helps us out: ${REVIEW_URL}`);
    }
    lines.push(`Thanks for choosing ACT Dispatch!`);
    const body = lines.join("\n\n");

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
      await supabase
        .from("jobs")
        .update({ review_sms_sent_at: new Date().toISOString() })
        .eq("id", jobId);
    } catch (err) {
      await logError("sms_send", "Failed to send completion SMS", {
        jobId,
        phone: job.phone,
        error: String(err),
      });
    }
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
