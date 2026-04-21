import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getTwilioClient, twilioNumber } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing auth token" }, { status: 401 });
  }

  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: userData, error: userErr } = await verifier.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  const { to, body, callId } = await req.json();
  if (!to || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ ok: false, error: "Missing phone or message body" }, { status: 400 });
  }

  let leadId: string | null = null;
  let jobId: string | null = null;
  if (callId) {
    const { data: call } = await supabase
      .from("calls")
      .select("lead_id")
      .eq("id", callId)
      .single();
    if (call?.lead_id) {
      leadId = call.lead_id;
      const { data: job } = await supabase
        .from("jobs")
        .select("id")
        .eq("lead_id", leadId)
        .limit(1)
        .single();
      if (job) jobId = job.id;
    }
  }

  try {
    const msg = await getTwilioClient().messages.create({
      to,
      from: twilioNumber,
      body: body.trim(),
    });

    await supabase.from("messages").insert({
      direction: "outbound",
      from_number: twilioNumber,
      to_number: to,
      body: body.trim(),
      call_id: callId ?? null,
      lead_id: leadId,
      job_id: jobId,
      twilio_sid: msg.sid,
      status: "sent",
    });

    return NextResponse.json({ ok: true, sid: msg.sid });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
