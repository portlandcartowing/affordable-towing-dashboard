"use client";

import type { BotReport } from "@/lib/marketingBot/types";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

const priorityColor = {
  high: "bg-rose-100 text-rose-700",
  med: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
} as const;

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="p-5 text-sm text-slate-400">Nothing flagged.</div>
      ) : (
        <div className="divide-y divide-slate-100">{children}</div>
      )}
    </div>
  );
}

export default function BotReportView({ report }: { report: BotReport }) {
  const s = report.summary;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Bot Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Kpi label="Total Spend" value={money(s.total_spend)} />
          <Kpi label="Total Calls" value={s.total_calls.toString()} />
          <Kpi label="CPA" value={money(s.cpa)} />
          <Kpi
            label="vs Target CPA"
            value={pct(s.vs_target_cpa_pct)}
            tone={s.vs_target_cpa_pct <= 0 ? "good" : "bad"}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
              Top Wins
            </div>
            <ul className="space-y-1 text-slate-700">
              {s.top_3_wins.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-1">
              Top Problems
            </div>
            <ul className="space-y-1 text-slate-700">
              {s.top_3_problems.map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Wasted spend */}
      <Section title="Wasted Spend" count={report.wasted_spend.length}>
        {report.wasted_spend.map((w, i) => (
          <div key={i} className="p-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <code className="text-sm font-mono text-slate-900 truncate">{w.search_term}</code>
                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${priorityColor[w.priority]}`}>
                  {w.priority}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {money(w.spend)} spent · {w.clicks} clicks · {w.calls} calls
              </div>
              <div className="text-sm text-slate-700 mt-1">{w.reason}</div>
            </div>
          </div>
        ))}
      </Section>

      {/* Negatives */}
      <Section title="Negative Keywords to Add" count={report.negatives_to_add.length}>
        {report.negatives_to_add.map((n, i) => (
          <div key={i} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-sm font-mono text-slate-900">{n.term}</code>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {n.match_type}
              </span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                {n.scope}
              </span>
            </div>
            <div className="text-sm text-slate-700">{n.reason}</div>
          </div>
        ))}
      </Section>

      {/* Scale */}
      <Section title="Scale These Keywords" count={report.scale.length}>
        {report.scale.map((k, i) => (
          <div key={i} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-sm font-mono text-slate-900">{k.keyword}</code>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {k.match_type}
              </span>
              <span className="text-xs text-emerald-700 font-semibold">
                bid {pct(k.suggested_bid_change_pct)}
              </span>
            </div>
            <div className="text-xs text-slate-500">Current CPA: {money(k.current_cpa)}</div>
            <div className="text-sm text-slate-700 mt-1">{k.reason}</div>
          </div>
        ))}
      </Section>

      {/* Pause */}
      <Section title="Pause These Keywords" count={report.pause.length}>
        {report.pause.map((k, i) => (
          <div key={i} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-sm font-mono text-slate-900">{k.keyword}</code>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {k.match_type}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              {money(k.spend)} spent · {k.calls} calls
            </div>
            <div className="text-sm text-slate-700 mt-1">{k.reason}</div>
          </div>
        ))}
      </Section>

      {/* Restructure */}
      <Section title="Restructure Recommendations" count={report.restructure.length}>
        {report.restructure.map((r, i) => (
          <div key={i} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                {r.action.replace(/_/g, " ")}
              </span>
            </div>
            <div className="text-sm font-medium text-slate-900">{r.detail}</div>
            {r.affected_keywords.length > 0 && (
              <div className="text-xs text-slate-500 mt-1 font-mono">
                {r.affected_keywords.join(", ")}
              </div>
            )}
            <div className="text-sm text-slate-700 mt-1">{r.reason}</div>
          </div>
        ))}
      </Section>

      {/* Ad copy */}
      <Section title="Ad Copy Improvements" count={report.ad_copy.length}>
        {report.ad_copy.map((a, i) => (
          <div key={i} className="p-4">
            <div className="text-xs text-slate-500 mb-1">Current</div>
            <div className="text-sm text-slate-600 line-through">{a.current_headline}</div>
            <div className="text-xs text-slate-500 mt-2 mb-1">Suggested</div>
            <div className="text-sm font-semibold text-slate-900">{a.suggested_headline}</div>
            {!a.max_30_chars && (
              <div className="text-[11px] text-amber-700 mt-1">
                ⚠ Not verified ≤30 chars
              </div>
            )}
            <div className="text-xs text-slate-500 mt-2">Issue: {a.issue}</div>
            <div className="text-sm text-slate-700 mt-1">{a.reason}</div>
          </div>
        ))}
      </Section>

      {/* Bottlenecks */}
      <Section title="Conversion Bottlenecks" count={report.bottlenecks.length}>
        {report.bottlenecks.map((b, i) => (
          <div key={i} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {b.stage}
              </span>
              <span className="text-sm font-medium text-slate-900">{b.metric}</span>
              <span className="text-xs text-slate-500">
                {b.value} vs {b.benchmark} benchmark
              </span>
            </div>
            <div className="text-sm text-slate-700">{b.diagnosis}</div>
          </div>
        ))}
      </Section>

      {/* Bid adjustments */}
      <Section title="Bid Adjustments" count={report.bid_adjustments.length}>
        {report.bid_adjustments.map((b, i) => (
          <div key={i} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {b.dimension}
              </span>
              <span className="text-sm font-medium text-slate-900">{b.segment}</span>
              <span
                className={`text-xs font-semibold ${
                  b.change_pct >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {pct(b.change_pct)}
              </span>
            </div>
            <div className="text-sm text-slate-700">{b.reason}</div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const color =
    tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
