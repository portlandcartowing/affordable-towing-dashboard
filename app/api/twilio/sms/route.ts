import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseTranscript } from "@/lib/transcriptParser";

// ---------------------------------------------------------------------------
// Twilio SMS Webhook — fires on every inbound text to your Twilio number.
//
// 1. Stores the message in the messages table
// 2. Links to the most recent call/lead/job from this phone number
// 3. Parses the text for structured fields (name, address, vehicle, etc.)
// 4. Detects proposal acceptance replies ("yes", "accept")
// 5. Fires push notification to dispatchers
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
  const messageSid = body.get("MessageSid") as string | null;

  if (!from || !messageBody) {
    return twimlResponse("");
  }

  // 1. Find linked call, lead, and job by phone number
  const { callId, leadId, jobId } = await findLinkedRecords(from);

  // 2. Parse the message for structured fields
  const parsed = parseTranscript(messageBody);
  const parsedFields: Record<string, unknown> = {};
  if (parsed.customer_name) parsedFields.customer_name = parsed.customer_name;
  if (parsed.pickup_address) parsedFields.pickup_address = parsed.pickup_address;
  if (parsed.pickup_city) parsedFields.pickup_city = parsed.pickup_city;
  if (parsed.service_type) parsedFields.service_type = parsed.service_type;
  if (parsed.issue_description) parsedFields.issue_description = parsed.issue_description;
  if (parsed.vehicle) parsedFields.vehicle = parsed.vehicle;

  // 3. Store the message
  await supabase.from("messages").insert({
    direction: "inbound",
    from_number: from,
    to_number: to || "",
    body: messageBody,
    call_id: callId,
    lead_id: leadId,
    job_id: jobId,
    parsed_fields: parsedFields,
    twilio_sid: messageSid,
    status: "received",
  });

  // 4. Check for proposal acceptance ("yes", "accept", "book it", etc.)
  let replyText = "";
  if (isAcceptanceReply(messageBody)) {
    const accepted = await tryAcceptProposal(from);
    if (accepted) {
      replyText = "Your job is confirmed! A driver is being dispatched now. We'll text you with updates.";
    }
  }

  // 5. Fire push notification to dispatchers
  const baseUrl = `https://${req.headers.get("host")}`;
  try {
    await fetch(`${baseUrl}/api/push/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "message",
        caller_phone: from,
        source: "sms",
        body: messageBody.slice(0, 100),
        call_id: callId,
      }),
    });
  } catch {
    // Push notification is best-effort
  }

  // 6. Forward the inbound SMS to the owner's cell so they see it on their phone.
  //    Uses Twilio REST API. Sent from the tracking number the customer texted,
  //    so replies from the owner's phone won't thread correctly — this is one-way relay.
  await forwardInboundSms({ from, to, body: messageBody }).catch(() => {});

  return twimlResponse(replyText);
}

async function forwardInboundSms(args: { from: string | null; to: string | null; body: string }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const relayTo = process.env.SMS_FORWARD_NUMBER || "+15033888741";
  if (!sid || !token || !args.to || !args.from) return;
  if (args.to === relayTo) return; // avoid loop if Twilio number ever equals the relay target

  const preview = `[${args.to}] ${args.from}: ${args.body.slice(0, 1400)}`;
  const params = new URLSearchParams({
    To: relayTo,
    From: args.to,
    Body: preview,
  });

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twimlResponse(message: string) {
  const body = message
    ? `<Message>${escapeXml(message)}</Message>`
    : "";
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`;
  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Find the most recent call, lead, and job linked to this phone number */
async function findLinkedRecords(phone: string) {
  let callId: string | null = null;
  let leadId: string | null = null;
  let jobId: string | null = null;

  // Most recent call from this number
  const { data: call } = await supabase
    .from("calls")
    .select("id, lead_id")
    .eq("caller_phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (call) {
    callId = call.id;
    leadId = call.lead_id;

    // If call has a lead, find linked job
    if (leadId) {
      const { data: job } = await supabase
        .from("jobs")
        .select("id")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (job) jobId = job.id;
    }
  }

  // Also check leads directly by phone (in case call wasn't linked)
  if (!leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (lead) leadId = lead.id;
  }

  return { callId, leadId, jobId };
}

/** Check if a text message is an acceptance reply */
function isAcceptanceReply(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  const acceptPhrases = [
    "yes", "yeah", "yep", "yup", "ok", "okay",
    "accept", "book", "book it", "confirm", "confirmed",
    "go ahead", "let's do it", "sounds good", "do it",
    "i accept", "yes please", "yes!",
  ];
  return acceptPhrases.some((phrase) => normalized === phrase || normalized.startsWith(phrase + " "));
}

/** Try to find and accept an open proposal for this phone number */
async function tryAcceptProposal(phone: string): Promise<boolean> {
  // Find the most recent sent/viewed proposal linked to this caller
  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, lead_id, call_id, quoted_price, status")
    .in("status", ["sent", "viewed"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (!proposals || proposals.length === 0) return false;

  // Match by phone: find a proposal whose lead has this phone number
  for (const proposal of proposals) {
    if (!proposal.lead_id) continue;

    const { data: lead } = await supabase
      .from("leads")
      .select("phone")
      .eq("id", proposal.lead_id)
      .single();

    if (lead?.phone === phone) {
      // Accept this proposal
      const now = new Date().toISOString();
      await supabase
        .from("proposals")
        .update({ status: "accepted", accepted_at: now })
        .eq("id", proposal.id);

      // Update lead to booked
      await supabase
        .from("leads")
        .update({ booked: true })
        .eq("id", proposal.lead_id);

      // Create a job from the proposal
      const { data: fullProposal } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposal.id)
        .single();

      if (fullProposal) {
        await supabase.from("jobs").insert({
          lead_id: proposal.lead_id,
          status: "booked",
          phone,
          pickup_address: fullProposal.pickup_address,
          dropoff_address: fullProposal.dropoff_address,
          price: fullProposal.quoted_price,
          notes: `[Auto-booked via SMS reply]\n${fullProposal.notes || ""}`,
        });
      }

      // Update call disposition
      if (proposal.call_id) {
        await supabase
          .from("calls")
          .update({
            disposition: "booked",
            converted_to_job: true,
          })
          .eq("id", proposal.call_id);
      }

      return true;
    }
  }

  return false;
}
