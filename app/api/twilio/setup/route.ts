import { NextRequest, NextResponse } from "next/server";
import { getTwilioClient } from "@/lib/twilio";

// ---------------------------------------------------------------------------
// One-time setup: creates the Twilio API Key + TwiML App needed for
// browser-based calling (Twilio Client SDK). Run this once by visiting:
//
//   https://your-domain.vercel.app/api/twilio/setup
//
// It returns the values you need to add to your Vercel env vars.
// After adding them, you never need to run this again.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const client = getTwilioClient();
    const baseUrl = `https://${req.headers.get("host")}`;

    // 1. Create or find TwiML App
    const apps = await client.applications.list({ friendlyName: "ACT Dispatch" });
    let twimlApp = apps[0];

    if (!twimlApp) {
      twimlApp = await client.applications.create({
        friendlyName: "ACT Dispatch",
        voiceUrl: `${baseUrl}/api/twilio/voice`,
        voiceMethod: "POST",
      });
    } else {
      // Update the voice URL in case the domain changed
      await client.applications(twimlApp.sid).update({
        voiceUrl: `${baseUrl}/api/twilio/voice`,
        voiceMethod: "POST",
      });
    }

    // 2. Create API Key for access token generation
    const apiKey = await client.newKeys.create({
      friendlyName: "ACT Dispatch Driver App",
    });

    return NextResponse.json({
      message: "Add these to your Vercel Environment Variables, then redeploy.",
      env_vars: {
        TWILIO_TWIML_APP_SID: twimlApp.sid,
        TWILIO_API_KEY_SID: apiKey.sid,
        TWILIO_API_KEY_SECRET: apiKey.secret,
      },
      warning: "Save the API_KEY_SECRET now — Twilio will never show it again.",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
