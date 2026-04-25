"use client";

import { useCallback, useEffect, useState } from "react";

type ServiceStatus = "healthy" | "warning" | "critical" | "unknown";

type HealthData = {
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
    twilio: { status: ServiceStatus; balance: number | null; currency: string; detail: string };
    transcription: {
      status: ServiceStatus; recent_failures: number; stuck_count: number; detail: string;
    };
    errors: { status: ServiceStatus; unresolved: number; detail: string };
  };
  alerts: Array<{ severity: "critical" | "warning" | "info"; title: string; message: string }>;
  checked_at: string;
};

const STATUS_STYLES: Record<ServiceStatus, { dot: string; text: string; bg: string; ring: string }> = {
  healthy: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200" },
  warning: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" },
  critical: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200" },
  unknown: { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", ring: "ring-slate-200" },
};

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const resp = await fetch("/api/health/status", { cache: "no-store" });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const json = (await resp.json()) as HealthData;
      setData(json);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 60_000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  if (loading && !data) {
    return <div className="p-6 text-sm text-slate-400">Loading health status…</div>;
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-xl p-4 text-sm text-rose-700">
          Could not fetch health: {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const digestDate = new Date(data.digest.date).toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });
  const overallStatus: ServiceStatus =
    data.alerts.some((a) => a.severity === "critical") ? "critical"
    : data.alerts.some((a) => a.severity === "warning") ? "warning"
    : "healthy";

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Health</h1>
          <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${STATUS_STYLES[overallStatus].dot}`} />
            <span className={STATUS_STYLES[overallStatus].text}>
              {overallStatus === "healthy" ? "All systems operational" : overallStatus === "warning" ? "Minor issues" : "Action required"}
            </span>
            <span className="text-slate-300">·</span>
            <span>Last checked {new Date(data.checked_at).toLocaleTimeString()}</span>
          </div>
        </div>
        <button
          onClick={fetchHealth}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-3 py-1.5 rounded-lg ring-1 ring-slate-200"
        >
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((a, i) => {
            const styles = a.severity === "critical" ? STATUS_STYLES.critical : a.severity === "warning" ? STATUS_STYLES.warning : STATUS_STYLES.unknown;
            return (
              <div key={i} className={`${styles.bg} ring-1 ${styles.ring} rounded-xl p-4`}>
                <div className={`text-sm font-bold ${styles.text}`}>
                  {a.severity === "critical" ? "🚨 " : "⚠️ "}{a.title}
                </div>
                <div className="text-sm text-slate-700 mt-1">{a.message}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Yesterday's Digest */}
      <section>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Yesterday · {digestDate}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Calls" value={data.digest.calls} sublabel={`${data.digest.booked} booked`} />
          <Kpi label="Revenue" value={`$${data.digest.bookedRevenue}`} sublabel={`$${data.digest.avgTicket} avg`} accent="emerald" />
          <Kpi label="Jobs Done" value={data.digest.jobsCompleted} sublabel={`${data.digest.jobsCreated} created`} />
          <Kpi label="Messages" value={data.digest.messages} sublabel={data.digest.errors > 0 ? `${data.digest.errors} errors` : "No errors"} accent={data.digest.errors > 0 ? "rose" : undefined} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <MiniStat label="Booked" value={data.digest.booked} color="text-emerald-600" />
          <MiniStat label="Lost" value={data.digest.lost} color="text-rose-600" />
          <MiniStat label="Standby" value={data.digest.standby} color="text-amber-600" />
        </div>
      </section>

      {/* Today (running) */}
      <section>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Today (so far)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Calls" value={data.today.calls} sublabel={`${data.today.booked} booked`} />
          <Kpi label="Jobs Done" value={data.today.jobsCompleted} />
          <Kpi label="Revenue" value={`$${data.today.revenue}`} accent="emerald" />
          <Kpi label="Live" value="●" sublabel="updating every 60s" />
        </div>
      </section>

      {/* System status */}
      <section>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">System Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <StatusCard name="Supabase" service={data.system.supabase.status} detail={data.system.supabase.detail} icon="🗄️" />
          <StatusCard
            name="Twilio"
            service={data.system.twilio.status}
            detail={data.system.twilio.detail}
            icon="📞"
            cta={data.system.twilio.status !== "healthy" ? { label: "Add funds", href: "https://console.twilio.com/us1/billing/manage-billing/billing-overview" } : undefined}
          />
          <StatusCard name="Transcription" service={data.system.transcription.status} detail={data.system.transcription.detail} icon="📝" />
          <StatusCard
            name="Error Log"
            service={data.system.errors.status}
            detail={data.system.errors.detail}
            icon="⚠️"
            cta={data.system.errors.unresolved > 0 ? { label: "View errors", href: "/errors" } : undefined}
          />
        </div>
      </section>

      {/* Diagnostics */}
      <section>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Diagnostics</h2>
        <DiagnosticsPanel />
      </section>
    </div>
  );
}

function DiagnosticsPanel() {
  const [busy, setBusy] = useState<"call" | "msg" | null>(null);
  const [result, setResult] = useState<{ kind: "call" | "msg"; ok: boolean; detail: string } | null>(null);

  const fire = async (kind: "call" | "msg") => {
    if (busy) return;
    setBusy(kind);
    setResult(null);
    try {
      const body =
        kind === "call"
          ? {
              type: "incoming_call",
              caller_phone: "+15035551234",
              source: "test",
              call_id: `test-${Date.now()}`,
            }
          : {
              type: "message",
              caller_phone: "+15035551234",
              source: "sms",
              body: "Test message from /health diagnostics",
              call_id: null,
            };
      const resp = await fetch("/api/push/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (resp.ok && json.ok) {
        const sent = json.sent || {};
        const ticketErr = json.expoError ? ` · ticket: ${json.expoError}` : "";
        const receiptErr = json.expoReceiptError ? ` · receipt: ${json.expoReceiptError}` : "";
        setResult({
          kind,
          ok: !json.expoError && !json.expoReceiptError,
          detail: `Sent · web: ${sent.web ?? 0}, expo: ${sent.expo ?? 0}${ticketErr}${receiptErr}`,
        });
      } else {
        setResult({ kind, ok: false, detail: json.error || `HTTP ${resp.status}` });
      }
    } catch (err) {
      setResult({ kind, ok: false, detail: String(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 p-4 shadow-sm">
      <div className="text-sm text-slate-600 mb-3">
        Fires a real push to every available driver&apos;s registered device. Tests the
        push pipeline end-to-end without needing a real call or SMS.
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => fire("call")}
          disabled={!!busy}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy === "call" ? "Sending…" : "🔔 Test incoming call push"}
        </button>
        <button
          onClick={() => fire("msg")}
          disabled={!!busy}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy === "msg" ? "Sending…" : "💬 Test message push"}
        </button>
      </div>
      {result && (
        <div
          className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium ${
            result.ok
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
          }`}
        >
          {result.ok ? "✓" : "✗"} {result.kind === "call" ? "Incoming call" : "Message"}: {result.detail}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sublabel, accent }: {
  label: string; value: string | number; sublabel?: string;
  accent?: "emerald" | "rose";
}) {
  const valueColor = accent === "emerald" ? "text-emerald-600" : accent === "rose" ? "text-rose-600" : "text-slate-900";
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${valueColor}`}>{value}</div>
      {sublabel && <div className="text-xs text-slate-500 mt-1">{sublabel}</div>}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200/70 px-4 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function StatusCard({ name, service, detail, icon, cta }: {
  name: string; service: ServiceStatus; detail: string; icon: string;
  cta?: { label: string; href: string };
}) {
  const s = STATUS_STYLES[service];
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 p-4 flex items-center gap-4">
      <div className="text-2xl shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
          <span className="text-sm font-semibold text-slate-900">{name}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wide ${s.text}`}>
            {service}
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-1 truncate">{detail}</div>
      </div>
      {cta && (
        <a
          href={cta.href}
          target={cta.href.startsWith("http") ? "_blank" : undefined}
          rel={cta.href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg"
        >
          {cta.label} →
        </a>
      )}
    </div>
  );
}
