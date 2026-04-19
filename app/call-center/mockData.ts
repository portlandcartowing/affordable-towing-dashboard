import type {
  CallCenterCall,
  TranscriptChunk,
  CopilotPrompt,
} from "./types";
import { emptyExtractedFields } from "./types";

// ---------------------------------------------------------------------------
// Sample dataset. Demonstrates each call state so the dispatcher workflow
// can be tested end-to-end. Replace with Supabase fetch once Twilio
// webhooks populate the `calls` table with real data.
// ---------------------------------------------------------------------------

function iso(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function chunk(
  i: number,
  speaker: "caller" | "dispatcher",
  text: string,
  secondsAgo: number,
): TranscriptChunk {
  return {
    id: `c${i}`,
    speaker,
    text,
    at: new Date(Date.now() - secondsAgo * 1000).toISOString(),
  };
}

// Scripted transcript for the LIVE call demo. The streamer plays these
// one by one so the dispatcher can watch the workspace react in real time.
const LIVE_SCRIPT: TranscriptChunk[] = [
  chunk(1, "dispatcher", "Portland Car Towing, how can I help?", 24),
  chunk(2, "caller", "Hi, my car broke down and I need a tow.", 20),
  chunk(3, "dispatcher", "No problem. What's your current location?", 16),
  chunk(4, "caller", "I'm near Burnside and 82nd in Portland.", 12),
  chunk(5, "dispatcher", "Got it. What kind of vehicle?", 8),
  chunk(6, "caller", "2015 Toyota Camry. It won't start at all.", 4),
];

const LIVE_COPILOT: CopilotPrompt[] = [
  { id: "p1", text: "Get exact pickup address", kind: "action" },
  { id: "p2", text: "Stranded — quote fast, close now", kind: "warning" },
];

// ---------------------------------------------------------------------------
// Sample Calls — one per status to demo the full workflow
// ---------------------------------------------------------------------------

export const MOCK_CALLS: CallCenterCall[] = [
  // ── LIVE ── Currently on the phone
  {
    id: "call-live-001",
    caller_phone: "Incoming",
    source: "google_ads",
    started_at: iso(2),
    duration_seconds: 72,
    status: "live",
    dispatcher: null,
    transcript: LIVE_SCRIPT.slice(0, 2),
    scripted_remaining: LIVE_SCRIPT.slice(2),
    extracted: emptyExtractedFields(),
    copilot: LIVE_COPILOT,
    ai_summary: null,
    quote_base: 95,
    quote_mileage: 0,
    quote_non_runner: false,
    quote_after_hours: false,
    final_quote: null,
    notes: "",
    lost_reason: null,
    callback_at: null,
  },

  // ── NEW CALL ── Ringing, not yet answered
  {
    id: "call-new-002",
    caller_phone: "Incoming",
    source: "gbp",
    started_at: iso(0),
    duration_seconds: 3,
    status: "new_call",
    dispatcher: null,
    transcript: [],
    extracted: emptyExtractedFields(),
    copilot: [
      { id: "n1", text: "New inbound — pick up the call", kind: "action" },
    ],
    ai_summary: null,
    quote_base: 95,
    quote_mileage: 0,
    quote_non_runner: false,
    quote_after_hours: false,
    final_quote: null,
    notes: "",
    lost_reason: null,
    callback_at: null,
  },

  // ── QUOTED ── Price given, customer deciding
  {
    id: "call-quoted-003",
    caller_phone: "Caller",
    source: "google_ads",
    started_at: iso(18),
    duration_seconds: 420,
    status: "quoted",
    dispatcher: null,
    transcript: [
      chunk(10, "dispatcher", "Portland Car Towing, how can I help?", 420),
      chunk(11, "caller", "Need a tow from Beaverton to downtown. Honda Civic, overheating.", 390),
      chunk(12, "dispatcher", "That's about 9 miles. I can get a truck out in 25 minutes for $145.", 300),
      chunk(13, "caller", "Let me think about it. I'll call back.", 260),
    ],
    extracted: {
      ...emptyExtractedFields(),
      customer_name: { value: null, confidence: "needs_review" },
      callback_phone: { value: null, confidence: "needs_review" },
      service_type: { value: "Tow", confidence: "high" },
      pickup_address: { value: "Beaverton", confidence: "medium" },
      dropoff_address: { value: "Downtown Portland", confidence: "medium" },
      vehicle_make: { value: "Honda", confidence: "high" },
      vehicle_model: { value: "Civic", confidence: "high" },
      running_condition: { value: "Runs, overheating", confidence: "medium" },
      quoted_price: { value: 145, confidence: "high" },
    },
    copilot: [
      { id: "q1", text: "Hesitating on price — reassure ETA", kind: "warning" },
      { id: "q2", text: "Hold quote 10 minutes", kind: "action" },
    ],
    ai_summary: "Tow request Beaverton → Downtown Portland. Honda Civic running but overheating. Quoted $145. Customer said they'd call back.",
    quote_base: 95,
    quote_mileage: 9,
    quote_non_runner: false,
    quote_after_hours: false,
    final_quote: 145,
    notes: "Overheating — recommend coolant check before loading.",
    lost_reason: null,
    callback_at: null,
  },

  // ── BOOKED ── Job confirmed, ready to dispatch
  {
    id: "call-booked-004",
    caller_phone: "Caller",
    source: "gbp",
    started_at: iso(35),
    duration_seconds: 310,
    status: "booked",
    dispatcher: null,
    transcript: [
      chunk(20, "dispatcher", "Portland Car Towing, how can I help?", 310),
      chunk(21, "caller", "I got a flat on 205 near exit 14. Ford F-150. Can you change the tire?", 290),
      chunk(22, "dispatcher", "Absolutely. Do you have a spare?", 260),
      chunk(23, "caller", "Yes, full spare in the bed.", 250),
      chunk(24, "dispatcher", "Perfect. $85 flat rate. Truck out in 20 minutes. Name for the ticket?", 230),
      chunk(25, "caller", "Yes, please book it.", 200),
    ],
    extracted: {
      ...emptyExtractedFields(),
      customer_name: { value: null, confidence: "needs_review" },
      callback_phone: { value: null, confidence: "needs_review" },
      service_type: { value: "Tire Change", confidence: "high" },
      pickup_address: { value: "I-205 Exit 14", confidence: "high" },
      vehicle_make: { value: "Ford", confidence: "high" },
      vehicle_model: { value: "F-150", confidence: "high" },
      running_condition: { value: "Drivable", confidence: "high" },
      issue_type: { value: "Flat tire", confidence: "high" },
      urgency: { value: "asap", confidence: "high" },
      quoted_price: { value: 85, confidence: "high" },
      booked: { value: true, confidence: "high" },
    },
    copilot: [
      { id: "b1", text: "Notify driver + send confirmation text", kind: "action" },
    ],
    ai_summary: "Flat tire roadside on I-205 exit 14. Ford F-150 with spare in bed. Booked at $85, ETA 20 min.",
    quote_base: 85,
    quote_mileage: 0,
    quote_non_runner: false,
    quote_after_hours: false,
    final_quote: 85,
    notes: "Spare tire in bed, customer waiting at vehicle.",
    lost_reason: null,
    callback_at: null,
  },

  // ── CALLBACK ── Need to call customer back with a quote
  {
    id: "call-callback-005",
    caller_phone: "Caller",
    source: "google_ads",
    started_at: iso(95),
    duration_seconds: 180,
    status: "callback",
    dispatcher: null,
    transcript: [
      chunk(30, "caller", "Need a transport from Portland to Seattle. Non-running Tesla Model 3.", 180),
      chunk(31, "dispatcher", "Long haul — let me check driver availability. Can I call you back in 30 minutes?", 140),
      chunk(32, "caller", "Yes, that works.", 100),
    ],
    extracted: {
      ...emptyExtractedFields(),
      callback_phone: { value: null, confidence: "needs_review" },
      service_type: { value: "Long Distance Transport", confidence: "high" },
      pickup_address: { value: "Portland", confidence: "high" },
      dropoff_address: { value: "Seattle", confidence: "high" },
      vehicle_make: { value: "Tesla", confidence: "high" },
      vehicle_model: { value: "Model 3", confidence: "high" },
      running_condition: { value: "Non-running", confidence: "high" },
    },
    copilot: [
      { id: "cb1", text: "Long-haul — confirm winch needed", kind: "action" },
      { id: "cb2", text: "Check driver pool before calling back", kind: "info" },
    ],
    ai_summary: "Non-running Tesla Model 3 transport Portland → Seattle. Customer requested callback in 30 min with firm quote.",
    quote_base: 250,
    quote_mileage: 175,
    quote_non_runner: true,
    quote_after_hours: false,
    final_quote: null,
    notes: "Long haul, needs winch for non-runner. Check driver availability first.",
    lost_reason: null,
    callback_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  },

  // ── LOST ── Customer declined
  {
    id: "call-lost-006",
    caller_phone: "Caller",
    source: "gbp",
    started_at: iso(140),
    duration_seconds: 95,
    status: "lost",
    dispatcher: null,
    transcript: [
      chunk(40, "caller", "How much for a tow from Hillsboro to Gresham?", 95),
      chunk(41, "dispatcher", "About 22 miles, that's around $185.", 70),
      chunk(42, "caller", "That's too much, I'll shop around. Thanks.", 40),
    ],
    extracted: {
      ...emptyExtractedFields(),
      service_type: { value: "Tow", confidence: "high" },
      pickup_address: { value: "Hillsboro", confidence: "high" },
      dropoff_address: { value: "Gresham", confidence: "high" },
      quoted_price: { value: 185, confidence: "high" },
    },
    copilot: [],
    ai_summary: "Tow request Hillsboro → Gresham, ~22 miles. Quoted $185. Customer declined — price shopping.",
    quote_base: 95,
    quote_mileage: 22,
    quote_non_runner: false,
    quote_after_hours: false,
    final_quote: 185,
    notes: "",
    lost_reason: "Too expensive",
    callback_at: null,
  },
];
