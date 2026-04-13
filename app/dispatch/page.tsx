import Topbar from "@/components/dashboard/Topbar";
import JobStatusBadge from "@/components/dispatch/JobStatusBadge";
import JobCard from "@/components/dispatch/JobCard";
import { JOB_STATUSES, type Job, type JobStatus } from "@/lib/types";
import { AVAILABLE_PROVIDERS } from "@/lib/loadBoard";

export const dynamic = "force-dynamic";

// Placeholder data — real jobs will be fetched from Supabase once the
// `jobs` table exists. Shape matches the Job interface in lib/types.ts.
const SAMPLE_JOBS: Job[] = [];

export default async function DispatchPage() {
  const jobs = SAMPLE_JOBS;

  const byStatus = JOB_STATUSES.reduce<Record<JobStatus, Job[]>>((acc, s) => {
    acc[s] = jobs.filter((j) => j.status === s);
    return acc;
  }, {} as Record<JobStatus, Job[]>);

  const postable: JobStatus[] = ["booked", "waiting_for_driver", "posted_to_load_board"];

  return (
    <>
      <Topbar title="Dispatch" subtitle="Manage jobs and load board postings" />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        {/* Status summary strip — quick glance for dispatchers */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Pipeline
          </h3>
          <div className="flex flex-wrap gap-2">
            {JOB_STATUSES.map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <JobStatusBadge status={s} />
                <span className="text-xs text-slate-500">{byStatus[s].length}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Load board providers */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Load Board Providers</h3>
            <span className="text-[10px] uppercase text-slate-400">Structure only</span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AVAILABLE_PROVIDERS.map((p) => (
              <li
                key={p.value}
                className="flex items-center justify-between p-3 border border-slate-100 rounded-xl"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">{p.label}</div>
                  <div className="text-xs text-slate-400">{p.value}</div>
                </div>
                <span className="text-[11px] font-medium text-slate-400">Not connected</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Adapters live in <code>lib/loadBoard.ts</code>. Register a new provider with{" "}
            <code>registerAdapter()</code> once its API client is built.
          </p>
        </section>

        {/* Jobs ready to post */}
        <section>
          <h2 className="text-xs md:text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Jobs Ready to Post
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.filter((j) => postable.includes(j.status)).length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                No jobs yet. Convert a booked lead into a job to see it here.
              </div>
            ) : (
              jobs
                .filter((j) => postable.includes(j.status))
                .map((job) => <JobCard key={job.id} job={job} onPost={() => {}} />)
            )}
          </div>
        </section>
      </main>
    </>
  );
}
