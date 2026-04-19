import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Twilio Recording Status Callback — fires when a call recording is ready.
//
// 1. Saves recording URL + duration to the call record
// 2. Converts the Twilio recording URL to our proxy URL (no auth needed)
// 3. Kicks off post-call transcription via Twilio's Transcription API
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

  // Find the call by the Twilio SID stored in notes during creation
  const { data: calls } = await supabase
    .from("calls")
    .select("id")
    .like("notes", `%${callSid}%`)
    .limit(1);

  if (calls && calls.length > 0) {
    const callId = calls[0].id;

    // Save recording URL as our proxy URL (no Twilio auth needed)
    const update: Record<string, unknown> = {};
    if (recordingSid) {
      update.recording_url = `${baseUrl}/api/twilio/recording/${recordingSid}`;
    } else if (recordingUrl) {
      update.recording_url = `${recordingUrl}.mp3`;
    }
    if (recordingDuration) {
      update.duration_seconds = parseInt(recordingDuration, 10);
    }

    await supabase.from("calls").update(update).eq("id", callId);

    // Kick off transcription via Twilio API (async, non-blocking)
    if (recordingSid) {
      transcribeRecording(recordingSid, callId, baseUrl).catch((err) => {
        console.error("Transcription kickoff failed:", err);
      });
    }
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Post-call transcription. Uses Twilio's built-in transcription API.
// When the transcription completes, Twilio POSTs to our callback.
// ---------------------------------------------------------------------------

async function transcribeRecording(
  recordingSid: string,
  callId: string,
  baseUrl: string,
) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;

  try {
    // Use Twilio REST API directly to request transcription
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}/Transcriptions.json`;
    const auth = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        StatusCallback: `${baseUrl}/api/twilio/transcription-complete?callId=${callId}`,
        StatusCallbackMethod: "POST",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Twilio transcription request failed:", res.status, errText);
      await transcribeWithFetch(recordingSid, callId, baseUrl);
    }
  } catch (err) {
    console.error("Twilio transcription error:", err);
    await transcribeWithFetch(recordingSid, callId, baseUrl);
  }
}

// Fallback: download recording and store a placeholder until we wire
// a real STT service (Deepgram/Whisper)
async function transcribeWithFetch(
  recordingSid: string,
  callId: string,
  _baseUrl: string,
) {
  // Mark that transcription is pending
  await supabase
    .from("calls")
    .update({
      ai_summary: `Recording saved (${recordingSid}). Transcription processing…`,
    })
    .eq("id", callId);
}
