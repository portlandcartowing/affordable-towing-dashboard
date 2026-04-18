import { NextResponse } from "next/server";
import twilio from "twilio";

// ---------------------------------------------------------------------------
// Generates a short-lived Twilio Access Token for the browser-based
// Twilio Client SDK. The driver app calls this on load to register as
// a VoIP endpoint that can receive incoming calls.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    return NextResponse.json(
      {
        error: "Twilio Client not configured. Run /api/twilio/setup first.",
        missing: {
          TWILIO_API_KEY_SID: !apiKeySid,
          TWILIO_API_KEY_SECRET: !apiKeySecret,
          TWILIO_TWIML_APP_SID: !twimlAppSid,
        },
      },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const identity = searchParams.get("identity") || "driver";

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity,
    ttl: 3600, // 1 hour
  });

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  token.addGrant(voiceGrant);

  return NextResponse.json({
    token: token.toJwt(),
    identity,
  });
}
