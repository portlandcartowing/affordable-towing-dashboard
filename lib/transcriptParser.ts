// ---------------------------------------------------------------------------
// Transcript parser — deterministic, regex-based extraction from a call
// transcript. No AI, no external calls. Runs inside the createLeadFromCall
// server action, never on the render path.
//
// The goal is to cut dispatcher typing, not to be perfect. When a field
// cannot be confidently extracted we return null and let the dispatcher
// fill it in.
// ---------------------------------------------------------------------------

export type ServiceType =
  | "Tow"
  | "Jump Start"
  | "Lockout"
  | "Tire Change"
  | "Fuel Delivery"
  | "Winch Out"
  | "Long Distance Transport";

export type Urgency = "asap" | "scheduled" | null;

export interface ParsedTranscript {
  pickup_city: string | null;
  dropoff_city: string | null;
  service_type: ServiceType | null;
  vehicle: string | null;
  urgency: Urgency;
  summary: string | null;
}

// ---------------------------------------------------------------------------
// Service keywords. Order matters: "long distance" must be checked before
// "tow" so a long-haul transport isn't misclassified as a local tow.
// ---------------------------------------------------------------------------

const SERVICE_PATTERNS: { type: ServiceType; re: RegExp }[] = [
  { type: "Long Distance Transport", re: /\b(long[\s-]?distance|transport|cross[\s-]?country|interstate|ship(?:ping)?\s+(?:my|a)\s+(?:car|vehicle|truck))\b/i },
  { type: "Jump Start",              re: /\b(jump[\s-]?start|dead\s+battery|battery\s+(?:is\s+)?dead|boost)\b/i },
  { type: "Lockout",                 re: /\b(lock(?:ed)?\s+out|lockout|keys?\s+(?:are\s+)?(?:inside|locked|stuck))\b/i },
  { type: "Tire Change",             re: /\b(flat\s+tire|tire\s+(?:change|blown|popped)|spare\s+tire|blowout)\b/i },
  { type: "Fuel Delivery",           re: /\b(out\s+of\s+gas|ran\s+out\s+of\s+(?:gas|fuel)|fuel\s+delivery|need\s+gas)\b/i },
  { type: "Winch Out",               re: /\b(winch|stuck\s+in|pulled?\s+out\s+of|mud|ditch)\b/i },
  { type: "Tow",                     re: /\b(tow(?:ing)?|hauled|haul\s+(?:my|a)|pick\s+up\s+my\s+(?:car|vehicle|truck))\b/i },
];

function detectService(text: string): ServiceType | null {
  for (const { type, re } of SERVICE_PATTERNS) {
    if (re.test(text)) return type;
  }
  return null;
}

// ---------------------------------------------------------------------------
// City extraction. Looks for "from X to Y" first (handles pickup + dropoff
// in one shot), falling back to "in X" / "at X" / "to X" for single-city
// references. Cities are title-cased strings of 1–3 words.
// ---------------------------------------------------------------------------

const CITY_WORD = "[A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+){0,2}";
const FROM_TO_RE = new RegExp(`from\\s+(${CITY_WORD})\\s+to\\s+(${CITY_WORD})`, "i");
const IN_RE = new RegExp(`\\b(?:in|at|near|around)\\s+(${CITY_WORD})`, "i");
const TO_RE = new RegExp(`\\bto\\s+(${CITY_WORD})`, "i");

// Words that *look* like title-cased cities but aren't. Keeps the parser
// from stamping "Honda" or "I" as a pickup city.
const CITY_STOPWORDS = new Set([
  "I", "Im", "My", "A", "An", "The", "Honda", "Toyota", "Ford", "Chevy",
  "Chevrolet", "Nissan", "BMW", "Mercedes", "Dodge", "Ram", "Jeep", "GMC",
  "Hyundai", "Kia", "Subaru", "Mazda", "Lexus", "Audi", "Volkswagen", "VW",
  "Tesla", "Acura", "Infiniti", "Cadillac", "Buick", "Lincoln", "Volvo",
  "Mitsubishi", "Porsche", "Civic", "Accord", "Camry", "Corolla", "Mustang",
  "Silverado", "Sierra", "Tacoma", "Tundra", "Explorer", "Escape", "Rav4",
]);

function cleanCity(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/[.,!?]$/, "");
  const first = trimmed.split(/\s+/)[0];
  if (CITY_STOPWORDS.has(first)) return null;
  return trimmed;
}

function detectCities(text: string): { pickup: string | null; dropoff: string | null } {
  const fromTo = text.match(FROM_TO_RE);
  if (fromTo) {
    return { pickup: cleanCity(fromTo[1]), dropoff: cleanCity(fromTo[2]) };
  }
  const inMatch = text.match(IN_RE);
  if (inMatch) {
    return { pickup: cleanCity(inMatch[1]), dropoff: null };
  }
  const toMatch = text.match(TO_RE);
  if (toMatch) {
    return { pickup: null, dropoff: cleanCity(toMatch[1]) };
  }
  return { pickup: null, dropoff: null };
}

// ---------------------------------------------------------------------------
// Vehicle extraction. Looks for "<year> <make> <model>" or "<make> <model>"
// against a known make list. Kept tight to avoid grabbing random capitalized
// words.
// ---------------------------------------------------------------------------

const MAKES = [
  "Honda", "Toyota", "Ford", "Chevy", "Chevrolet", "Nissan", "BMW", "Mercedes",
  "Dodge", "Ram", "Jeep", "GMC", "Hyundai", "Kia", "Subaru", "Mazda", "Lexus",
  "Audi", "Volkswagen", "VW", "Tesla", "Acura", "Infiniti", "Cadillac", "Buick",
  "Lincoln", "Volvo", "Mitsubishi", "Porsche",
];
const MAKE_RE = new RegExp(
  `\\b(?:(19|20)\\d{2}\\s+)?(${MAKES.join("|")})(?:\\s+([A-Z0-9][a-zA-Z0-9-]+))?`,
  "i",
);

function detectVehicle(text: string): string | null {
  const m = text.match(MAKE_RE);
  if (!m) return null;
  const year = m[0].match(/\b(19|20)\d{2}\b/)?.[0];
  const make = m[2];
  const model = m[3];
  return [year, make, model].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Urgency — any "right now" style phrase flips to asap, scheduled phrases
// flip the other way. Default null.
// ---------------------------------------------------------------------------

function detectUrgency(text: string): Urgency {
  if (/\b(asap|right\s+now|immediately|urgent|emergency|stuck|stranded)\b/i.test(text)) {
    return "asap";
  }
  if (/\b(tomorrow|next\s+(?:day|week)|later|scheduled|appointment|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text)) {
    return "scheduled";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Summary. Compose a short, readable note from the extracted fields so the
// dispatcher can see what was picked up at a glance. Falls back to the first
// sentence of the transcript when no structured data was extracted.
// ---------------------------------------------------------------------------

function buildSummary(
  parsed: Omit<ParsedTranscript, "summary">,
  transcript: string,
): string | null {
  const parts: string[] = [];
  if (parsed.vehicle) parts.push(parsed.vehicle);
  if (parsed.pickup_city && parsed.dropoff_city) {
    parts.push(`${parsed.pickup_city} to ${parsed.dropoff_city}`);
  } else if (parsed.pickup_city) {
    parts.push(`in ${parsed.pickup_city}`);
  } else if (parsed.dropoff_city) {
    parts.push(`to ${parsed.dropoff_city}`);
  }
  if (parsed.urgency === "asap") parts.push("ASAP");

  if (parts.length > 0) return parts.join(" · ");

  // Fallback: first sentence of the transcript, trimmed.
  const firstSentence = transcript.split(/[.!?]/)[0]?.trim();
  if (firstSentence && firstSentence.length > 0) {
    return firstSentence.length > 160
      ? firstSentence.slice(0, 160).trim() + "…"
      : firstSentence;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function parseTranscript(transcript: string | null | undefined): ParsedTranscript {
  if (!transcript || transcript.trim().length === 0) {
    return {
      pickup_city: null,
      dropoff_city: null,
      service_type: null,
      vehicle: null,
      urgency: null,
      summary: null,
    };
  }

  const { pickup, dropoff } = detectCities(transcript);
  const partial = {
    pickup_city: pickup,
    dropoff_city: dropoff,
    service_type: detectService(transcript),
    vehicle: detectVehicle(transcript),
    urgency: detectUrgency(transcript),
  };

  return {
    ...partial,
    summary: buildSummary(partial, transcript),
  };
}
