// ---------------------------------------------------------------------------
// Post-call AI processor — runs after every Deepgram transcription.
//
// 1. Generates a real 1-2 sentence AI summary via Claude API
// 2. Detects if the customer booked a job (acceptance phrases + quoted price)
// 3. If booked: auto-creates lead + job in Supabase, links to call
//
// Called from the Twilio recording status callback (route.ts).
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { parseTranscript } from "@/lib/transcriptParser";

// ---------------------------------------------------------------------------
// AI Summary via Claude
// ---------------------------------------------------------------------------

export async function generateAISummary(transcript: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set — falling back to parsed summary");
    return fallbackSummary(transcript);
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are summarizing a phone call transcript for a towing company dispatcher. Write a 1-2 sentence summary of what the customer needs. Include: vehicle info, service type, pickup/dropoff locations, quoted price, and whether they accepted. Be concise and specific. If the call is spam or irrelevant, say so.

Transcript:
${transcript}`,
        },
      ],
    });

    const block = message.content[0];
    if (block.type === "text" && block.text.trim()) {
      return block.text.trim();
    }
    return fallbackSummary(transcript);
  } catch (err) {
    console.error("Claude API error:", err);
    return fallbackSummary(transcript);
  }
}

function fallbackSummary(transcript: string): string {
  const parsed = parseTranscript(transcript);
  const parts: string[] = [];
  if (parsed.service_type) parts.push(parsed.service_type);
  if (parsed.vehicle) parts.push(parsed.vehicle);
  if (parsed.pickup_city && parsed.dropoff_city) {
    parts.push(`${parsed.pickup_city} → ${parsed.dropoff_city}`);
  } else if (parsed.pickup_city) {
    parts.push(`in ${parsed.pickup_city}`);
  }
  if (parsed.urgency === "asap") parts.push("ASAP");
  return parts.length > 0
    ? parts.join(" · ")
    : "Call transcribed — see transcript below";
}

// ---------------------------------------------------------------------------
// Booking detection — did the customer accept?
// ---------------------------------------------------------------------------

const ACCEPTANCE_PHRASES = [
  /\b(yes|yeah|yep|yup|sure|okay|ok|alright|absolutely|definitely|perfect)\b/i,
  /\b(book\s*it|let'?s\s*do\s*it|go\s*ahead|sounds?\s*good|i'?ll\s*take\s*it)\b/i,
  /\b(that\s*works|deal|we'?re?\s*good|do\s*it|send\s*(him|her|them|the\s*driver))\b/i,
  /\b(i'?m\s*down|works?\s*for\s*me|let'?s\s*go|come\s*get\s*(me|it|the\s*car))\b/i,
];

const PRICE_PATTERNS = [
  /\$\s?(\d{2,4})/,                                  // $145, $ 200
  /(\d{2,4})\s*(?:dollars|bucks)/i,                   // 145 dollars
  /(?:quote|price|cost|charge|total|be)\s*(?:is\s*)?(?:\$\s?)?(\d{2,4})/i,  // quote is 145
  /(?:one|two|three|four|five|six|seven|eight|nine)\s+(?:hundred|fifty|forty|thirty|twenty)/i, // "one forty five"
];

interface BookingSignal {
  isBooked: boolean;
  price: number | null;
}

export function detectBooking(transcript: string): BookingSignal {
  const hasAcceptance = ACCEPTANCE_PHRASES.some((re) => re.test(transcript));

  let price: number | null = null;
  for (const re of PRICE_PATTERNS) {
    const m = transcript.match(re);
    if (m && m[1]) {
      const parsed = parseInt(m[1], 10);
      if (parsed >= 50 && parsed <= 5000) {
        price = parsed;
        break;
      }
    }
  }

  // Need both an acceptance phrase AND a price mention to consider it booked
  return {
    isBooked: hasAcceptance && price !== null,
    price,
  };
}

// ---------------------------------------------------------------------------
// Parse vehicle into structured year/make/model for jobs table
// ---------------------------------------------------------------------------

function parseVehicle(vehicleStr: string | null): {
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
} {
  if (!vehicleStr) return { vehicle_year: null, vehicle_make: null, vehicle_model: null };
  const parts = vehicleStr.split(/\s+/);
  const yearMatch = parts[0]?.match(/^(19|20)\d{2}$/);
  if (yearMatch) {
    return {
      vehicle_year: parseInt(parts[0], 10),
      vehicle_make: parts[1] || null,
      vehicle_model: parts.slice(2).join(" ") || null,
    };
  }
  return {
    vehicle_year: null,
    vehicle_make: parts[0] || null,
    vehicle_model: parts.slice(1).join(" ") || null,
  };
}

// ---------------------------------------------------------------------------
// Auto-create lead + job for booked calls
// ---------------------------------------------------------------------------

interface AutoJobResult {
  created: boolean;
  leadId: string | null;
  jobId: string | null;
  skippedReason: string | null;
}

async function autoCreateJob(
  callId: string,
  callerPhone: string | null,
  transcript: string,
  price: number | null,
  aiSummary: string,
): Promise<AutoJobResult> {
  const parsed = parseTranscript(transcript);
  const vehicle = parseVehicle(parsed.vehicle);

  // Check for existing job from this caller in last 24 hours
  if (callerPhone) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Check leads table for recent entries with this phone
    const { data: recentLeads } = await supabase
      .from("leads")
      .select("id")
      .eq("phone", callerPhone)
      .gte("created_at", twentyFourHoursAgo)
      .limit(1);

    if (recentLeads && recentLeads.length > 0) {
      // Check if there's a job linked to this lead
      const { data: existingJobs } = await supabase
        .from("jobs")
        .select("id, notes")
        .eq("lead_id", recentLeads[0].id)
        .limit(1);

      if (existingJobs && existingJobs.length > 0) {
        // Append note to existing job
        const existingNotes = existingJobs[0].notes || "";
        const appendedNote = existingNotes
          ? `${existingNotes}\n\n[Auto] Follow-up call: ${aiSummary}`
          : `[Auto] Follow-up call: ${aiSummary}`;

        await supabase
          .from("jobs")
          .update({ notes: appendedNote })
          .eq("id", existingJobs[0].id);

        return {
          created: false,
          leadId: recentLeads[0].id,
          jobId: existingJobs[0].id,
          skippedReason: "Existing job found within 24h — added note",
        };
      }
    }
  }

  // Create lead
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      phone: callerPhone,
      service: parsed.service_type,
      city: parsed.pickup_city,
      source: "phone",
      booked: true,
      price,
      notes: aiSummary,
      call_id: callId,
    })
    .select("id")
    .single();

  if (leadErr || !lead) {
    console.error("Failed to create lead:", leadErr);
    return { created: false, leadId: null, jobId: null, skippedReason: "Lead creation failed" };
  }

  // Create job
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      lead_id: lead.id,
      status: "booked",
      phone: callerPhone,
      vehicle_year: vehicle.vehicle_year,
      vehicle_make: vehicle.vehicle_make,
      vehicle_model: vehicle.vehicle_model,
      pickup_city: parsed.pickup_city,
      dropoff_city: parsed.dropoff_city,
      price,
      notes: `[Auto-booked from call]\n${aiSummary}`,
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    console.error("Failed to create job:", jobErr);
    return { created: false, leadId: lead.id, jobId: null, skippedReason: "Job creation failed" };
  }

  // Link call to lead
  await supabase
    .from("calls")
    .update({ lead_id: lead.id })
    .eq("id", callId);

  return { created: true, leadId: lead.id, jobId: job.id, skippedReason: null };
}

// ---------------------------------------------------------------------------
// Main entry point — called after transcription completes
// ---------------------------------------------------------------------------

export interface PostCallResult {
  aiSummary: string;
  booking: BookingSignal;
  autoJob: AutoJobResult | null;
}

export async function processPostCall(
  callId: string,
  callerPhone: string | null,
  transcript: string,
): Promise<PostCallResult> {
  // 1. Generate AI summary
  const aiSummary = await generateAISummary(transcript);

  // 2. Detect booking
  const booking = detectBooking(transcript);

  // 3. Auto-create job if booked
  let autoJob: AutoJobResult | null = null;
  if (booking.isBooked) {
    autoJob = await autoCreateJob(callId, callerPhone, transcript, booking.price, aiSummary);
  }

  // 4. Update call record
  const callUpdate: Record<string, unknown> = {
    ai_summary: aiSummary,
  };
  if (booking.isBooked) {
    callUpdate.disposition = "booked";
    callUpdate.converted_to_job = true;
    if (booking.price) callUpdate.quoted_price = booking.price;
  }
  await supabase.from("calls").update(callUpdate).eq("id", callId);

  return { aiSummary, booking, autoJob };
}
