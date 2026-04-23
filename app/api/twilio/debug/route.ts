import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// Debug endpoint — shows what the webhook would dial
// Hit /api/twilio/debug in your browser to see the driver IDs

export async function GET() {
  const { data: drivers, error } = await supabase
    .from("drivers")
    .select("id, name, status")
    .eq("status", "available");

  return NextResponse.json({
    available_drivers: drivers,
    error: error?.message,
    forward_phone: process.env.FORWARD_PHONE_NUMBER ? "SET" : "MISSING",
    twiml_app_sid: process.env.TWILIO_TWIML_APP_SID ? "SET" : "MISSING",
    api_key_sid: process.env.TWILIO_API_KEY_SID ? "SET" : "MISSING",
  });
}
