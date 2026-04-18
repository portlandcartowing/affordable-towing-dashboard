"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { getTwilioClient, twilioNumber } from "@/lib/twilio";
import { createProposal } from "@/lib/proposals";
import type { LostReason } from "@/lib/types";

// ---------------------------------------------------------------------------
// Dad's 5 call disposition buttons — each writes to Supabase and triggers
// the appropriate downstream action.
// ---------------------------------------------------------------------------

const revalidateAll = () => {
  revalidatePath("/call-center");
  revalidatePath("/calls");
  revalidatePath("/leads");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
};

// ---- 1. BOOKED ----
// Creates a lead + job, marks the call as booked.
export async function dispatchBooked(callId: string, fields: {
  customer: string | null;
  phone: string | null;
  service: string | null;
  pickup_city: string | null;
  dropoff_city: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  price: number | null;
  notes: string;
}) {
  // Create lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      customer: fields.customer,
      phone: fields.phone,
      service: fields.service,
      city: fields.pickup_city,
      source: "call",
      booked: true,
      price: fields.price,
      notes: fields.notes,
      call_id: callId,
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return { ok: false, error: leadError?.message || "Failed to create lead" };
  }

  // Create job
  const { error: jobError } = await supabase.from("jobs").insert({
    lead_id: lead.id,
    status: "waiting_for_driver",
    customer: fields.customer,
    phone: fields.phone,
    vehicle_year: fields.vehicle_year,
    vehicle_make: fields.vehicle_make,
    vehicle_model: fields.vehicle_model,
    pickup_city: fields.pickup_city,
    dropoff_city: fields.dropoff_city,
    price: fields.price,
    notes: fields.notes,
  });

  if (jobError) {
    return { ok: false, error: jobError.message };
  }

  // Update call
  await supabase
    .from("calls")
    .update({
      disposition: "booked",
      lead_id: lead.id,
      quoted_price: fields.price,
      converted_to_job: true,
    })
    .eq("id", callId);

  revalidateAll();
  return { ok: true };
}

// ---- 2. STANDBY ----
// Creates a lead + proposal, sends SMS with accept link.
export async function dispatchStandby(callId: string, fields: {
  customer: string | null;
  phone: string;
  service: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  vehicle_desc: string | null;
  quoted_price: number | null;
  eta_min: number | null;
  eta_max: number | null;
  driver_area: string | null;
  notes: string;
}) {
  // Create lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      customer: fields.customer,
      phone: fields.phone,
      service: fields.service,
      city: fields.pickup_address,
      source: "call",
      booked: false,
      price: fields.quoted_price,
      notes: fields.notes,
      call_id: callId,
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return { ok: false, error: leadError?.message || "Failed to create lead" };
  }

  // Create proposal
  const proposalResult = await createProposal({
    call_id: callId,
    lead_id: lead.id,
    service_type: fields.service,
    quoted_price: fields.quoted_price,
    eta_min: fields.eta_min,
    eta_max: fields.eta_max,
    driver_area: fields.driver_area,
    route_summary: null,
    vehicle_desc: fields.vehicle_desc,
    pickup_address: fields.pickup_address,
    dropoff_address: fields.dropoff_address,
    notes: fields.notes,
  });

  if (!proposalResult.ok || !proposalResult.proposal) {
    return { ok: false, error: proposalResult.error || "Failed to create proposal" };
  }

  const proposal = proposalResult.proposal;

  // Update call
  await supabase
    .from("calls")
    .update({
      disposition: "standby",
      lead_id: lead.id,
      proposal_id: proposal.id,
      quoted_price: fields.quoted_price,
    })
    .eq("id", callId);

  // Send SMS with proposal link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const proposalUrl = `${baseUrl}/proposal/${proposal.token}`;

  try {
    await getTwilioClient().messages.create({
      to: fields.phone,
      from: twilioNumber,
      body: `Portland Car Towing — Your quote: $${fields.quoted_price ?? "TBD"}. ETA: ${fields.eta_min ?? "~"}–${fields.eta_max ?? "~"} min. View & accept: ${proposalUrl}`,
    });

    // Mark proposal as sent
    await supabase
      .from("proposals")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", proposal.id);
  } catch (smsError) {
    // SMS failed but proposal still created — don't block the flow
    console.error("SMS send failed:", smsError);
  }

  revalidateAll();
  return { ok: true, proposalToken: proposal.token };
}

// ---- 3. LOST ----
export async function dispatchLost(
  callId: string,
  reason: LostReason,
  quotedPrice: number | null,
) {
  await supabase
    .from("calls")
    .update({
      disposition: "lost",
      lost_reason: reason,
      quoted_price: quotedPrice,
    })
    .eq("id", callId);

  revalidateAll();
  return { ok: true };
}

// ---- 4. CALLBACK ----
export async function dispatchCallback(
  callId: string,
  callbackAt: string,
  phone: string | null,
) {
  await supabase
    .from("calls")
    .update({
      disposition: "callback",
      callback_at: callbackAt,
    })
    .eq("id", callId);

  revalidateAll();
  return { ok: true };
}

// ---- 5. SPAM ----
export async function dispatchSpam(callId: string) {
  await supabase
    .from("calls")
    .update({ disposition: "spam" })
    .eq("id", callId);

  revalidateAll();
  return { ok: true };
}

// ---- Send customer confirmation text ----
export async function sendConfirmationText(
  phone: string,
  customerName: string | null,
  price: number | null,
) {
  const name = customerName?.split(" ")[0] ?? "there";
  try {
    await getTwilioClient().messages.create({
      to: phone,
      from: twilioNumber,
      body: `Hi ${name}! Portland Car Towing confirming your job. ${price != null ? `Total: $${price}. ` : ""}A driver is on the way. Reply STOP to opt out.`,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
