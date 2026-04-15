import { parseTranscript } from "@/lib/transcriptParser";
import type { ExtractedFields, TranscriptChunk, Confidence } from "./types";

// ---------------------------------------------------------------------------
// Runs the deterministic parser in lib/transcriptParser.ts over the joined
// transcript text, then maps the result into the richer ExtractedFields
// shape the Call Center UI uses. Everything the parser extracts is tagged
// "medium" confidence; fields the parser couldn't find stay "needs_review".
//
// Existing extracted values from mock data are preserved unless the parser
// produces a new value — lets us merge AI enrichment on top without losing
// dispatcher-entered overrides.
// ---------------------------------------------------------------------------

function merge<T>(
  existing: { value: T | null; confidence: Confidence },
  next: T | null,
  conf: Confidence = "medium",
) {
  if (next != null && existing.value == null) {
    return { value: next, confidence: conf };
  }
  return existing;
}

export function deriveExtractedFields(
  transcript: TranscriptChunk[],
  current: ExtractedFields,
): ExtractedFields {
  if (transcript.length === 0) return current;

  const text = transcript.map((c) => c.text).join(" ");
  const parsed = parseTranscript(text);

  return {
    ...current,
    service_type: merge(current.service_type, parsed.service_type),
    pickup_address: merge(current.pickup_address, parsed.pickup_city),
    dropoff_address: merge(current.dropoff_address, parsed.dropoff_city),
    vehicle_make: merge(
      current.vehicle_make,
      parsed.vehicle?.split(" ").find((w) => /^[A-Z]/.test(w)) ?? null,
    ),
    vehicle_model: merge(
      current.vehicle_model,
      parsed.vehicle?.split(" ").slice(-1)[0] ?? null,
    ),
    vehicle_year: merge(
      current.vehicle_year,
      parsed.vehicle?.match(/\b(19|20)\d{2}\b/)?.[0] ?? null,
    ),
    urgency: merge(current.urgency, parsed.urgency),
    notes: merge(current.notes, parsed.summary),
  };
}
