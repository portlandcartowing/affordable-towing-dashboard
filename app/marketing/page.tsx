import Topbar from "@/components/dashboard/Topbar";
import KpiCard from "@/components/dashboard/KpiCard";
import DateRangePicker from "@/components/marketing/DateRangePicker";
import CampaignTable from "@/components/marketing/CampaignTable";
import CsvUpload from "@/components/marketing/CsvUpload";
import {
  getAdSpend,
  summarizeCampaigns,
  lastNDaysRange,
  type DateRange,
} from "@/lib/googleAds";

export const revalidate = 30;

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function parseRange(searchParams: { from?: string; to?: string; days?: string }): DateRange {
  if (searchParams.from && searchParams.to) {
    return { from: searchParams.from, to: searchParams.to };
  }
  const days = Number(searchParams.days) || 7;
  return lastNDaysRange(days);
}

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; days?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params);

  const rows = await getAdSpend(range);
  const campaigns = summarizeCampaigns(rows);

  const totalSpend = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const totalClicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  const totalConv = rows.reduce((s, r) => s + (Number(r.conversions) || 0), 0);
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const convRate = totalClicks > 0 ? (totalConv / totalClicks) * 100 : 0;

  return (
    <>
      <Topbar title="Marketing" />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
              Google Ads Performance
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {range.from} → {range.to}
            </p>
          </div>
          <DateRangePicker range={range} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Spend" value={money(totalSpend)} icon="$" />
          <KpiCard title="Clicks" value={totalClicks.toLocaleString()} icon="◉" />
          <KpiCard
            title="Conversion Rate"
            value={`${convRate.toFixed(1)}%`}
            icon="%"
            trend={convRate > 0 ? "up" : "neutral"}
          />
          <KpiCard title="Avg CPC" value={money(avgCpc)} icon="◎" />
        </div>

        <CsvUpload />

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-b-slate-100">
            <h3 className="font-semibold text-slate-900">Campaign Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Campaign</th>
                  <th className="text-right px-5 py-3">Cost</th>
                  <th className="text-right px-5 py-3">Clicks</th>
                  <th className="text-right px-5 py-3">Conversions</th>
                  <th className="text-right px-5 py-3">CPC</th>
                  <th className="text-right px-5 py-3">CPA</th>
                </tr>
              </thead>
              <CampaignTable campaigns={campaigns} dailyRows={rows} />
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-b-slate-100">
            <h3 className="font-semibold text-slate-900">Daily Spend</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-5 py-3">Campaign</th>
                  <th className="text-right px-5 py-3">Cost</th>
                  <th className="text-right px-5 py-3">Clicks</th>
                  <th className="text-right px-5 py-3">Conversions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                      No spend records for this range.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-t border-t-slate-100">
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{r.date}</td>
                      <td className="px-5 py-3 font-medium text-slate-900">{r.campaign}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{money(r.cost)}</td>
                      <td className="px-5 py-3 text-right text-slate-600">
                        {r.clicks.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">{r.conversions}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
