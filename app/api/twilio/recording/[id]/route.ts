import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Recording proxy — serves Twilio recordings through our domain so the
// dashboard and mobile browser players can stream them without Twilio's
// HTTP auth prompts.
//
// Usage: /api/twilio/recording/RExxxxx
//
// Requires Range-request support so browser audio players can:
//   1. Calculate the correct scrub-bar scale (needs Content-Length)
//   2. Seek to a specific position (needs 206 Partial Content)
// Without these, the scrub bar ends up misaligned with real playback time.
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 500 });
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${id}.mp3`;
  const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  // Forward Range header if present so partial-content seeking works.
  const range = req.headers.get("range");
  const upstreamHeaders: Record<string, string> = { Authorization: authHeader };
  if (range) upstreamHeaders["Range"] = range;

  const response = await fetch(twilioUrl, { headers: upstreamHeaders });

  if (!response.ok && response.status !== 206) {
    return NextResponse.json(
      { error: "Recording not found" },
      { status: response.status },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": response.headers.get("content-type") || "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  };

  const contentLength = response.headers.get("content-length");
  if (contentLength) headers["Content-Length"] = contentLength;

  const contentRange = response.headers.get("content-range");
  if (contentRange) headers["Content-Range"] = contentRange;

  return new NextResponse(response.body, {
    status: response.status,
    headers,
  });
}
