import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getTwilioClient } from "@/lib/twilio";

// ---------------------------------------------------------------------------
// Health status API — powers the /health dashboard page.
// Returns: yesterday's digest + today's running stats + system health + balances.
// Called by the dashboard (polled every 60s) and in principle by crons too.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

type ServiceStatus = "healthy" | "warning" | "critical" | "unknown";

type HealthSection = {
  digest: {
    date: string;
    calls: number;
    booked: number;
    lost: number;
    standby: number;
    bookedRevenue: number;
    jobsCreated: number;
    jobsCompleted: number;
    completedRevenue: number;
    avgTicket: number;
    messages: number;
    errors: number;
  };
  today: {
    calls: number;
    booked: number;
    jobsCompleted: number;
    revenue: number;
  };
  system: {
    supabase: { status: ServiceStatus; latency_ms: number | null; detail: string };
    twilio: {
      status: ServiceStatus;
      balance: number | null;
      currency: string;
      detail: string;
    };
    transcription: {
      status: ServiceStatus;
      recent_failures: number;
      stuck_count: number;
      detail: string;
    };
    errors: { status: ServiceStatus; unresolved: number; detail: string };
  };
  alerts: Array<{
    severity: "critical" | "warning" | "info";
    title: string;
    message: string;
  }>;
  checked_at: string;
};

export async function GET() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(7, 0, 0, 0); // ~midnight PT
  if (now < startOfToday) startOfToday.setUTCDate(startOfToday.getUTCDate() - 1);

  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60_000);
  const yStartISO = startOfYesterday.toISOString();
  const yEndISO = startOfToday.toISOString();
  const todayStartISO = startOfToday.toISOString();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60_000).toISOString();
  const oneHourAgo = new Date(now.getTime() - 60 * 60_000).toISOString();

  // ---- Yesterday's digest ----
  const supabaseStart = Date.now();
  const [
    { data: yCalls },
    { data: yJobs },
    { data: yMsgs },
    { data: yErrs },
    { data: tCalls },
    { data: tJobs },
    { data: recentFailedCalls },
    { data: stuckCalls },
    { data: unresolvedErrors },
  ] = await Promise.all([
    supabase.from("calls").select("id, disposition, quoted_price")
      .gte("created_at", yStartISO).lt("created_at", yEndISO),
    supabase.from("jobs").select("id, status, price")
      .gte("created_at", yStartISO).lt("created_at", yEndISO),
    supabase.from("messages").select("id")
      .gte("created_at", yStartISO).lt("created_at", yEndISO),
    supabase.from("error_log").select("id")
      .eq("resolved", false).gte("created_at", yStartISO).lt("created_at", yEndISO)
      .neq("source", "health_alert"),
    supabase.from("calls").select("id, disposition, quoted_price")
      .gte("created_at", todayStartISO),
    supabase.from("jobs").select("id, status, price")
      .gte("created_at", todayStartISO),
    supabase.from("calls").select("id")
      .or("ai_summary.like.Transcription failed%,ai_summary.like.Transcription error%")
      .gte("created_at", oneHourAgo),
    supabase.from("calls").select("id")
      .in("ai_summary", ["Transcribing…", "Analyzing call…"])
      .lt("created_at", fiveMinAgo),
    supabase.from("error_log").select("id, source")
      .eq("resolved", false).neq("source", "health_alert"),
  ]);
  const supabaseLatency = Date.now() - supabaseStart;

  const booked = yCalls?.filter((c) => c.disposition === "booked") ?? [];
  const lost = yCalls?.filter((c) => c.disposition === "lost") ?? [];
  const standby = yCalls?.filter((c) => c.disposition === "standby") ?? [];
  const bookedRev = booked.reduce((s, c) => s + Number(c.quoted_price || 0), 0);
  const completed = yJobs?.filter((j) => j.status === "completed") ?? [];
  const completedRev = completed.reduce((s, j) => s + Number(j.price || 0), 0);
  const avgTicket = completed.length > 0 ? Math.round(completedRev / completed.length) : 0;

  const tBooked = tCalls?.filter((c) => c.disposition === "booked") ?? [];
  const tCompleted = tJobs?.filter((j) => j.status === "completed") ?? [];
  const tRevenue = tCompleted.reduce((s, j) => s + Number(j.price || 0), 0);

  // ---- Twilio balance ----
  let twilioBalance: number | null = null;
  let twilioCurrency = "USD";
  let twilioStatus: ServiceStatus = "unknown";
  let twilioDetail = "Not checked";
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    if (sid) {
      const bal = await getTwilioClient().api.v2010.accounts(sid).balance.fetch();
      twilioBalance = parseFloat(bal.balance);
      twilioCurrency = bal.currency || "USD";
      if (twilioBalance < 5) {
        twilioStatus = "critical";
        twilioDetail = `Low balance: $${twilioBalance.toFixed(2)} — add funds soon`;
      } else if (twilioBalance < 20) {
        twilioStatus = "warning";
        twilioDetail = `Running low: $${twilioBalance.toFixed(2)}`;
      } else {
        twilioStatus = "healthy";
        twilioDetail = `Balance: $${twilioBalance.toFixed(2)}`;
      }
    }
  } catch (err) {
    twilioStatus = "warning";
    twilioDetail = `Could not fetch balance: ${String(err).slice(0, 80)}`;
  }

  // ---- Supabase status ----
  const supabaseStatus: ServiceStatus =
    supabaseLatency < 300 ? "healthy" : supabaseLatency < 1000 ? "warning" : "critical";
  const supabaseDetail = `${supabaseLatency}ms query latency`;

  // ---- Transcription status ----
  const failCount = recentFailedCalls?.length ?? 0;
  const stuckCount = stuckCalls?.length ?? 0;
  let transcriptionStatus: ServiceStatus = "healthy";
  let transcriptionDetail = "No recent issues";
  if (stuckCount > 0) {
    transcriptionStatus = "critical";
    transcriptionDetail = `${stuckCount} call${stuckCount === 1 ? "" : "s"} stuck >5min`;
  } else if (failCount >= 3) {
    transcriptionStatus = "warning";
    transcriptionDetail = `${failCount} failures in last hour`;
  } else if (failCount > 0) {
    transcriptionStatus = "healthy";
    transcriptionDetail = `${failCount} recent failure — recording still available`;
  }

  // ---- Errors status ----
  const errCount = unresolvedErrors?.length ?? 0;
  const errorsStatus: ServiceStatus =
    errCount >= 10 ? "critical" : errCount >= 3 ? "warning" : "healthy";
  const errorsDetail =
    errCount === 0 ? "No unresolved errors" : `${errCount} unresolved`;

  // ---- Top-level alerts ----
  const alerts: HealthSection["alerts"] = [];
  if (twilioStatus === "critical") {
    alerts.push({
      severity: "critical",
      title: "Twilio balance low",
      message: `$${twilioBalance?.toFixed(2) ?? "?"} remaining — outbound SMS and calls will start failing. Add funds at twilio.com/console.`,
    });
  } else if (twilioStatus === "warning") {
    alerts.push({
      severity: "warning",
      title: "Twilio balance dropping",
      message: `$${twilioBalance?.toFixed(2) ?? "?"} remaining — consider adding funds this week.`,
    });
  }
  if (stuckCount > 0) {
    alerts.push({
      severity: "critical",
      title: "Transcriptions stuck",
      message: `${stuckCount} call${stuckCount === 1 ? "" : "s"} in progress >5 min. Deepgram may be down.`,
    });
  }
  if (errCount >= 10) {
    alerts.push({
      severity: "critical",
      title: "Many unresolved errors",
      message: `${errCount} errors on the log — review /errors.`,
    });
  }
  if (supabaseStatus === "critical") {
    alerts.push({
      severity: "warning",
      title: "Supabase slow",
      message: `Query took ${supabaseLatency}ms. Dashboard may feel laggy.`,
    });
  }

  const payload: HealthSection = {
    digest: {
      date: startOfYesterday.toISOString(),
      calls: yCalls?.length ?? 0,
      booked: booked.length,
      lost: lost.length,
      standby: standby.length,
      bookedRevenue: bookedRev,
      jobsCreated: yJobs?.length ?? 0,
      jobsCompleted: completed.length,
      completedRevenue: completedRev,
      avgTicket,
      messages: yMsgs?.length ?? 0,
      errors: yErrs?.length ?? 0,
    },
    today: {
      calls: tCalls?.length ?? 0,
      booked: tBooked.length,
      jobsCompleted: tCompleted.length,
      revenue: tRevenue,
    },
    system: {
      supabase: { status: supabaseStatus, latency_ms: supabaseLatency, detail: supabaseDetail },
      twilio: {
        status: twilioStatus,
        balance: twilioBalance,
        currency: twilioCurrency,
        detail: twilioDetail,
      },
      transcription: {
        status: transcriptionStatus,
        recent_failures: failCount,
        stuck_count: stuckCount,
        detail: transcriptionDetail,
      },
      errors: { status: errorsStatus, unresolved: errCount, detail: errorsDetail },
    },
    alerts,
    checked_at: new Date().toISOString(),
  };

  return NextResponse.json(payload);
}
