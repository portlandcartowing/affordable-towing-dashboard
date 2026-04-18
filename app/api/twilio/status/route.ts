import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Twilio Recording Status Callback — fires when a call recording is ready.
//
// Updates the call record with:
//   - recording URL
//   - call duration
//
// This URL is set in the TwiML <Dial record> tag, not in the console.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.formData();
  const callSid = body.get("CallSid") as string | null;
  const recordingUrl = body.get("RecordingUrl") as string | null;
  const recordingDuration = body.get("RecordingDuration") as string | null;

  if (!callSid) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Find the call by the Twilio SID stored in notes during creation
  const { data: calls } = await supabase
    .from("calls")
    .select("id")
    .like("notes", `%${callSid}%`)
    .limit(1);

  if (calls && calls.length > 0) {
    const update: Record<string, unknown> = {};
    if (recordingUrl) update.recording_url = `${recordingUrl}.mp3`;
    if (recordingDuration)
      update.duration_seconds = parseInt(recordingDuration, 10);

    await supabase.from("calls").update(update).eq("id", calls[0].id);
  }

  return NextResponse.json({ ok: true });
}
