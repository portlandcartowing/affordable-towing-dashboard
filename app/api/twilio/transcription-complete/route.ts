import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseTranscript } from "@/lib/transcriptParser";

// ---------------------------------------------------------------------------
// Twilio Transcription Complete Callback
//
// Fired when Twilio finishes transcribing a recording. Saves the
// transcript text to the call record and runs the parser to extract
// structured fields (service type, pickup, vehicle, etc).
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

  // Parse the transcript for structured fields
  const parsed = parseTranscript(transcriptionText);

  // Build AI summary from parsed data
  const summaryParts: string[] = [];
  if (parsed.service_type) summaryParts.push(parsed.service_type);
  if (parsed.vehicle) summaryParts.push(parsed.vehicle);
  if (parsed.pickup_city && parsed.dropoff_city) {
    summaryParts.push(`${parsed.pickup_city} → ${parsed.dropoff_city}`);
  } else if (parsed.pickup_city) {
    summaryParts.push(`in ${parsed.pickup_city}`);
  }
  if (parsed.urgency === "asap") summaryParts.push("ASAP");

  const aiSummary = summaryParts.length > 0
    ? summaryParts.join(" · ")
    : "Call transcribed — review transcript for details";

  // Update the call record
  await supabase
    .from("calls")
    .update({
      transcript: transcriptionText,
      ai_summary: aiSummary,
    })
    .eq("id", callId);

  return NextResponse.json({ ok: true });
}
