import { supabase } from "./supabase";

export type AdSpendRow = {
  id: string;
  date: string;
  campaign: string;
  cost: number;
  clicks: number;
  conversions: number;
};

export type DateRange = {
  from: string;
  to: string;
};

export function todayRange(): DateRange {
  const d = new Date();
  const iso = d.toISOString().slice(0, 10);
  return { from: iso, to: iso };
}

export function lastNDaysRange(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export async function getAdSpend(range: DateRange): Promise<AdSpendRow[]> {
  const { data, error } = await supabase
    .from("ad_spend_daily")
    .select("*")
    .gte("date", range.from)
    .lte("date", range.to)
    .order("date", { ascending: false });
  if (error || !data) return [];
  return data as AdSpendRow[];
}

export function sumAdSpend(rows: AdSpendRow[]): number {
  return rows.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
}

/** @deprecated Prefer `sumAdSpend(await getAdSpend(range))` so the 7d row set
 *  can be reused for both total and campaign breakdown. Kept for callers that
 *  only need the number. */
export async function getAdSpendTotal(range: DateRange): Promise<number> {
  return sumAdSpend(await getAdSpend(range));
}

export type CampaignSummary = {
  campaign: string;
  cost: number;
  clicks: number;
  conversions: number;
  cpc: number;
  cpa: number;
};

/** Synchronous campaign rollup from an already-fetched row set. */
export function summarizeCampaigns(rows: AdSpendRow[]): CampaignSummary[] {
  const map = new Map<string, CampaignSummary>();

  for (const row of rows) {
    const existing = map.get(row.campaign) ?? {
      campaign: row.campaign,
      cost: 0,
      clicks: 0,
      conversions: 0,
      cpc: 0,
      cpa: 0,
    };
    existing.cost += Number(row.cost) || 0;
    existing.clicks += Number(row.clicks) || 0;
    existing.conversions += Number(row.conversions) || 0;
    map.set(row.campaign, existing);
  }

  return Array.from(map.values()).map((c) => ({
    ...c,
    cpc: c.clicks > 0 ? c.cost / c.clicks : 0,
    cpa: c.conversions > 0 ? c.cost / c.conversions : 0,
  }));
}

export async function getCampaignPerformance(range: DateRange): Promise<CampaignSummary[]> {
  return summarizeCampaigns(await getAdSpend(range));
}

// ---------------------------------------------------------------------------
// Google Ads API integration — STUB
// ---------------------------------------------------------------------------
// Real implementation will use google-ads-api / OAuth refresh token and
// upsert rows into the `ad_spend_daily` table. Not implemented yet.
// ---------------------------------------------------------------------------

export async function syncGoogleAdsSpend(_range: DateRange): Promise<{ ok: boolean; synced: number }> {
  // TODO: fetch from Google Ads API and upsert into ad_spend_daily
  return { ok: false, synced: 0 };
}
