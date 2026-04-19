import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Recording proxy — serves Twilio recordings through our domain so the
// dashboard can play them without Twilio HTTP auth prompts.
//
// Usage: /api/twilio/recording/RExxxxx
// The recording SID is extracted from the URL and fetched from Twilio
// with auth credentials server-side.
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 500 });
  }

  // Fetch the recording from Twilio with auth
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${id}.mp3`;
  const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetch(twilioUrl, {
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Recording not found" },
      { status: response.status },
    );
  }

  const audioBuffer = await response.arrayBuffer();

  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
