import type {
  CallCenterCall,
  TranscriptChunk,
  CopilotPrompt,
} from "./types";
import { emptyExtractedFields } from "./types";

// ---------------------------------------------------------------------------
// Mock dataset. Five calls in different states so the dispatcher can walk
// the full workflow without real telephony wired up. Replace with a
// Supabase fetch once the `calls` table is populated by Twilio webhooks.
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

// The scripted transcript for the LIVE call. The streamer plays these one
// by one so the dispatcher can watch the workspace react in real time.
const LIVE_SCRIPT: TranscriptChunk[] = [
  chunk(1, "dispatcher", "Affordable Car Towing, this is Dana, how can I help?", 24),
  chunk(2, "caller", "Hi, yeah, my car just died on me. I'm stuck.", 20),
  chunk(3, "dispatcher", "Sorry to hear that. What's your current location?", 16),
  chunk(4, "caller", "I'm in a parking lot near Burnside and 82nd in Portland.", 12),
  chunk(5, "dispatcher", "Got it. And what kind of vehicle is it?", 8),
  chunk(6, "caller", "It's a 2015 Toyota Camry. It won't start, battery is completely dead I think.", 4),
];

const LIVE_COPILOT: CopilotPrompt[] = [
  { id: "p1", text: "Get exact pickup address", kind: "action" },
  { id: "p2", text: "Stranded — quote fast, close now", kind: "warning" },
];

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export const MOCK_CALLS: CallCenterCall[] = [
  {
    id: "call-live-001",
    caller_phone: "(503) 555-0142",
    source: "google_ads",
    started_at: iso(2),
    duration_seconds: 72,
    status: "live",
    dispatcher: "Dana",
    // Mid-call state: first 2 lines already on screen, remaining 4 stream in.
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
  {
    id: "call-new-002",
    caller_phone: "(971) 555-0088",
    source: "facebook",
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
  {
    id: "call-quoted-003",
    caller_phone: "(503) 555-0199",
    source: "google_ads",
    started_at: iso(18),
    duration_seconds: 420,
    status: "quoted",
    dispatcher: "Dana",
    transcript: [
      chunk(10, "dispatcher", "Thanks for calling Portland Car Towing.", 420),
      chunk(11, "caller", "Need a tow from Beaverton to downtown Portland. Honda Civic, runs fine, just overheating.", 390),
      chunk(12, "dispatcher", "That's about 9 miles. I can get a truck out in 25 minutes for $145 total.", 300),
      chunk(13, "caller", "Let me think about it. I'll call back.", 260),
    ],
    extracted: {
      ...emptyExtractedFields(),
      customer_name: { value: null, confidence: "needs_review" },
      callback_phone: { value: "(503) 555-0199", confidence: "high" },
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
    notes: "Overheating — recommend water/coolant stop before loading.",
    lost_reason: null,
    callback_at: null,
  },
  {
    id: "call-booked-004",
    caller_phone: "(503) 555-0211",
    source: "seo",
    started_at: iso(35),
    duration_seconds: 310,
    status: "booked",
    dispatcher: "Dana",
    transcript: [
      chunk(20, "dispatcher", "Affordable Car Towing, how can I help?", 310),
      chunk(21, "caller", "I got a flat on 205 near exit 14. 2020 Ford F-150. Can you come change the tire?", 290),
      chunk(22, "dispatcher", "Absolutely. Do you have a spare with you?", 260),
      chunk(23, "caller", "Yes, full spare in the bed.", 250),
      chunk(24, "dispatcher", "Perfect. $85 flat. Truck out in 20 minutes, name for the ticket?", 230),
      chunk(25, "caller", "James Carter, and yes please book it.", 200),
    ],
    extracted: {
      ...emptyExtractedFields(),
      customer_name: { value: "James Carter", confidence: "high" },
      callback_phone: { value: "(503) 555-0211", confidence: "high" },
      service_type: { value: "Tire Change", confidence: "high" },
      pickup_address: { value: "I-205 Exit 14", confidence: "high" },
      vehicle_year: { value: "2020", confidence: "high" },
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
    ai_summary: "Flat tire roadside on I-205 exit 14. 2020 Ford F-150 with spare in bed. Booked at $85, ETA 20 min. Customer: James Carter.",
    quote_base: 85,
    quote_mileage: 0,
    quote_non_runner: false,
    quote_after_hours: false,
    final_quote: 85,
    notes: "Spare tire in bed, customer waiting at vehicle.",
    lost_reason: null,
    callback_at: null,
  },
  {
    id: "call-callback-005",
    caller_phone: "(503) 555-0312",
    source: "google_ads",
    started_at: iso(95),
    duration_seconds: 180,
    status: "callback",
    dispatcher: "Dana",
    transcript: [
      chunk(30, "caller", "Calling about transport from Portland to Seattle for a non-running Tesla Model 3.", 180),
      chunk(31, "dispatcher", "That's a long haul, I'll need to check driver availability. Can I call you back in 30 minutes with a firm quote?", 140),
      chunk(32, "caller", "Yes, that works. My number is 503-555-0312.", 100),
    ],
    extracted: {
      ...emptyExtractedFields(),
      callback_phone: { value: "(503) 555-0312", confidence: "high" },
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
    ai_summary: "Non-running 2020s Tesla Model 3 transport Portland → Seattle. Customer requested callback in 30 min with firm quote.",
    quote_base: 250,
    quote_mileage: 175,
    quote_non_runner: true,
    quote_after_hours: false,
    final_quote: null,
    notes: "Long haul, needs winch for non-runner. Check driver availability first.",
    lost_reason: null,
    callback_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  },
  {
    id: "call-lost-006",
    caller_phone: "(971) 555-0444",
    source: "facebook",
    started_at: iso(140),
    duration_seconds: 95,
    status: "lost",
    dispatcher: "Dana",
    transcript: [
      chunk(40, "caller", "How much for a tow from Hillsboro to Gresham?", 95),
      chunk(41, "dispatcher", "About 22 miles, that's around $185.", 70),
      chunk(42, "caller", "Yeah that's too much, I'll shop around. Thanks.", 40),
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
