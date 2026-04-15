// ---------------------------------------------------------------------------
// Call Center — dispatcher-first workspace types.
//
// These types are deliberately local to the /call-center route so the
// operator UI can evolve independently of the base Call/Lead/Job schema in
// lib/types.ts. Once the workflow stabilizes we can lift shared shapes back
// into the main schema.
// ---------------------------------------------------------------------------

export const CALL_CENTER_STATUSES = [
  "new_call",
  "live",
  "quoted",
  "booked",
  "lost",
  "callback",
  "completed",
] as const;

export type CallCenterStatus = (typeof CALL_CENTER_STATUSES)[number];

export const STATUS_LABEL: Record<CallCenterStatus, string> = {
  new_call: "New Call",
  live: "Live",
  quoted: "Quoted",
  booked: "Booked",
  lost: "Lost",
  callback: "Callback",
  completed: "Completed",
};

// Tailwind token pairs per status. Strong, operator-legible colors.
export const STATUS_STYLE: Record<
  CallCenterStatus,
  { dot: string; pill: string; ring: string }
> = {
  new_call:  { dot: "bg-slate-400",   pill: "bg-slate-100 text-slate-700",   ring: "ring-slate-300" },
  live:      { dot: "bg-blue-500",    pill: "bg-blue-50 text-blue-700",      ring: "ring-blue-400" },
  quoted:    { dot: "bg-indigo-500",  pill: "bg-indigo-50 text-indigo-700",  ring: "ring-indigo-300" },
  booked:    { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700", ring: "ring-emerald-300" },
  lost:      { dot: "bg-rose-500",    pill: "bg-rose-50 text-rose-700",      ring: "ring-rose-300" },
  callback:  { dot: "bg-amber-500",   pill: "bg-amber-50 text-amber-700",    ring: "ring-amber-300" },
  completed: { dot: "bg-slate-500",   pill: "bg-slate-100 text-slate-700",   ring: "ring-slate-300" },
};

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

export type Speaker = "caller" | "dispatcher";

export type TranscriptChunk = {
  id: string;
  speaker: Speaker;
  text: string;
  at: string; // ISO timestamp
};

// ---------------------------------------------------------------------------
// Extracted lead fields. Each field carries its own confidence so the UI
// can show a "needs review" highlight.
// ---------------------------------------------------------------------------

export type Confidence = "high" | "medium" | "needs_review";

export type ExtractedField<T> = {
  value: T | null;
  confidence: Confidence;
};

export type ExtractedFields = {
  customer_name: ExtractedField<string>;
  callback_phone: ExtractedField<string>;
  service_type: ExtractedField<string>;
  pickup_address: ExtractedField<string>;
  dropoff_address: ExtractedField<string>;
  vehicle_year: ExtractedField<string>;
  vehicle_make: ExtractedField<string>;
  vehicle_model: ExtractedField<string>;
  running_condition: ExtractedField<string>;
  issue_type: ExtractedField<string>;
  urgency: ExtractedField<string>;
  quoted_price: ExtractedField<number>;
  booked: ExtractedField<boolean>;
  notes: ExtractedField<string>;
};

export function emptyExtractedFields(): ExtractedFields {
  const blank = <T,>(): ExtractedField<T> => ({ value: null, confidence: "needs_review" });
  return {
    customer_name: blank(),
    callback_phone: blank(),
    service_type: blank(),
    pickup_address: blank(),
    dropoff_address: blank(),
    vehicle_year: blank(),
    vehicle_make: blank(),
    vehicle_model: blank(),
    running_condition: blank(),
    issue_type: blank(),
    urgency: blank(),
    quoted_price: blank(),
    booked: blank(),
    notes: blank(),
  };
}

// ---------------------------------------------------------------------------
// Copilot
// ---------------------------------------------------------------------------

export type CopilotPrompt = {
  id: string;
  text: string;
  kind: "info" | "action" | "warning";
};

// ---------------------------------------------------------------------------
// Call-center call record — client-side state. Not persisted yet; once
// Twilio/Supabase is wired this maps 1:1 onto a row in the `calls` table
// plus a joined transcript array.
// ---------------------------------------------------------------------------

export type CallCenterCall = {
  id: string;
  caller_phone: string;
  source: string;
  started_at: string;
  duration_seconds: number;
  status: CallCenterStatus;
  dispatcher: string | null;

  transcript: TranscriptChunk[];
  // When live, this is the scripted queue used by the mock streamer.
  // Remove once real-time transcription is connected.
  scripted_remaining?: TranscriptChunk[];

  extracted: ExtractedFields;
  copilot: CopilotPrompt[];
  ai_summary: string | null;

  quote_base: number;
  quote_mileage: number;
  quote_non_runner: boolean;
  quote_after_hours: boolean;
  final_quote: number | null;

  notes: string;
  lost_reason: string | null;
  callback_at: string | null;
};

// ---------------------------------------------------------------------------
// Reasons picker
// ---------------------------------------------------------------------------

export const LOST_REASONS = [
  "Too expensive",
  "No answer",
  "Shopping around",
  "Outside service area",
  "Duplicate",
] as const;

export type LostReason = (typeof LOST_REASONS)[number];
