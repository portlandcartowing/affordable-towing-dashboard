import type { Call } from "@/lib/types";
import type { CallCenterCall, CallCenterStatus, TranscriptChunk } from "./types";
import { emptyExtractedFields } from "./types";
import { deriveExtractedFields } from "./extract";

// ---------------------------------------------------------------------------
// Maps a Supabase `calls` row into the richer CallCenterCall shape that
// the dispatcher workspace UI expects. Real calls don't have mock-only
// fields like scripted_remaining or copilot, so we derive what we can
// from the transcript and leave the rest as sensible defaults.
// ---------------------------------------------------------------------------

function mapStatus(call: Call): CallCenterStatus {
  if (!call.disposition) {
    // No disposition yet — infer from state
    if (call.duration_seconds === 0 || call.duration_seconds === null) {
      return "new_call";
    }
    return "live";
  }

  const map: Record<string, CallCenterStatus> = {
    booked: "booked",
    standby: "quoted",
    lost: "lost",
    callback: "callback",
    spam: "completed",
  };
  return map[call.disposition] ?? "live";
}

function parseTranscriptChunks(call: Call): TranscriptChunk[] {
  // Prefer structured chunks if available
  const raw = call.transcript_chunks as unknown;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((chunk: Record<string, string>, i: number) => ({
      id: `chunk-${i}`,
      speaker: chunk.speaker === "caller" ? "caller" as const : "dispatcher" as const,
      text: chunk.text || "",
      at: chunk.at || call.created_at,
    }));
  }

  // Fall back to plain text transcript — split by line
  if (call.transcript) {
    return call.transcript.split("\n").filter(Boolean).map((line, i) => {
      const isCallerLine = /^(Caller|Customer):/i.test(line);
      return {
        id: `line-${i}`,
        speaker: isCallerLine ? "caller" as const : "dispatcher" as const,
        text: line.replace(/^(Caller|Customer|Dispatcher):\s*/i, ""),
        at: call.started_at || call.created_at,
      };
    });
  }

  return [];
}

export function mapCallToCallCenter(call: Call): CallCenterCall {
  const chunks = parseTranscriptChunks(call);
  const extracted = deriveExtractedFields(chunks, emptyExtractedFields());

  // Pre-fill extracted fields from call data where available
  if (call.caller_phone) {
    extracted.callback_phone = { value: call.caller_phone, confidence: "high" };
  }
  if (call.quoted_price != null) {
    extracted.quoted_price = { value: call.quoted_price, confidence: "high" };
  }
  if (call.disposition === "booked") {
    extracted.booked = { value: true, confidence: "high" };
  }

  return {
    id: call.id,
    caller_phone: call.caller_phone || "Unknown",
    source: call.source || "unknown",
    started_at: call.started_at || call.created_at,
    duration_seconds: call.duration_seconds || 0,
    status: mapStatus(call),
    dispatcher: call.dispatcher || null,

    transcript: chunks,
    scripted_remaining: [],

    extracted,
    copilot: [],
    ai_summary: call.ai_summary || null,

    quote_base: call.quoted_price || 95,
    quote_mileage: 0,
    quote_non_runner: false,
    quote_after_hours: false,
    final_quote: call.quoted_price || null,

    notes: call.notes || "",
    lost_reason: call.lost_reason || null,
    callback_at: call.callback_at || null,
  };
}
