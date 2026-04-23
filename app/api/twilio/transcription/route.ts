import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// ---------------------------------------------------------------------------
// Twilio Real-Time Transcription Webhook
//
// Twilio sends HTTP POST callbacks as it transcribes the call in real-time.
// Each callback contains a transcript chunk with speaker label and text.
//
// This endpoint:
// 1. Finds the call record by Twilio CallSid
// 2. Appends the transcript chunk to the calls.transcript_chunks jsonb array
// 3. Also appends to the calls.transcript text field for backwards compat
//
// Supabase Realtime picks up the row update and pushes it to dad's PWA,
// where the transcript parser extracts fields and auto-fills the estimate.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: Record<string, string>;

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await req.json();
  } else {
    const formData = await req.formData();
    body = Object.fromEntries(formData.entries()) as Record<string, string>;
  }

  const callSid = body.CallSid || body.callSid;
  const transcriptionText = body.TranscriptionText || body.transcriptionText || body.Text || body.text;
  const trackLabel = body.Track || body.track || body.TrackLabel || body.trackLabel;

  // Skip empty or status-only callbacks
  if (!callSid || !transcriptionText) {
    return NextResponse.json({ ok: true });
  }

  // Map track label to speaker
  const speaker = trackLabel === "caller" || trackLabel === "inbound"
    ? "caller"
    : "dispatcher";

  const chunk = {
    speaker,
    text: transcriptionText,
    at: new Date().toISOString(),
  };

  // Find call by Twilio SID (stored in notes during creation)
  const { data: calls } = await supabase
    .from("calls")
    .select("id, transcript, transcript_chunks")
    .like("notes", `%${callSid}%`)
    .limit(1);

  if (!calls || calls.length === 0) {
    return NextResponse.json({ ok: false, error: "Call not found" });
  }

  const call = calls[0];
  const existingChunks = (call.transcript_chunks as unknown[]) || [];
  const existingTranscript = call.transcript || "";

  // Append chunk to jsonb array + plain text transcript
  const speakerLabel = speaker === "caller" ? "Caller" : "Dispatcher";
  const newTranscriptLine = `${speakerLabel}: ${transcriptionText}`;

  await supabase
    .from("calls")
    .update({
      transcript_chunks: [...existingChunks, chunk],
      transcript: existingTranscript
        ? `${existingTranscript}\n${newTranscriptLine}`
        : newTranscriptLine,
    })
    .eq("id", call.id);

  return NextResponse.json({ ok: true });
}
