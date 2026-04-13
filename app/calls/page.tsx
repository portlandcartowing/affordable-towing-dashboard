import Topbar from "@/components/dashboard/Topbar";
import KpiCard from "@/components/dashboard/KpiCard";
import SectionHeader from "@/components/dashboard/SectionHeader";
import CallsTable from "@/components/calls/CallsTable";
import { getCalls, summarizeCalls } from "@/lib/callTracking";
import { getLeadIdsWithJobs } from "@/lib/jobsQueries";
import { startOfToday, startOfWeek } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const [calls, leadIdsWithJobs] = await Promise.all([
    getCalls(100),
    getLeadIdsWithJobs(),
  ]);
  const summary = summarizeCalls(calls, startOfToday(), startOfWeek());
  const conversionRate =
    summary.today > 0 ? Math.round((summary.convertedToday / summary.today) * 100) : 0;

  return (
    <>
      <Topbar title="Calls" subtitle="Inbound call tracking and attribution" />
      <main className="flex-1 p-4 md:p-8 space-y-8">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard title="Calls Today" value={summary.today.toString()} icon="☎" accent="blue" />
          <KpiCard title="Calls This Week" value={summary.week.toString()} icon="◉" accent="indigo" />
          <KpiCard
            title="Converted Today"
            value={summary.convertedToday.toString()}
            trend={summary.convertedToday > 0 ? "up" : "neutral"}
            icon="✓"
            accent="emerald"
          />
          <KpiCard
            title="Conversion Rate"
            value={`${conversionRate}%`}
            trend={conversionRate > 30 ? "up" : "neutral"}
            icon="%"
            accent="violet"
          />
        </section>

        <section>
          <div className="flex items-end justify-between mb-3">
            <SectionHeader
              title="Recent Calls"
              subtitle={`${calls.length} tracked ${calls.length === 1 ? "call" : "calls"}`}
            />
          </div>
          <CallsTable calls={calls} leadIdsWithJobs={leadIdsWithJobs} />
        </section>
      </main>
    </>
  );
}
