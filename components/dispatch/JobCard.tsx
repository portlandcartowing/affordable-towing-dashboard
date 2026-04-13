import JobStatusBadge from "./JobStatusBadge";
import type { Job } from "@/lib/types";

export default function JobCard({
  job,
  onPost,
}: {
  job: Job;
  onPost?: () => void;
}) {
  const vehicle = [job.vehicle_year, job.vehicle_make, job.vehicle_model]
    .filter(Boolean)
    .join(" ");
  const pickup = [job.pickup_city, job.pickup_state].filter(Boolean).join(", ");
  const dropoff = [job.dropoff_city, job.dropoff_state].filter(Boolean).join(", ");

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">
            {vehicle || "Vehicle TBD"}
          </div>
          <div className="text-xs text-slate-500 truncate">{job.customer || "—"}</div>
        </div>
        <JobStatusBadge status={job.status} />
      </div>

      <div className="text-sm text-slate-600 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 shrink-0">◉</span>
          <span className="truncate">{pickup || "Pickup TBD"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 shrink-0">➤</span>
          <span className="truncate">{dropoff || "Dropoff TBD"}</span>
        </div>
        {job.distance_miles != null && (
          <div className="text-xs text-slate-500">{job.distance_miles} mi</div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div>
          <div className="text-[10px] uppercase text-slate-400">Price</div>
          <div className="font-semibold text-slate-900">
            {job.price != null ? `$${job.price.toFixed(0)}` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-400">Driver Pay</div>
          <div className="font-semibold text-slate-900">
            {job.driver_pay != null ? `$${job.driver_pay.toFixed(0)}` : "—"}
          </div>
        </div>
        {onPost && (
          <button
            onClick={onPost}
            className="text-xs font-medium px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Post to Board
          </button>
        )}
      </div>
    </div>
  );
}
