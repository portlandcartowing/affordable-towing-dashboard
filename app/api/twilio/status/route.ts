import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { transcribeRecording } from "@/lib/transcribe";
import { processPostCall } from "@/lib/postCallProcessor";

// ---------------------------------------------------------------------------
// Twilio Recording Status Callback
//
// Fires when a call recording is ready. This endpoint:
// 1. Saves the recording URL (proxied, no auth needed)
// 2. Saves call duration
// 3. Auto-transcribes via Deepgram
// 4. Runs AI post-call processor (summary + booking detection + auto-job)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.formData();
  const callSid = body.get("CallSid") as string | null;
  const recordingUrl = body.get("RecordingUrl") as string | null;
  const recordingSid = body.get("RecordingSid") as string | null;
  const recordingDuration = body.get("RecordingDuration") as string | null;

  if (!callSid) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const baseUrl = `https://${req.headers.get("host")}`;

  // Find the call by Twilio SID
  const { data: calls } = await supabase
    .from("calls")
    .select("id, caller_phone")
    .like("notes", `%${callSid}%`)
    .limit(1);

  if (!calls || calls.length === 0) {
    return NextResponse.json({ ok: false, error: "Call not found" });
  }

  const callId = calls[0].id;
  const callerPhone = calls[0].caller_phone;

  // Build proxy URL for the recording
  const proxyRecordingUrl = recordingSid
    ? `${baseUrl}/api/twilio/recording/${recordingSid}`
    : recordingUrl
    ? `${recordingUrl}.mp3`
    : null;

  // Save recording URL + duration, clear twilio_sid from notes
  const update: Record<string, unknown> = {};
  if (proxyRecordingUrl) update.recording_url = proxyRecordingUrl;
  if (recordingDuration) update.duration_seconds = parseInt(recordingDuration, 10);
  update.ai_summary = "Transcribing…";
  update.notes = null;

  await supabase.from("calls").update(update).eq("id", callId);

  // Auto-transcribe with Deepgram, then run AI post-call processor
  if (proxyRecordingUrl) {
    try {
      const transcription = await transcribeRecording(proxyRecordingUrl);

      if (transcription) {
        // Save chat-style transcript + structured chunks immediately
        const chunks = transcription.utterances.map((u, i) => ({
          id: `${callId}-${i}`,
          speaker: u.speaker,
          text: u.text,
          at: new Date(Date.now() - (transcription.utterances.length - i) * 1000).toISOString(),
        }));

        await supabase.from("calls").update({
          transcript: transcription.transcript,
          transcript_chunks: chunks,
          ai_summary: "Analyzing call…",
        }).eq("id", callId);

        // Run AI post-call processor (summary + booking detection + auto-job)
        const result = await processPostCall(callId, callerPhone, transcription.transcript);

        console.log("Post-call processing complete:", {
          callId,
          booked: result.booking.isBooked,
          price: result.booking.price,
          jobCreated: result.autoJob?.created ?? false,
        });
      } else {
        await supabase.from("calls").update({
          ai_summary: "Transcription failed — recording available for playback",
        }).eq("id", callId);
      }
    } catch (err) {
      console.error("Auto-transcription error:", err);
      await supabase.from("calls").update({
        ai_summary: "Transcription error — recording available for playback",
      }).eq("id", callId);
    }
  }

  return NextResponse.json({ ok: true });
}
