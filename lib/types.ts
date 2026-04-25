// ---------------------------------------------------------------------------
// Shared domain types for the Affordable Towing CRM.
// Keep this file small and framework-agnostic so it can be used from server
// components, client components, and future edge/worker code.
// ---------------------------------------------------------------------------

export type UUID = string;
export type ISODate = string; // "YYYY-MM-DD"
export type ISOTimestamp = string; // full ISO 8601

// ---------------------------------------------------------------------------
// Job / Lead lifecycle
// ---------------------------------------------------------------------------

export const JOB_STATUSES = [
  "new_lead",
  "quoted",
  "booked",
  "standby",
  "callback",
  "lost",
  "spam",
  "waiting_for_driver",
  "posted_to_load_board",
  "driver_assigned",
  "in_transit",
  "completed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  new_lead: "New Lead",
  quoted: "Quoted",
  booked: "Booked",
  standby: "Standby",
  callback: "Callback",
  lost: "Lost",
  spam: "Spam",
  waiting_for_driver: "Waiting for Driver",
  posted_to_load_board: "Posted to Load Board",
  driver_assigned: "Driver Assigned",
  in_transit: "In Transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  new_lead: "bg-blue-50 text-blue-700",
  quoted: "bg-indigo-50 text-indigo-700",
  booked: "bg-emerald-50 text-emerald-700",
  standby: "bg-amber-50 text-amber-700",
  callback: "bg-sky-50 text-sky-700",
  lost: "bg-rose-50 text-rose-700",
  spam: "bg-slate-100 text-slate-500",
  waiting_for_driver: "bg-amber-50 text-amber-700",
  posted_to_load_board: "bg-violet-50 text-violet-700",
  driver_assigned: "bg-cyan-50 text-cyan-700",
  in_transit: "bg-sky-50 text-sky-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-rose-50 text-rose-700",
};

// ---------------------------------------------------------------------------
// Tracking number — the attribution layer.
//
// Each phone number on an ad / GMB / website maps to one row. When a call
// comes in via Twilio, the webhook looks up which number was dialed and
// tags the call with its source automatically. No guessing.
// ---------------------------------------------------------------------------

export type SourceChannel = "paid" | "organic" | "direct" | "referral";

export interface TrackingNumber {
  id: UUID;
  phone_number: string;
  label: string;
  source: string;        // "google_ads" | "gbp" | "website" | "facebook" | ...
  channel: SourceChannel;
  campaign: string | null;
  active: boolean;
  created_at: ISOTimestamp;
}

// ---------------------------------------------------------------------------
// Call — the true top of the funnel.
//
// Dad's 5 call outcomes:
//   booked   — creates lead + job, sends confirmation
//   standby  — creates lead + proposal, fires SMS with accept link
//   lost     — tags reason, preserves transcript/quote
//   callback — schedules reminder
//   spam     — excluded from analytics
// ---------------------------------------------------------------------------

export type CallDisposition = "booked" | "standby" | "lost" | "callback" | "spam";

export const CALL_DISPOSITIONS: CallDisposition[] = [
  "booked", "standby", "lost", "callback", "spam",
];

export const LOST_REASONS = [
  "Too expensive",
  "No truck available",
  "Outside service area",
  "Shopping around",
  "Bad fit",
] as const;

export type LostReason = (typeof LOST_REASONS)[number];

export interface TranscriptChunk {
  speaker: "caller" | "dispatcher";
  text: string;
  at: ISOTimestamp;
}

export interface Call {
  id: UUID;
  caller_phone: string | null;
  source: string | null;
  tracking_number: string | null;
  tracking_number_id: UUID | null;
  started_at: ISOTimestamp | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  transcript_chunks: TranscriptChunk[] | null;
  converted_to_job: boolean | null;
  lead_id: UUID | null;
  proposal_id: UUID | null;
  notes: string | null;
  disposition: CallDisposition | null;
  lost_reason: string | null;
  callback_at: ISOTimestamp | null;
  dispatcher: string | null;
  quoted_price: number | null;
  ai_summary: string | null;
  created_at: ISOTimestamp;
}

// ---------------------------------------------------------------------------
// Lead
// ---------------------------------------------------------------------------

export interface Lead {
  id: UUID;
  created_at: ISOTimestamp;
  customer: string | null;
  phone: string | null;
  service: string | null;
  city: string | null;
  source: string | null;
  booked: boolean | null;
  price: number | null;
  notes: string | null;
  proposal_id: UUID | null;
  call_id: UUID | null;
}

// ---------------------------------------------------------------------------
// Proposal — the standby/follow-up system.
//
// Customer gets an SMS link to /proposal/[token] with quote, ETA, and a
// big Accept button. accepted_at = legal proof of agreement.
// ---------------------------------------------------------------------------

export type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "expired" | "cancelled";

export interface Proposal {
  id: UUID;
  lead_id: UUID | null;
  call_id: UUID | null;
  token: string;

  service_type: string | null;
  quoted_price: number | null;
  eta_min: number | null;
  eta_max: number | null;
  driver_area: string | null;
  route_summary: string | null;
  vehicle_desc: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  notes: string | null;

  sent_at: ISOTimestamp | null;
  viewed_at: ISOTimestamp | null;
  accepted_at: ISOTimestamp | null;
  expired_at: ISOTimestamp | null;

  status: ProposalStatus;
  created_at: ISOTimestamp;
}

// ---------------------------------------------------------------------------
// Job — an operational unit a dispatcher works. Tied to a lead optionally.
// ---------------------------------------------------------------------------

export interface Job {
  id: UUID;
  lead_id: UUID | null;
  created_at: ISOTimestamp;
  status: JobStatus;

  // Customer-facing
  customer: string | null;
  phone: string | null;

  // Transport details (vehicle transport / towing)
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_running: boolean | null;

  pickup_address: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_zip: string | null;

  dropoff_address: string | null;
  dropoff_city: string | null;
  dropoff_state: string | null;
  dropoff_zip: string | null;

  distance_miles: number | null;
  price: number | null;
  driver_pay: number | null;
  notes: string | null;

  // Per-job override on the auto-computed total (hookup + miles*per_mile).
  // Drivers can add/subtract here with a short note.
  adjustment: number | null;
  adjustment_note: string | null;

  // Actual amount collected from the customer (vs `price` which may be the
  // quoted/calculated total). Used for revenue reporting + reconciliation.
  paid_amount: number | null;

  driver_id: UUID | null;
  scheduled_for: ISOTimestamp | null;
  completed_at: ISOTimestamp | null;
}

// ---------------------------------------------------------------------------
// Marketing metric — a single row in a time-series metric stream.
// Used for charts, daily snapshots, campaign rollups, etc.
// ---------------------------------------------------------------------------

export interface MarketingMetric {
  date: ISODate;
  channel: string; // "google_ads" | "facebook" | "seo" | ...
  campaign: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  revenue: number;
}

// ---------------------------------------------------------------------------
// Dispatch post — a job posted to an external load board (Central Dispatch,
// uShip, etc). Designed to be provider-agnostic; each provider plugs in via
// its own adapter in lib/loadBoard.ts.
// ---------------------------------------------------------------------------

export type LoadBoardProvider = "central_dispatch" | "uship" | "internal" | "other";

export type DispatchPostStatus =
  | "draft"
  | "posted"
  | "accepted"
  | "withdrawn"
  | "expired"
  | "error";

export interface DispatchPost {
  id: UUID;
  job_id: UUID;
  provider: LoadBoardProvider;
  provider_post_id: string | null;
  status: DispatchPostStatus;
  posted_at: ISOTimestamp | null;
  price_offered: number | null;
  driver_pay: number | null;
  notes: string | null;
  // Raw provider payload for debugging / re-sync. Kept loose on purpose.
  raw: Record<string, unknown> | null;
}
