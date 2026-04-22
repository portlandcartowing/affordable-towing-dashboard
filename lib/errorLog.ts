import { supabase } from "./supabase";

// ---------------------------------------------------------------------------
// Persistent error log — every failure we care about gets written to the
// error_log table, viewable on /errors. Health-check cron reads this to
// decide whether to SMS the owner.
// ---------------------------------------------------------------------------

export type ErrorSource =
  | "twilio_voice"
  | "twilio_sms"
  | "twilio_status"
  | "twilio_transcription"
  | "deepgram"
  | "anthropic"
  | "push_notify"
  | "sms_send"
  | "post_call"
  | "health_alert"
  | "daily_digest"
  | "cron"
  | "other";

export async function logError(
  source: ErrorSource,
  message: string,
  context?: Record<string, unknown>,
  severity: "error" | "warning" | "info" = "error",
): Promise<void> {
  try {
    await supabase.from("error_log").insert({
      source,
      severity,
      message: message.slice(0, 2000),
      context: context ?? null,
    });
  } catch {
    // Don't throw from the logger itself.
  }
}
