// ---------------------------------------------------------------------------
// Auto-fill dropoff address from an inbound SMS reply.
//
// Called from the Twilio SMS webhook. Looks for an open job from this phone
// that we recently asked a dropoff for (jobs.dropoff_requested_at). If found,
// runs the message body through Claude to extract a street/city/state/zip,
// writes it to the job, kicks off fee calc, and fires a driver push.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin as supabase } from "./supabaseAdmin";
import { calculateAndPersistJobFee } from "./calculateJobFee";

interface Extracted {
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  confident: boolean;
}

async function extractAddressFromMessage(text: string): Promise<Extracted> {
  const empty: Extracted = { street: null, city: null, state: null, zip: null, confident: false };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return empty;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `A towing customer was asked to reply with their drop-off address. Extract it as strict JSON, or return {"confident": false} if the message isn't a coherent address.

Schema:
{
  "street": "street address with number, or null",
  "city": "city name, or null",
  "state": "2-letter state abbreviation, or null",
  "zip": "5-digit zip, or null",
  "confident": "true if you parsed a real address, false for noise/unrelated"
}

Reply text:
${text}`,
        },
      ],
    });

    const block = resp.content[0];
    if (block.type !== "text") return empty;
    const raw = block.text.trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0) return empty;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<Extracted>;
    return {
      street: parsed.street ?? null,
      city: parsed.city ?? null,
      state: parsed.state ?? null,
      zip: parsed.zip ?? null,
      confident: parsed.confident === true && (!!parsed.street || !!parsed.city),
    };
  } catch {
    return empty;
  }
}

export async function tryAutoFillDropoff(args: {
  fromPhone: string;
  body: string;
  baseUrl: string;
}): Promise<{ filled: boolean; jobId: string | null }> {
  // Is there a pending dropoff request for this phone within the last hour?
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, driver_id, dropoff_address, dropoff_city, dropoff_requested_at, phone")
    .eq("phone", args.fromPhone)
    .gte("dropoff_requested_at", cutoff)
    .is("dropoff_address", null)
    .order("dropoff_requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!job) return { filled: false, jobId: null };

  const parsed = await extractAddressFromMessage(args.body);
  if (!parsed.confident) return { filled: false, jobId: job.id };

  await supabase
    .from("jobs")
    .update({
      dropoff_address: parsed.street,
      dropoff_city: parsed.city,
      dropoff_state: parsed.state,
      dropoff_zip: parsed.zip,
    })
    .eq("id", job.id);

  // Fee calc happens in the background — doesn't block the SMS response.
  calculateAndPersistJobFee(job.id).catch(() => {});

  // Notify the driver that the dropoff came in.
  try {
    await fetch(`${args.baseUrl}/api/push/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "job_booked", // reuse the high-priority channel
        caller_phone: args.fromPhone,
        job_id: job.id,
        pickup: "Dropoff received",
        body: `Dropoff: ${[parsed.street, parsed.city].filter(Boolean).join(", ")}`,
      }),
    });
  } catch {
    // best-effort
  }

  return { filled: true, jobId: job.id };
}
