import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getTwilioClient, twilioNumber, getCachedTwilioBalance } from "@/lib/twilio";
import { logError } from "@/lib/errorLog";

async function fetchTwilioBalance(): Promise<number | null> {
  const bal = await getCachedTwilioBalance();
  return bal ? bal.balance : null;
}

// ---------------------------------------------------------------------------
// Health Check Cron — runs every 5 min via Vercel Cron.
//
// Checks:
//   1. Calls stuck in "Transcribing…" / "Analyzing call…" for > 5 min
//   2. Unresolved error_log entries in the last hour above noise threshold
//
// If anything trips, SMS the owner. Cooldown: 30 min per alert type so we
// don't spam during an ongoing incident.
// ---------------------------------------------------------------------------

const OWNER_CELL = process.env.SMS_FORWARD_NUMBER || "+15033888741";
const ALERT_COOLDOWN_MIN = 30;
const STUCK_CALL_THRESHOLD_MIN = 5;
const ERROR_NOISE_THRESHOLD = 3; // unresolved errors/hour before alerting
const TWILIO_LOW_BALANCE_USD = 5; // alert when account balance drops below this

export async function GET(req: NextRequest) {
  // Vercel Cron calls with a signed header. In dev/manual hits, allow CRON_SECRET bearer.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    const isVercelCron = req.headers.get("x-vercel-cron");
    if (!isVercelCron && auth !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const fiveMinAgo = new Date(Date.now() - STUCK_CALL_THRESHOLD_MIN * 60_000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const cooldownAgo = new Date(Date.now() - ALERT_COOLDOWN_MIN * 60_000).toISOString();

  const [{ data: stuck }, { data: recentErrors }, { data: recentAlerts }, twilioBalance] = await Promise.all([
    supabase
      .from("calls")
      .select("id, caller_phone, ai_summary, created_at")
      .in("ai_summary", ["Transcribing…", "Analyzing call…"])
      .lt("created_at", fiveMinAgo)
      .limit(10),
    supabase
      .from("error_log")
      .select("id, source, message")
      .eq("resolved", false)
      .gte("created_at", oneHourAgo)
      .neq("source", "health_alert"),
    supabase
      .from("error_log")
      .select("id, source")
      .eq("source", "health_alert")
      .gte("created_at", cooldownAgo)
      .limit(1),
    fetchTwilioBalance(),
  ]);

  const problems: string[] = [];
  if (stuck && stuck.length > 0) {
    problems.push(`${stuck.length} call${stuck.length === 1 ? "" : "s"} stuck in transcription >${STUCK_CALL_THRESHOLD_MIN}m`);
  }
  if (recentErrors && recentErrors.length >= ERROR_NOISE_THRESHOLD) {
    const bySource = recentErrors.reduce<Record<string, number>>((acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(bySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s, n]) => `${s}:${n}`)
      .join(", ");
    problems.push(`${recentErrors.length} unresolved errors/hr (${top})`);
  }
  if (twilioBalance !== null && twilioBalance < TWILIO_LOW_BALANCE_USD) {
    problems.push(`Twilio balance $${twilioBalance.toFixed(2)} — add funds`);
  }

  // Nothing wrong OR still in cooldown from a previous alert
  if (problems.length === 0) {
    return NextResponse.json({ ok: true, status: "healthy", checked_at: new Date().toISOString() });
  }
  if (recentAlerts && recentAlerts.length > 0) {
    return NextResponse.json({ ok: true, status: "alerting_cooldown", problems });
  }

  // Send the SMS
  const smsBody = `⚠️ ACT Dispatch health:\n${problems.map((p) => `- ${p}`).join("\n")}\n\nCheck /errors for details.`;

  try {
    await getTwilioClient().messages.create({
      to: OWNER_CELL,
      from: twilioNumber,
      body: smsBody,
    });

    // Log this alert so the 30-min cooldown kicks in
    await logError("health_alert", smsBody, { problems }, "warning");

    return NextResponse.json({ ok: true, status: "alerted", problems });
  } catch (err) {
    await logError("cron", "Failed to send health alert SMS", { err: String(err), problems });
    return NextResponse.json({ ok: false, error: "SMS failed" }, { status: 500 });
  }
}
