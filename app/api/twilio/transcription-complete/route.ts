import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { generateAISummary } from "@/lib/postCallProcessor";

// ---------------------------------------------------------------------------
// Twilio Transcription Complete Callback
//
// Fired when Twilio finishes its built-in transcription of a recording.
// Saves the transcript text and generates a real Claude-powered summary.
//
// Note: the Deepgram pipeline in /api/twilio/status/route.ts also generates
// an AI summary via processPostCall. Whichever webhook fires last wins —
// both now produce a real Claude summary, so the result is consistent.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const callId = new URL(req.url).searchParams.get("callId");

  let transcriptionText = "";

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    transcriptionText = body.TranscriptionText || body.transcriptionText || "";
  } else {
    const body = await req.formData();
    transcriptionText = (body.get("TranscriptionText") as string) || "";
  }

  if (!callId || !transcriptionText) {
    return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
  }

  const aiSummary = await generateAISummary(transcriptionText);

  await supabase
    .from("calls")
    .update({
      transcript: transcriptionText,
      ai_summary: aiSummary,
    })
    .eq("id", callId);

  return NextResponse.json({ ok: true });
}
