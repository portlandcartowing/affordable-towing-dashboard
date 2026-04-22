import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getTwilioClient, twilioNumber } from "@/lib/twilio";
import { logError } from "@/lib/errorLog";

// ---------------------------------------------------------------------------
// Daily Digest Cron — fires once/day at 15:00 UTC (8am PDT / 7am PST).
//
// Pulls yesterday's numbers and SMSes the owner a short summary.
// ---------------------------------------------------------------------------

const OWNER_CELL = process.env.SMS_FORWARD_NUMBER || "+15033888741";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    const isVercelCron = req.headers.get("x-vercel-cron");
    if (!isVercelCron && auth !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  // "Yesterday" = 24h window ending at midnight Pacific. Approximate with UTC.
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(7, 0, 0, 0); // 7:00 UTC ≈ midnight PT
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60_000);
  const startISO = startOfYesterday.toISOString();
  const endISO = startOfToday.toISOString();

  const [
    { data: calls },
    { data: jobs },
    { data: messages },
    { data: errors },
  ] = await Promise.all([
    supabase
      .from("calls")
      .select("id, disposition, quoted_price")
      .gte("created_at", startISO)
      .lt("created_at", endISO),
    supabase
      .from("jobs")
      .select("id, status, price")
      .gte("created_at", startISO)
      .lt("created_at", endISO),
    supabase
      .from("messages")
      .select("id, direction")
      .gte("created_at", startISO)
      .lt("created_at", endISO),
    supabase
      .from("error_log")
      .select("id, source")
      .eq("resolved", false)
      .gte("created_at", startISO)
      .lt("created_at", endISO)
      .neq("source", "health_alert"),
  ]);

  const callsCount = calls?.length ?? 0;
  const booked = calls?.filter((c) => c.disposition === "booked") ?? [];
  const lost = calls?.filter((c) => c.disposition === "lost") ?? [];
  const standby = calls?.filter((c) => c.disposition === "standby") ?? [];
  const bookedRev = booked.reduce((sum, c) => sum + Number(c.quoted_price || 0), 0);

  const jobsCount = jobs?.length ?? 0;
  const completed = jobs?.filter((j) => j.status === "completed") ?? [];
  const completedRev = completed.reduce((sum, j) => sum + Number(j.price || 0), 0);
  const avgTicket = completed.length > 0 ? Math.round(completedRev / completed.length) : 0;

  const msgCount = messages?.length ?? 0;
  const errCount = errors?.length ?? 0;

  const dateStr = startOfYesterday.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });

  const body = `ACT Dispatch · ${dateStr}
📞 ${callsCount} calls · ${booked.length} booked ($${bookedRev}) · ${lost.length} lost · ${standby.length} standby
🚚 ${jobsCount} jobs · ${completed.length} done · avg $${avgTicket}
💬 ${msgCount} SMS
${errCount > 0 ? `⚠️ ${errCount} unresolved errors — check /errors` : "✅ No errors"}`;

  try {
    await getTwilioClient().messages.create({
      to: OWNER_CELL,
      from: twilioNumber,
      body,
    });
    return NextResponse.json({ ok: true, sent: true, body });
  } catch (err) {
    await logError("cron", "Failed to send daily digest SMS", { err: String(err) });
    return NextResponse.json({ ok: false, error: "SMS failed" }, { status: 500 });
  }
}
