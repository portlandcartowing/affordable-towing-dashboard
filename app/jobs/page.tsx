import Topbar from "@/components/dashboard/Topbar";
import KpiCard from "@/components/dashboard/KpiCard";
import JobsTable from "@/components/jobs/JobsTable";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { getJobs, summarizeJobs } from "@/lib/jobsQueries";

export const revalidate = 15;

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function JobsPage() {
  const jobs = await getJobs(100);
  const metrics = summarizeJobs(jobs);

  return (
    <>
      <Topbar title="Jobs" subtitle="Active dispatch queue" />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard title="Scheduled" value={metrics.scheduled.toString()} icon="◷" />
          <KpiCard title="In Progress" value={metrics.inProgress.toString()} icon="⟳" />
          <KpiCard
            title="Completed Today"
            value={metrics.completedToday.toString()}
            trend={metrics.completedToday > 0 ? "up" : "neutral"}
            icon="✓"
          />
          <KpiCard title="Avg Ticket" value={money(metrics.avgTicket)} icon="$" />
        </section>

        <section>
          <SectionHeader title="Job Queue" />
          <JobsTable jobs={jobs} />
        </section>
      </main>
    </>
  );
}
