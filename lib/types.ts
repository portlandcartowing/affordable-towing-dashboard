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
  waiting_for_driver: "bg-amber-50 text-amber-700",
  posted_to_load_board: "bg-violet-50 text-violet-700",
  driver_assigned: "bg-cyan-50 text-cyan-700",
  in_transit: "bg-sky-50 text-sky-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-rose-50 text-rose-700",
};

// ---------------------------------------------------------------------------
// Call — the true top of the funnel for a local towing business.
//
// Every billable job starts with a phone call, but the driver often does not
// know which ad, tracking number, or channel generated it. This type is the
// shared contract between the Calls UI, the queries layer, and (eventually)
// a telephony provider integration (CallRail / Twilio / etc).
//
// Expected Supabase `calls` table columns:
//   id                 uuid primary key default gen_random_uuid()
//   caller_phone       text
//   source             text           -- "google_ads" | "facebook" | "organic" | ...
//   tracking_number    text           -- the forwarding number that was dialed
//   started_at         timestamptz
//   duration_seconds   integer
//   recording_url      text
//   transcript         text
//   converted_to_job   boolean default false
//   lead_id            uuid references leads(id)
//   notes              text
//   created_at         timestamptz default now()
// ---------------------------------------------------------------------------

export interface Call {
  id: UUID;
  caller_phone: string | null;
  source: string | null;
  tracking_number: string | null;
  started_at: ISOTimestamp | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  converted_to_job: boolean | null;
  lead_id: UUID | null;
  notes: string | null;
  created_at: ISOTimestamp;
}

// ---------------------------------------------------------------------------
// Lead — the top of the funnel. A lead can become a Job once we commit to it.
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

  driver_id: UUID | null;
  scheduled_for: ISOTimestamp | null;
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
