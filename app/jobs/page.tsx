import Topbar from "@/components/dashboard/Topbar";
import KpiCard from "@/components/dashboard/KpiCard";
import JobCard from "@/components/dispatch/JobCard";
import JobStatusBadge from "@/components/dispatch/JobStatusBadge";
import EmptyState from "@/components/dashboard/EmptyState";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { getJobs, summarizeJobs } from "@/lib/jobsQueries";

export const dynamic = "force-dynamic";

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

          {jobs.length === 0 ? (
            <EmptyState
              icon="✦"
              title="No jobs yet"
              description="Convert a booked lead into a job to see it in the dispatch queue."
            />
          ) : (
            <>
              {/* Mobile — card grid */}
              <div className="md:hidden grid grid-cols-1 gap-3">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>

              {/* Desktop — table */}
              <div className="hidden md:block bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-left px-4 py-3">Customer</th>
                        <th className="text-left px-4 py-3">Vehicle</th>
                        <th className="text-left px-4 py-3">Pickup</th>
                        <th className="text-left px-4 py-3">Dropoff</th>
                        <th className="text-right px-4 py-3">Miles</th>
                        <th className="text-right px-4 py-3">Price</th>
                        <th className="text-right px-4 py-3">Driver Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => {
                        const vehicle = [job.vehicle_year, job.vehicle_make, job.vehicle_model]
                          .filter(Boolean)
                          .join(" ");
                        const pickup = [job.pickup_city, job.pickup_state]
                          .filter(Boolean)
                          .join(", ");
                        const dropoff = [job.dropoff_city, job.dropoff_state]
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <JobStatusBadge status={job.status} />
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {job.customer || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{vehicle || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{pickup || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{dropoff || "—"}</td>
                            <td className="px-4 py-3 text-right text-slate-600">
                              {job.distance_miles ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-900">
                              {job.price != null ? money(job.price) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">
                              {job.driver_pay != null ? money(job.driver_pay) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
