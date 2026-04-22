// ---------------------------------------------------------------------------
// Post-call AI processor — runs after every Deepgram transcription.
//
// 1. Generates a real 1-2 sentence AI summary via Claude API
// 2. Extracts structured fields via Claude (vehicle, pickup, price, etc.)
// 3. Classifies the call:
//      - booked   → explicit acceptance ("yes" + price quoted)
//      - standby  → price question / vehicle / location mentioned but no yes
//      - lost     → customer declined / outside service area
//      - (none)   → spam or unrelated
// 4. For booked/standby: auto-creates lead + job in Supabase, fires push.
//
// Called from the Twilio recording status callback (route.ts).
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase";
import { parseTranscript } from "./transcriptParser";

// ---------------------------------------------------------------------------
// AI extraction via Claude — single call returns both summary and fields.
// ---------------------------------------------------------------------------

export interface ExtractedCallData {
  summary: string;
  customer_name: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  pickup_address: string | null;
  pickup_city: string | null;
  dropoff_city: string | null;
  service_type: string | null;
  quoted_price: number | null;
  urgency: "asap" | "scheduled" | null;
  asked_for_quote: boolean;
  accepted_quote: boolean;
  is_spam: boolean;
  is_lost: boolean;
  lost_reason: string | null;
}

const EMPTY_EXTRACT: ExtractedCallData = {
  summary: "Call transcribed — see transcript",
  customer_name: null,
  vehicle_year: null,
  vehicle_make: null,
  vehicle_model: null,
  pickup_address: null,
  pickup_city: null,
  dropoff_city: null,
  service_type: null,
  quoted_price: null,
  urgency: null,
  asked_for_quote: false,
  accepted_quote: false,
  is_spam: false,
  is_lost: false,
  lost_reason: null,
};

export async function extractCallData(transcript: string): Promise<ExtractedCallData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set — using regex fallback");
    return fallbackExtract(transcript);
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `You are parsing a phone call transcript for a towing dispatcher. Extract structured data and return ONLY a JSON object, no preamble or markdown.

Schema:
{
  "summary": "1-2 sentence natural summary of what the customer needs",
  "customer_name": "first name if mentioned, else null",
  "vehicle_year": "4-digit integer or null",
  "vehicle_make": "Honda/Toyota/Ford/etc. or null",
  "vehicle_model": "Civic/Camry/F-150/etc. or null",
  "pickup_address": "street address if mentioned, else null",
  "pickup_city": "city name if mentioned, else null",
  "dropoff_city": "destination city if mentioned, else null",
  "service_type": "Tow | Jump Start | Lockout | Tire Change | Fuel Delivery | Winch Out | Long Distance Transport | null",
  "quoted_price": "integer USD (no dollar sign) quoted by dispatcher, or null",
  "urgency": "asap | scheduled | null",
  "asked_for_quote": "true if caller asked how much / cost / price / quote / estimate",
  "accepted_quote": "true if caller explicitly agreed (yes/book it/sounds good) AFTER a price was given",
  "is_spam": "true if the call is clearly spam, wrong number, silent, or unrelated",
  "is_lost": "true if customer declined or dispatcher said we can't help",
  "lost_reason": "short reason if is_lost=true, else null"
}

Transcript:
${transcript}`,
        },
      ],
    });

    const block = message.content[0];
    if (block.type !== "text") return fallbackExtract(transcript);

    const raw = block.text.trim();
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < 0) return fallbackExtract(transcript);

    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Partial<ExtractedCallData>;
    return {
      ...EMPTY_EXTRACT,
      ...parsed,
      summary: parsed.summary?.trim() || fallbackSummary(transcript),
    };
  } catch (err) {
    console.error("Claude extract error:", err);
    return fallbackExtract(transcript);
  }
}

/** Back-compat wrapper — still used by transcription-complete webhook. */
export async function generateAISummary(transcript: string): Promise<string> {
  const data = await extractCallData(transcript);
  return data.summary;
}

function fallbackExtract(transcript: string): ExtractedCallData {
  const parsed = parseTranscript(transcript);
  const { isBooked, price } = detectBooking(transcript);
  const vehicle = parseVehicle(parsed.vehicle);
  return {
    summary: fallbackSummary(transcript),
    customer_name: parsed.customer_name,
    vehicle_year: vehicle.vehicle_year,
    vehicle_make: vehicle.vehicle_make,
    vehicle_model: vehicle.vehicle_model,
    pickup_address: parsed.pickup_address,
    pickup_city: parsed.pickup_city,
    dropoff_city: parsed.dropoff_city,
    service_type: parsed.service_type,
    quoted_price: price,
    urgency: parsed.urgency,
    asked_for_quote: QUOTE_QUESTION_RE.test(transcript),
    accepted_quote: isBooked,
    is_spam: false,
    is_lost: parsed.is_lost,
    lost_reason: parsed.lost_reason,
  };
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
  return parts.length > 0 ? parts.join(" · ") : "Call transcribed — see transcript below";
}

// ---------------------------------------------------------------------------
// Booking / pricing-question heuristics (used as fallback when AI not available)
// ---------------------------------------------------------------------------

const ACCEPTANCE_PHRASES = [
  /\b(yes|yeah|yep|yup|sure|okay|ok|alright|absolutely|definitely|perfect)\b/i,
  /\b(book\s*it|let'?s\s*do\s*it|go\s*ahead|sounds?\s*good|i'?ll\s*take\s*it)\b/i,
  /\b(that\s*works|deal|we'?re?\s*good|do\s*it|send\s*(him|her|them|the\s*driver))\b/i,
  /\b(i'?m\s*down|works?\s*for\s*me|let'?s\s*go|come\s*get\s*(me|it|the\s*car))\b/i,
];

const PRICE_PATTERNS = [
  /\$\s?(\d{2,4})/,
  /(\d{2,4})\s*(?:dollars|bucks)/i,
  /(?:quote|price|cost|charge|total|be)\s*(?:is\s*)?(?:\$\s?)?(\d{2,4})/i,
];

const QUOTE_QUESTION_RE =
  /\b(how\s+much|what'?s\s+(?:it|that|the)\s+(?:cost|gonna\s+be|charge|price)|what'?ll\s+(?:it|that)\s+(?:cost|be)|(?:ballpark|rough)\s+(?:quote|price|estimate)|give\s+me\s+a\s+(?:quote|price|estimate)|can\s+you\s+quote|how\s+much\s+(?:is|would|will|do\s+you\s+charge))\b/i;

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
  return { isBooked: hasAcceptance && price !== null, price };
}

// ---------------------------------------------------------------------------
// Vehicle string helpers
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
// Classification — decides what disposition this call deserves.
// ---------------------------------------------------------------------------

export type CallClass = "booked" | "standby" | "lost" | "spam" | "noise";

function classifyCall(data: ExtractedCallData): CallClass {
  if (data.is_spam) return "spam";
  if (data.is_lost) return "lost";
  if (data.accepted_quote && data.quoted_price) return "booked";

  // "Standby" trigger: caller asked about cost, OR we know what vehicle, OR
  // we know where the pickup is. Any one of these = qualified lead.
  const hasLocation = !!(data.pickup_address || data.pickup_city);
  const hasVehicle = !!(data.vehicle_make || data.vehicle_model);
  if (data.asked_for_quote || hasVehicle || hasLocation) return "standby";

  return "noise";
}

// ---------------------------------------------------------------------------
// Push notification helper
// ---------------------------------------------------------------------------

async function firePushNotification(
  baseUrl: string,
  payload: Record<string, unknown>,
) {
  try {
    await fetch(`${baseUrl}/api/push/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Auto-create lead + job
// ---------------------------------------------------------------------------

interface AutoJobResult {
  created: boolean;
  leadId: string | null;
  jobId: string | null;
  status: "booked" | "standby" | null;
  skippedReason: string | null;
}

async function autoCreateJob(
  callId: string,
  callerPhone: string | null,
  data: ExtractedCallData,
  classification: CallClass,
): Promise<AutoJobResult> {
  const isBooked = classification === "booked";
  const status = isBooked ? "booked" : "standby";

  // Dedup: existing lead/job from same phone within 24h → append note only
  if (callerPhone) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLeads } = await supabase
      .from("leads")
      .select("id")
      .eq("phone", callerPhone)
      .gte("created_at", twentyFourHoursAgo)
      .limit(1);

    if (recentLeads && recentLeads.length > 0) {
      const { data: existingJobs } = await supabase
        .from("jobs")
        .select("id, notes")
        .eq("lead_id", recentLeads[0].id)
        .limit(1);

      if (existingJobs && existingJobs.length > 0) {
        const existingNotes = existingJobs[0].notes || "";
        const appendedNote = existingNotes
          ? `${existingNotes}\n\n[Auto] Follow-up call: ${data.summary}`
          : `[Auto] Follow-up call: ${data.summary}`;
        await supabase.from("jobs").update({ notes: appendedNote }).eq("id", existingJobs[0].id);
        return {
          created: false,
          leadId: recentLeads[0].id,
          jobId: existingJobs[0].id,
          status: null,
          skippedReason: "Existing job within 24h — appended note",
        };
      }
    }
  }

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      customer: data.customer_name,
      phone: callerPhone,
      service: data.service_type,
      city: data.pickup_city,
      source: "phone",
      booked: isBooked,
      price: data.quoted_price,
      notes: data.summary,
      call_id: callId,
    })
    .select("id")
    .single();

  if (leadErr || !lead) {
    console.error("Failed to create lead:", leadErr);
    return { created: false, leadId: null, jobId: null, status: null, skippedReason: "Lead creation failed" };
  }

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      lead_id: lead.id,
      status,
      customer: data.customer_name,
      phone: callerPhone,
      vehicle_year: data.vehicle_year,
      vehicle_make: data.vehicle_make,
      vehicle_model: data.vehicle_model,
      pickup_address: data.pickup_address,
      pickup_city: data.pickup_city,
      dropoff_city: data.dropoff_city,
      price: data.quoted_price,
      notes: `[Auto-${status} from call]\n${data.summary}`,
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    console.error("Failed to create job:", jobErr);
    return { created: false, leadId: lead.id, jobId: null, status: null, skippedReason: "Job creation failed" };
  }

  await supabase.from("calls").update({ lead_id: lead.id }).eq("id", callId);

  return { created: true, leadId: lead.id, jobId: job.id, status, skippedReason: null };
}

// ---------------------------------------------------------------------------
// Main entry point — called after transcription completes
// ---------------------------------------------------------------------------

export interface PostCallResult {
  aiSummary: string;
  classification: CallClass;
  autoJob: AutoJobResult | null;
}

export async function processPostCall(
  callId: string,
  callerPhone: string | null,
  transcript: string,
  baseUrl?: string,
): Promise<PostCallResult> {
  // 1. Extract structured data + summary via Claude
  const data = await extractCallData(transcript);

  // 2. Classify
  const classification = classifyCall(data);

  // 3. Auto-create lead+job for booked/standby
  let autoJob: AutoJobResult | null = null;
  if (classification === "booked" || classification === "standby") {
    autoJob = await autoCreateJob(callId, callerPhone, data, classification);
  }

  // 4. Update call record with AI summary + classification
  const callUpdate: Record<string, unknown> = {
    ai_summary: data.summary,
  };
  if (classification === "booked") {
    callUpdate.disposition = "booked";
    callUpdate.converted_to_job = true;
  } else if (classification === "standby") {
    callUpdate.disposition = "standby";
  } else if (classification === "lost") {
    callUpdate.disposition = "lost";
    callUpdate.lost_reason = data.lost_reason;
  } else if (classification === "spam") {
    callUpdate.disposition = "spam";
  }
  if (data.quoted_price) callUpdate.quoted_price = data.quoted_price;
  await supabase.from("calls").update(callUpdate).eq("id", callId);

  // 5. Fire push notification on booked (and later: on standby-proposal-sent)
  if (baseUrl && autoJob?.created && classification === "booked") {
    await firePushNotification(baseUrl, {
      type: "job_booked",
      caller_phone: callerPhone,
      call_id: callId,
      job_id: autoJob.jobId,
      price: data.quoted_price,
      pickup: data.pickup_address || data.pickup_city,
    });
  }

  return { aiSummary: data.summary, classification, autoJob };
}
