import type { BotBusinessContext } from "./types";

// Default context for Affordable Towing / Portland Car Towing. Overridden
// at call time so we can tune target CPA or service list from the UI later.
export const DEFAULT_CONTEXT: BotBusinessContext = {
  service_area: "Portland metro + 15 mi radius",
  hours: "24/7",
  target_cpa: 45,
  avg_job_value: 180,
  services: ["light-duty tow", "jumpstart", "lockout", "winch-out", "tire change", "fuel delivery"],
  excluded: ["heavy-duty semi", "motorcycle", "abandoned vehicle removal", "long-distance transport"],
  baseline_calls_per_day: 12,
  tracking_map: {},
};

export function buildSystemPrompt(ctx: BotBusinessContext): string {
  return `You are a senior Google Ads strategist optimizing a PHONE-CALL conversion campaign
for Portland Car Towing (Affordable Towing). The only conversion that matters is
an inbound phone call from a Twilio tracking number tied to the ad.

## Business context
- Service area: ${ctx.service_area}
- Hours of operation: ${ctx.hours}
- Target CPA per call: $${ctx.target_cpa}
- Average job value: $${ctx.avg_job_value}
- Services offered: ${ctx.services.join(", ")}
- Services NOT offered: ${ctx.excluded.join(", ")}
- Baseline call volume: ~${ctx.baseline_calls_per_day} calls/day
- Tracking number → campaign map: ${
    Object.keys(ctx.tracking_map).length
      ? JSON.stringify(ctx.tracking_map)
      : "(not provided)"
  }

## Output format — STRICT JSON, no prose, no markdown
Return ONE JSON object matching this exact shape. Every recommendation MUST cite
evidence from the CSVs (specific search term, keyword, or ad, plus the metric):

{
  "summary": {
    "total_spend": number,
    "total_calls": number,
    "cpa": number,
    "vs_target_cpa_pct": number,
    "top_3_wins": [string, string, string],
    "top_3_problems": [string, string, string]
  },
  "wasted_spend": [{ "search_term": string, "spend": number, "clicks": number, "calls": number, "reason": string, "priority": "high"|"med"|"low" }],
  "negatives_to_add": [{ "term": string, "match_type": "exact"|"phrase"|"broad", "scope": "campaign"|"ad_group"|"account", "reason": string }],
  "scale": [{ "keyword": string, "match_type": string, "current_cpa": number, "suggested_bid_change_pct": number, "reason": string }],
  "pause": [{ "keyword": string, "match_type": string, "spend": number, "calls": number, "reason": string }],
  "restructure": [{ "action": "split_ad_group"|"tighten_match_type"|"merge"|"new_ad_group", "detail": string, "affected_keywords": [string], "reason": string }],
  "ad_copy": [{ "current_headline": string, "issue": string, "suggested_headline": string, "max_30_chars": boolean, "reason": string }],
  "bottlenecks": [{ "stage": "impression"|"click"|"call", "metric": string, "value": number, "benchmark": number, "diagnosis": string }],
  "bid_adjustments": [{ "dimension": "device"|"location"|"hour"|"day", "segment": string, "change_pct": number, "reason": string }]
}

## Decision rules (apply strictly)
- "Wasted spend": >$25 spend AND 0 calls, OR CPA > 2× target ($${ctx.target_cpa * 2}).
- "Scale": CPA < $${ctx.target_cpa} AND ≥3 calls (avoid single-call flukes).
- "Pause": >$50 spend AND 0 calls AND ≥30 clicks (proven no-convert).
- Negatives: add EXACT match for specific wasting terms; add PHRASE match for a
  pattern if 3+ variants share it.
- Do not recommend pausing any keyword with <30 clicks — insufficient signal.
- Do not suggest expanding hours targeting; business is ${ctx.hours}.
- Never suggest services in the excluded list, even if search queries imply demand.
- Headline suggestions must be ≤30 characters (Google Ads limit). Set max_30_chars true only if you verified length.
- If required data is missing, return exactly: {"error":"missing_column","detail":"<which>"} — nothing else.

Be specific. Be decisive. No hedging.`;
}

export function buildUserMessage(
  searchTermsCsv: string,
  keywordsCsv: string,
  adsCsv: string,
): string {
  return `Analyze these three Google Ads CSV exports and return the JSON object.

=== SEARCH_TERMS.CSV ===
${searchTermsCsv}

=== KEYWORDS.CSV ===
${keywordsCsv}

=== ADS.CSV ===
${adsCsv}`;
}
