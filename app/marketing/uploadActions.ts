"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

/**
 * Parse and import a Google Ads CSV export into the ad_spend_daily table.
 *
 * Expected CSV columns (flexible — matches common Google Ads exports):
 *   Date (or Day), Campaign, Cost, Clicks, Conversions, Impressions
 *
 * The parser is lenient: it matches column headers case-insensitively
 * and handles quoted values, dollar signs, commas in numbers, etc.
 */
export async function uploadGoogleAdsCsv(formData: FormData) {
  const file = formData.get("csv") as File | null;
  if (!file) return { ok: false, error: "No file provided", imported: 0 };

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { ok: false, error: "CSV has no data rows", imported: 0 };

  // Parse header — find column indices
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  const dateIdx = headers.findIndex((h) => h === "date" || h === "day" || h === "report date");
  const campaignIdx = headers.findIndex((h) => h === "campaign" || h === "campaign name");
  const costIdx = headers.findIndex((h) => h === "cost" || h === "spend" || h === "amount spent");
  const clicksIdx = headers.findIndex((h) => h === "clicks");
  const convIdx = headers.findIndex((h) => h.includes("conversion") || h === "conv." || h === "conv");

  if (dateIdx === -1) return { ok: false, error: "No 'Date' column found in CSV header", imported: 0 };
  if (campaignIdx === -1) return { ok: false, error: "No 'Campaign' column found in CSV header", imported: 0 };
  if (costIdx === -1) return { ok: false, error: "No 'Cost' column found in CSV header", imported: 0 };

  // Parse data rows
  const rows: {
    date: string;
    campaign: string;
    cost: number;
    clicks: number;
    conversions: number;
  }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);

    const dateRaw = cols[dateIdx]?.trim();
    const campaign = cols[campaignIdx]?.trim();
    const costRaw = cols[costIdx]?.trim();

    if (!dateRaw || !campaign || !costRaw) continue;

    // Skip total/summary rows
    if (campaign.toLowerCase() === "total" || campaign.toLowerCase().startsWith("--")) continue;

    const date = normalizeDate(dateRaw);
    if (!date) continue;

    const cost = parseNumber(costRaw);
    const clicks = clicksIdx >= 0 ? parseNumber(cols[clicksIdx]) : 0;
    const conversions = convIdx >= 0 ? parseNumber(cols[convIdx]) : 0;

    rows.push({ date, campaign, cost, clicks, conversions });
  }

  if (rows.length === 0) return { ok: false, error: "No valid data rows found", imported: 0 };

  // Upsert into ad_spend_daily (unique on date + campaign)
  const { error } = await supabase
    .from("ad_spend_daily")
    .upsert(
      rows.map((r) => ({
        date: r.date,
        campaign: r.campaign,
        cost: r.cost,
        clicks: r.clicks,
        conversions: r.conversions,
      })),
      { onConflict: "date,campaign" },
    );

  if (error) return { ok: false, error: error.message, imported: 0 };

  revalidatePath("/marketing");
  revalidatePath("/dashboard");
  return { ok: true, imported: rows.length };
}

// --- Helpers ---

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseNumber(raw: string | undefined): number {
  if (!raw) return 0;
  // Remove $, commas, whitespace
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function normalizeDate(raw: string): string | null {
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Try MM/DD/YYYY or M/D/YYYY
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try "Mon DD, YYYY" (e.g., "Apr 19, 2026")
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const textMatch = raw.match(/^([a-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (textMatch) {
    const [, mon, d, y] = textMatch;
    const m = monthNames[mon.toLowerCase()];
    if (m) return `${y}-${m}-${d.padStart(2, "0")}`;
  }

  return null;
}
