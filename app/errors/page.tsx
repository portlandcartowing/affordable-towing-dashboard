"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type ErrorRow = {
  id: string;
  created_at: string;
  source: string;
  severity: string;
  message: string;
  context: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const SEVERITY_STYLES: Record<string, string> = {
  error: "bg-rose-100 text-rose-700 ring-rose-200",
  warning: "bg-amber-100 text-amber-700 ring-amber-200",
  info: "bg-slate-100 text-slate-600 ring-slate-200",
};

const SOURCE_LABELS: Record<string, string> = {
  twilio_voice: "Voice",
  twilio_sms: "SMS",
  twilio_status: "Recording",
  twilio_transcription: "Transcript",
  deepgram: "Deepgram",
  anthropic: "Claude",
  push_notify: "Push",
  sms_send: "SMS Send",
  post_call: "Post-Call AI",
  health_alert: "Health Alert",
  daily_digest: "Daily Digest",
  cron: "Cron",
  other: "Other",
};

export default function ErrorsPage() {
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [filter, setFilter] = useState<"unresolved" | "all">("unresolved");
  const [loading, setLoading] = useState(true);

  const fetchErrors = useCallback(async () => {
    let query = supabase
      .from("error_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "unresolved") query = query.eq("resolved", false);
    const { data } = await query;
    setRows((data as ErrorRow[]) || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const markResolved = async (id: string) => {
    await supabase
      .from("error_log")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const unresolvedCount = rows.filter((r) => !r.resolved).length;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Error Log</h1>
          <p className="text-sm text-slate-500 mt-1">
            {filter === "unresolved"
              ? `${unresolvedCount} unresolved`
              : `Last ${rows.length} entries`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("unresolved")}
            className={`px-3 py-1.5 text-sm rounded-lg ring-1 transition-colors ${
              filter === "unresolved"
                ? "bg-blue-600 text-white ring-blue-600"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            Unresolved
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-sm rounded-lg ring-1 transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-white ring-blue-600"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          <button
            onClick={fetchErrors}
            className="px-3 py-1.5 text-sm rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-slate-700 font-semibold">All clear</div>
          <div className="text-sm text-slate-500 mt-1">
            {filter === "unresolved" ? "No unresolved errors." : "No errors logged yet."}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="bg-white rounded-xl ring-1 ring-slate-200/70 p-4 flex items-start gap-4"
            >
              <div className="flex flex-col gap-1.5 shrink-0">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ring-1 ${
                    SEVERITY_STYLES[row.severity] || SEVERITY_STYLES.info
                  }`}
                >
                  {row.severity}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {SOURCE_LABELS[row.source] || row.source}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-900 font-medium">{row.message}</div>
                {row.context && Object.keys(row.context).length > 0 && (
                  <pre className="text-[11px] text-slate-500 mt-2 bg-slate-50 rounded px-2 py-1.5 overflow-x-auto">
                    {JSON.stringify(row.context, null, 2)}
                  </pre>
                )}
                <div className="text-[11px] text-slate-400 mt-2">
                  {new Date(row.created_at).toLocaleString()}
                  {row.resolved && row.resolved_at && (
                    <span className="ml-2 text-emerald-600">
                      · resolved {new Date(row.resolved_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              {!row.resolved && (
                <button
                  onClick={() => markResolved(row.id)}
                  className="shrink-0 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
