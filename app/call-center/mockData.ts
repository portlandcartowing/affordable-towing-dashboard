import type { CallCenterCall } from "./types";

// ---------------------------------------------------------------------------
// Empty initial state. Real calls will come from Supabase once Twilio
// webhooks are wired up. This file remains as the fallback for when the
// queue is empty.
// ---------------------------------------------------------------------------

export const MOCK_CALLS: CallCenterCall[] = [];
