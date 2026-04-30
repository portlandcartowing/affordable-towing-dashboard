import { supabaseAdmin as supabase } from "./supabaseAdmin";

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
// Google Ads API → ad_spend_daily sync
// ---------------------------------------------------------------------------

import { GoogleAdsApi } from "google-ads-api";

function getCustomer() {
  const {
    GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_REFRESH_TOKEN,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    GOOGLE_ADS_CUSTOMER_ID,
  } = process.env;

  if (
    !GOOGLE_ADS_CLIENT_ID ||
    !GOOGLE_ADS_CLIENT_SECRET ||
    !GOOGLE_ADS_DEVELOPER_TOKEN ||
    !GOOGLE_ADS_REFRESH_TOKEN ||
    !GOOGLE_ADS_CUSTOMER_ID
  ) {
    throw new Error("Missing GOOGLE_ADS_* env vars");
  }

  const client = new GoogleAdsApi({
    client_id: GOOGLE_ADS_CLIENT_ID,
    client_secret: GOOGLE_ADS_CLIENT_SECRET,
    developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  return client.Customer({
    customer_id: GOOGLE_ADS_CUSTOMER_ID,
    login_customer_id: GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
  });
}

export async function syncGoogleAdsSpend(range: DateRange): Promise<{ ok: boolean; synced: number; error?: string }> {
  try {
    const customer = getCustomer();

    const query = `
      SELECT
        segments.date,
        campaign.name,
        metrics.cost_micros,
        metrics.clicks,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${range.from}' AND '${range.to}'
    `;

    const rows = await customer.query(query);

    const aggregated = new Map<string, { date: string; campaign: string; cost: number; clicks: number; conversions: number }>();
    for (const r of rows) {
      const date = r.segments?.date as string;
      const campaign = (r.campaign?.name as string) || "(unknown)";
      const costMicros = Number(r.metrics?.cost_micros ?? 0);
      const clicks = Number(r.metrics?.clicks ?? 0);
      const conversions = Number(r.metrics?.conversions ?? 0);
      if (!date) continue;
      const key = `${date}|${campaign}`;
      const existing = aggregated.get(key) ?? { date, campaign, cost: 0, clicks: 0, conversions: 0 };
      existing.cost += costMicros / 1_000_000;
      existing.clicks += clicks;
      existing.conversions += conversions;
      aggregated.set(key, existing);
    }

    const upsertRows = Array.from(aggregated.values()).map((r) => ({
      ...r,
      cost: Math.round(r.cost * 100) / 100,
      conversions: Math.round(r.conversions),
    }));

    if (upsertRows.length === 0) return { ok: true, synced: 0 };

    const { error } = await supabase
      .from("ad_spend_daily")
      .upsert(upsertRows, { onConflict: "date,campaign" });

    if (error) return { ok: false, synced: 0, error: error.message };
    return { ok: true, synced: upsertRows.length };
  } catch (err) {
    let errorMsg: string;
    if (err instanceof Error) {
      errorMsg = err.message;
    } else if (err && typeof err === "object") {
      try {
        errorMsg = JSON.stringify(err, Object.getOwnPropertyNames(err));
      } catch {
        errorMsg = String(err);
      }
    } else {
      errorMsg = String(err);
    }
    return { ok: false, synced: 0, error: errorMsg };
  }
}
