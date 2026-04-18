import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Twilio SMS Webhook — fires on every inbound text to your Twilio number.
//
// Logs the message. Future: reply handling, proposal acceptance via text.
//
// Configure this URL in Twilio Console:
//   Phone Numbers → your number → Messaging Configuration → "A message comes in"
//   → Webhook → POST → https://yourdomain.com/api/twilio/sms
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.formData();
  const from = body.get("From") as string | null;
  const to = body.get("To") as string | null;
  const messageBody = body.get("Body") as string | null;

  // Log inbound SMS — for now, store as a note on the most recent call
  // from this number. Future: dedicated messages table.
  if (from) {
    const { data: recentCall } = await supabase
      .from("calls")
      .select("id, notes")
      .eq("caller_phone", from)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recentCall) {
      const existingNotes = recentCall.notes || "";
      const smsNote = `\n[SMS ${new Date().toLocaleTimeString()}] ${messageBody}`;
      await supabase
        .from("calls")
        .update({ notes: existingNotes + smsNote })
        .eq("id", recentCall.id);
    }
  }

  // Reply with empty TwiML (no auto-response for now)
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
