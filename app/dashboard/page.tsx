import Topbar from "@/components/dashboard/Topbar";
import KpiCard from "@/components/dashboard/KpiCard";
import SectionHeader from "@/components/dashboard/SectionHeader";
import Link from "next/link";
import {
  getLeadsSince,
  summarizeLeads,
  startOfToday,
  startOfWeek,
} from "@/lib/queries";
import { getCalls, summarizeCalls } from "@/lib/callTracking";
import {
  getAdSpend,
  lastNDaysRange,
  sumAdSpend,
  summarizeCampaigns,
} from "@/lib/googleAds";

// Cache the rendered page for 15s so sidebar navigation is instant.
// Server actions call revalidatePath("/dashboard") after mutations, which
// busts this cache immediately — the UI never shows stale data after a write.
export const revalidate = 15;

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money2 = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function DashboardPage() {
  const todayStartIso = startOfToday();
  const weekStartIso = startOfWeek();
  const weekRange = lastNDaysRange(7);

  // Three parallel round-trips — previously this page made ~10.
  const [weekLeads, calls, adSpendRows] = await Promise.all([
    getLeadsSince(weekStartIso),
    getCalls(200),
    getAdSpend(weekRange),
  ]);

  // In-memory derivation — zero extra Supabase calls.
  const todayLeadsRows = weekLeads.filter((l) => l.created_at >= todayStartIso);
  const todayLeads = summarizeLeads(todayLeadsRows);
  const weekLeadsSummary = summarizeLeads(weekLeads);
  const callsSummary = summarizeCalls(calls, todayStartIso, weekStartIso);
  const todayAdRows = adSpendRows.filter((r) => r.date === new Date().toISOString().slice(0, 10));
  const adSpendToday = sumAdSpend(todayAdRows);
  const adSpendWeek = sumAdSpend(adSpendRows);
  const campaigns = summarizeCampaigns(adSpendRows);
  const topCampaign = [...campaigns].sort((a, b) => b.cost - a.cost)[0];
  const recentLeads = weekLeads.slice(0, 5);

  const callDenominator = callsSummary.today > 0 ? callsSummary.today : todayLeads.count;
  const costPerCall = callDenominator > 0 ? adSpendToday / callDenominator : 0;
  const costPerJob = todayLeads.booked > 0 ? adSpendToday / todayLeads.booked : 0;
  const roi = adSpendToday > 0 ? ((todayLeads.revenue - adSpendToday) / adSpendToday) * 100 : 0;

  return (
    <>
      <Topbar title="Dashboard" subtitle="Today's snapshot" />
      <main className="flex-1 p-4 md:p-8 space-y-10">
        {/* ---------------- TODAY ---------------- */}
        <section>
          <SectionHeader title="Today" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <KpiCard
              title="Calls Today"
              value={callsSummary.today.toString()}
              delta={`${callsSummary.week} this week`}
              icon="☎"
              accent="blue"
              href="/calls"
            />
            <KpiCard
              title="Leads"
              value={todayLeads.count.toString()}
              delta={`${todayLeads.count} new`}
              icon="◉"
              accent="indigo"
              href="/leads"
            />
            <KpiCard
              title="Jobs Booked"
              value={todayLeads.booked.toString()}
              delta={`${todayLeads.count > 0 ? Math.round((todayLeads.booked / todayLeads.count) * 100) : 0}% conv.`}
              trend={todayLeads.booked > 0 ? "up" : "neutral"}
              icon="✓"
              accent="emerald"
              href="/jobs"
            />
            <KpiCard
              title="Revenue"
              value={money(todayLeads.revenue)}
              trend={todayLeads.revenue > 0 ? "up" : "neutral"}
              icon="▲"
              accent="emerald"
              href="/jobs"
            />
            <KpiCard title="Ad Spend" value={money(adSpendToday)} icon="$" accent="amber" href="/marketing" />
            <KpiCard
              title="ROI"
              value={`${roi.toFixed(0)}%`}
              trend={roi >= 300 ? "up" : roi < 0 ? "down" : "neutral"}
              icon="%"
              accent="violet"
              href="/marketing"
            />
          </div>
        </section>

        {/* ---------------- EFFICIENCY ---------------- */}
        <section>
          <SectionHeader title="Efficiency" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <KpiCard
              title="Cost / Call"
              value={money2(costPerCall)}
              delta="Target $25"
              trend={costPerCall > 0 && costPerCall < 25 ? "up" : "neutral"}
              icon="◎"
              accent="blue"
              href="/marketing"
            />
            <KpiCard
              title="Cost / Job"
              value={money2(costPerJob)}
              delta="Target $75"
              trend={costPerJob > 0 && costPerJob < 75 ? "up" : "neutral"}
              icon="◆"
              accent="indigo"
              href="/jobs"
            />
            <KpiCard
              title="Calls This Week"
              value={callsSummary.week.toString()}
              icon="◉"
              accent="slate"
              href="/calls"
            />
          </div>
        </section>

        {/* ---------------- THIS WEEK ---------------- */}
        <section>
          <SectionHeader title="This Week" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <KpiCard title="Leads (7d)" value={weekLeadsSummary.count.toString()} icon="◉" accent="indigo" href="/leads" />
            <KpiCard
              title="Booked (7d)"
              value={weekLeadsSummary.booked.toString()}
              trend={weekLeadsSummary.booked > 0 ? "up" : "neutral"}
              icon="✓"
              accent="emerald"
              href="/jobs"
            />
            <KpiCard title="Revenue (7d)" value={money(weekLeadsSummary.revenue)} icon="▲" accent="emerald" href="/jobs" />
            <KpiCard title="Ad Spend (7d)" value={money(adSpendWeek)} icon="$" accent="amber" href="/marketing" />
          </div>
        </section>

        {/* ---------------- MARKETING SNAPSHOT ---------------- */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Marketing Snapshot</h3>
              <Link href="/marketing" className="text-xs text-blue-600 font-medium hover:underline">
                View all →
              </Link>
            </div>
            {campaigns.length === 0 ? (
              <div className="text-sm text-slate-400 py-8 text-center">No campaign data yet.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {campaigns.slice(0, 4).map((c) => (
                  <li key={c.campaign} className="flex items-center justify-between py-3 text-sm gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{c.campaign}</div>
                      <div className="text-xs text-slate-500">
                        {c.clicks.toLocaleString()} clicks · {c.conversions} conv.
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="font-semibold text-slate-900">{money2(c.cost)}</div>
                      <div className="text-xs text-slate-500">{money2(c.cpc)} CPC</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Top Channel (7d)</h3>
            {topCampaign ? (
              <>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">{topCampaign.campaign}</div>
                <div className="text-sm text-slate-500 mt-1">{money(topCampaign.cost)} spend</div>
                <div className="mt-4 space-y-1.5 text-sm tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Clicks</span>
                    <span className="font-medium">{topCampaign.clicks.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Conversions</span>
                    <span className="font-medium">{topCampaign.conversions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CPA</span>
                    <span className="font-medium">{money2(topCampaign.cpa)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-400 py-8 text-center">No data yet.</div>
            )}
          </div>
        </section>

        {/* ---------------- RECENT LEADS ---------------- */}
        <section className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Recent Leads</h3>
            <Link href="/leads" className="text-xs text-blue-600 font-medium hover:underline">
              View all →
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <div className="text-sm text-slate-400 py-10 text-center">No leads yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentLeads.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href="/leads"
                    className="flex items-center justify-between px-5 py-3 gap-3 text-sm hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900 truncate">
                        {lead.customer || "Unknown"}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {lead.service || "—"} · {lead.city || "—"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-500">{timeAgo(lead.created_at)}</div>
                      <div
                        className={`text-xs font-medium mt-0.5 ${
                          lead.booked ? "text-emerald-600" : "text-slate-400"
                        }`}
                      >
                        {lead.booked ? "Booked" : "New"}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
