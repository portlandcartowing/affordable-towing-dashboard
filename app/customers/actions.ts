"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getTwilioClient, twilioNumber } from "@/lib/twilio";

const REVIEW_URL = "https://g.page/r/CblqH_ZodrYWEBM/review";

function buildReviewMessage(customerName: string | null): string {
  const name = customerName?.split(" ")[0];
  const greeting = name ? `Hi ${name}!` : "Hi!";
  return `${greeting} Thanks for choosing Portland Car Towing. If we did right by you, would you mind leaving us a quick Google review? ${REVIEW_URL}`;
}

/**
 * Resolve the "from" number to use — prefer the tracking number the
 * customer last texted us on, fall back to the default Twilio number.
 */
async function resolveFromNumber(to: string): Promise<string> {
  const { data: lastInbound } = await supabase
    .from("messages")
    .select("to_number")
    .eq("direction", "inbound")
    .eq("from_number", to)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastInbound?.to_number) return lastInbound.to_number;
  return twilioNumber;
}

/**
 * Send the Google review SMS to a customer. Called from the profile
 * page's "Send Review Link" button and from the auto-trigger when a
 * job is marked completed. Safe to call multiple times — caller is
 * responsible for dedup (the auto-send path does this via a flag).
 */
export async function sendReviewLink(
  phone: string,
  opts?: { triggeredByJobId?: string },
) {
  if (!phone) return { ok: false as const, error: "Phone required" };

  const { data: lead } = await supabase
    .from("leads")
    .select("customer")
    .eq("phone", phone)
    .not("customer", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const body = buildReviewMessage(lead?.customer ?? null);
  const from = await resolveFromNumber(phone);

  try {
    const msg = await getTwilioClient().messages.create({ to: phone, from, body });

    await supabase.from("messages").insert({
      direction: "outbound",
      from_number: from,
      to_number: phone,
      body,
      twilio_sid: msg.sid,
      status: "sent",
    });

    if (opts?.triggeredByJobId) {
      await supabase
        .from("jobs")
        .update({ review_sent_at: new Date().toISOString() })
        .eq("id", opts.triggeredByJobId);
    }

    revalidatePath(`/customers/${encodeURIComponent(phone)}`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: String(err) };
  }
}
