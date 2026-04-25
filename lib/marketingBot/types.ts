// Canonical shape returned by the marketing bot. Kept in its own file so
// both server (analyze.ts) and client (BotReport.tsx) can import without
// pulling server-only deps.

export interface BotBusinessContext {
  service_area: string;
  hours: string;
  target_cpa: number;
  avg_job_value: number;
  services: string[];
  excluded: string[];
  baseline_calls_per_day: number;
  tracking_map: Record<string, string>; // tracking number -> campaign
}

export interface BotSummary {
  total_spend: number;
  total_calls: number;
  cpa: number;
  vs_target_cpa_pct: number;
  top_3_wins: string[];
  top_3_problems: string[];
}

export interface WastedSpendItem {
  search_term: string;
  spend: number;
  clicks: number;
  calls: number;
  reason: string;
  priority: "high" | "med" | "low";
}

export interface NegativeKeyword {
  term: string;
  match_type: "exact" | "phrase" | "broad";
  scope: "campaign" | "ad_group" | "account";
  reason: string;
}

export interface ScaleItem {
  keyword: string;
  match_type: string;
  current_cpa: number;
  suggested_bid_change_pct: number;
  reason: string;
}

export interface PauseItem {
  keyword: string;
  match_type: string;
  spend: number;
  calls: number;
  reason: string;
}

export interface RestructureItem {
  action: "split_ad_group" | "tighten_match_type" | "merge" | "new_ad_group";
  detail: string;
  affected_keywords: string[];
  reason: string;
}

export interface AdCopyItem {
  current_headline: string;
  issue: string;
  suggested_headline: string;
  max_30_chars: boolean;
  reason: string;
}

export interface BottleneckItem {
  stage: "impression" | "click" | "call";
  metric: string;
  value: number;
  benchmark: number;
  diagnosis: string;
}

export interface BidAdjustmentItem {
  dimension: "device" | "location" | "hour" | "day";
  segment: string;
  change_pct: number;
  reason: string;
}

export interface BotReport {
  summary: BotSummary;
  wasted_spend: WastedSpendItem[];
  negatives_to_add: NegativeKeyword[];
  scale: ScaleItem[];
  pause: PauseItem[];
  restructure: RestructureItem[];
  ad_copy: AdCopyItem[];
  bottlenecks: BottleneckItem[];
  bid_adjustments: BidAdjustmentItem[];
}

export interface BotErrorResponse {
  error: "missing_column" | "invalid_json" | "upstream_error";
  detail: string;
}

export type BotResponse =
  | { ok: true; report: BotReport; meta: { model: string; ms: number } }
  | { ok: false; error: BotErrorResponse };
