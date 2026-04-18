import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Quick test endpoint to verify Supabase connection + insert.
// Hit https://your-domain.vercel.app/api/test in a browser.
// DELETE THIS FILE after debugging.

export async function GET() {
  const results: Record<string, unknown> = {};

  // Test 1: Can we connect and read?
  const { data: tnData, error: tnError } = await supabase
    .from("tracking_numbers")
    .select("*")
    .limit(3);
  results.tracking_numbers = { data: tnData, error: tnError?.message };

  // Test 2: Can we insert a call?
  const { data: callData, error: callError } = await supabase
    .from("calls")
    .insert({
      caller_phone: "+10000000000",
      source: "test",
      started_at: new Date().toISOString(),
      duration_seconds: 0,
      notes: "test_insert_delete_me",
    })
    .select("id")
    .single();
  results.call_insert = { data: callData, error: callError?.message };

  // Test 3: Env vars present?
  results.env = {
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING",
    supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING",
    twilio_sid: process.env.TWILIO_ACCOUNT_SID ? "SET" : "MISSING",
    twilio_token: process.env.TWILIO_AUTH_TOKEN ? "SET" : "MISSING",
    twilio_phone: process.env.TWILIO_PHONE_NUMBER || "MISSING",
    forward_phone: process.env.FORWARD_PHONE_NUMBER || "MISSING",
  };

  return NextResponse.json(results, { status: 200 });
}
