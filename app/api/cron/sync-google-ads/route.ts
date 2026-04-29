import { NextRequest, NextResponse } from "next/server";
import { lastNDaysRange, syncGoogleAdsSpend } from "@/lib/googleAds";
import { logError } from "@/lib/errorLog";

// ---------------------------------------------------------------------------
// Google Ads spend sync cron — runs nightly via Vercel Cron.
// Pulls the last 7 days so late conversions/cost adjustments are captured,
// and upserts on (date, campaign).
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    const isVercelCron = req.headers.get("x-vercel-cron");
    if (!isVercelCron && auth !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const range = lastNDaysRange(7);
  const result = await syncGoogleAdsSpend(range);

  if (!result.ok) {
    await logError("cron", "Google Ads sync failed", { error: result.error, range });
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json({ ...result, range });
}
