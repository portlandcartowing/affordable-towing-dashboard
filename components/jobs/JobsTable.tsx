"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DeleteJobButton from "./DeleteJobButton";
import EditablePrice from "./EditablePrice";
import EmptyState from "@/components/dashboard/EmptyState";
import { updateJobStatus } from "@/app/jobs/jobActions";
import type { Job, JobStatus } from "@/lib/types";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function formatTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── Simplified status options — matches calls/leads ── */
const SIMPLE_STATUSES = [
  { value: "new_lead", label: "New Lead" },
  { value: "booked", label: "Booked" },
  { value: "standby", label: "Standby" },
  { value: "lost", label: "Lost" },
  { value: "callback", label: "Callback" },
  { value: "completed", label: "Completed" },
] as const;

// Map the full job statuses to the simplified set for display
function simplifyJobStatus(status: JobStatus): string {
  const map: Record<string, string> = {
    new_lead: "new_lead",
    quoted: "standby",
    booked: "booked",
    standby: "standby",
    callback: "callback",
    lost: "lost",
    spam: "lost",
    waiting_for_driver: "booked",
    posted_to_load_board: "booked",
    driver_assigned: "booked",
    in_transit: "booked",
    completed: "completed",
    cancelled: "lost",
  };
  return map[status] || "new_lead";
}

// Map simplified status back to job status for the DB — 1:1 now
function expandToJobStatus(simple: string): JobStatus {
  const map: Record<string, JobStatus> = {
    new_lead: "new_lead",
    booked: "booked",
    standby: "standby",
    lost: "lost",
    callback: "callback",
    completed: "completed",
  };
  return map[simple] || "new_lead";
}

function JobStatusChanger({ job, onChanged }: { job: Job; onChanged?: () => void }) {
  const [localValue, setLocalValue] = useState(() => simplifyJobStatus(job.status));
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === localValue) return;
    setLocalValue(val);

    const dbStatus = expandToJobStatus(val);
    startTransition(async () => {
      const result = await updateJobStatus(job.id, dbStatus);
      if (result.ok) {
        const label = SIMPLE_STATUSES.find(s => s.value === val)?.label || val;
        setToast(`Changed to ${label}`);
        setTimeout(() => setToast(null), 2000);
        onChanged?.();
      } else {
        setLocalValue(simplifyJobStatus(job.status));
        setToast("Failed");
        setTimeout(() => setToast(null), 2000);
      }
    });
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <select
        value={localValue}
        onChange={handleChange}
        disabled={isPending}
        className="text-sm font-medium rounded-lg px-2 py-1.5 ring-1 ring-slate-200 bg-white hover:ring-blue-300 focus:ring-blue-400 focus:outline-none disabled:opacity-50 cursor-pointer"
      >
        {SIMPLE_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      {toast && (
        <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-medium whitespace-nowrap">
          {toast}
        </span>
      )}
    </div>
  );
}

/* ── Expanded detail panel ── */
function JobDetail({ job, onStatusChanged }: { job: Job; onStatusChanged?: () => void }) {
  const vehicle = [job.vehicle_year, job.vehicle_make, job.vehicle_model]
    .filter(Boolean)
    .join(" ");
  const pickupFull = [job.pickup_address, job.pickup_city, job.pickup_state, job.pickup_zip]
    .filter(Boolean)
    .join(", ");
  const dropoffFull = [job.dropoff_address, job.dropoff_city, job.dropoff_state, job.dropoff_zip]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="px-5 py-4 bg-slate-50/60 space-y-4 text-sm border-t border-slate-100">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Customer</div>
          <div className="mt-0.5 font-semibold text-slate-900">{job.customer || "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Phone</div>
          <div className="mt-0.5">
            {job.phone ? (
              <a href={`tel:${job.phone}`} className="text-blue-600 hover:underline">{job.phone}</a>
            ) : "—"}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Status</div>
          <div className="mt-0.5"><JobStatusChanger job={job} onChanged={onStatusChanged} /></div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Created</div>
          <div className="mt-0.5 text-slate-700">{formatTime(job.created_at)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Vehicle</div>
          <div className="mt-0.5 text-slate-700">{vehicle || "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Running</div>
          <div className="mt-0.5">
            {job.vehicle_running == null ? (
              <span className="text-slate-400">—</span>
            ) : job.vehicle_running ? (
              <span className="text-emerald-600 font-medium">Yes</span>
            ) : (
              <span className="text-rose-600 font-medium">No (non-runner)</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Distance</div>
          <div className="mt-0.5 text-slate-700">{job.distance_miles != null ? `${job.distance_miles} mi` : "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Scheduled For</div>
          <div className="mt-0.5 text-slate-700">{formatTime(job.scheduled_for)}</div>
        </div>
      </div>

      {/* Full addresses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Pickup Address</div>
          <div className="text-slate-700 bg-white rounded-lg px-3 py-2 ring-1 ring-slate-200/70 flex items-start gap-2">
            <span className="text-slate-400 shrink-0 mt-0.5">◉</span>
            <span>{pickupFull || "TBD"}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Dropoff Address</div>
          <div className="text-slate-700 bg-white rounded-lg px-3 py-2 ring-1 ring-slate-200/70 flex items-start gap-2">
            <span className="text-slate-400 shrink-0 mt-0.5">➤</span>
            <span>{dropoffFull || "TBD"}</span>
          </div>
        </div>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Price</div>
          <div className="mt-0.5">
            <EditablePrice jobId={job.id} initialPrice={job.price} size="lg" />
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Driver Pay</div>
          <div className="mt-0.5 text-lg font-bold text-slate-900">{job.driver_pay != null ? money(job.driver_pay) : "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Profit</div>
          <div className="mt-0.5 text-lg font-bold text-emerald-600">
            {job.price != null && job.driver_pay != null
              ? money(job.price - job.driver_pay)
              : "—"}
          </div>
        </div>
      </div>

      {job.notes && (
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Notes</div>
          <div className="text-slate-700 bg-white rounded-lg px-3 py-2 ring-1 ring-slate-200/70">
            {job.notes}
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobsTable({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const handleStatusChanged = () => router.refresh();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon="✦"
        title="No jobs yet"
        description="Convert a booked lead into a job to see it in the dispatch queue."
      />
    );
  }

  return (
    <>
      {/* Mobile — card grid */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {jobs.map((job) => {
          const vehicle = [job.vehicle_year, job.vehicle_make, job.vehicle_model]
            .filter(Boolean)
            .join(" ");
          const pickup = [job.pickup_city, job.pickup_state].filter(Boolean).join(", ");
          const dropoff = [job.dropoff_city, job.dropoff_state].filter(Boolean).join(", ");
          const isOpen = expandedId === job.id;

          return (
            <div
              key={job.id}
              className={`bg-white rounded-2xl ring-1 shadow-sm overflow-hidden transition-all ${
                isOpen ? "ring-blue-300 shadow-md" : "ring-slate-200/70 border-slate-100"
              }`}
            >
              <button
                onClick={() => toggle(job.id)}
                className="w-full text-left p-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {vehicle || "Vehicle TBD"}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{job.customer || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <JobStatusChanger job={job} onChanged={handleStatusChanged} />
                    <span className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                      ▾
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 shrink-0">◉</span>
                    <span className="truncate">{pickup || "Pickup TBD"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 shrink-0">➤</span>
                    <span className="truncate">{dropoff || "Dropoff TBD"}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Price</div>
                    <EditablePrice jobId={job.id} initialPrice={job.price} size="sm" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Driver Pay</div>
                    <div className="font-semibold text-slate-900">
                      {job.driver_pay != null ? money(job.driver_pay) : "—"}
                    </div>
                  </div>
                  {job.distance_miles != null && (
                    <div className="text-xs text-slate-500">{job.distance_miles} mi</div>
                  )}
                </div>
              </button>

              {isOpen && <JobDetail job={job} onStatusChanged={handleStatusChanged} />}
            </div>
          );
        })}
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
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
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
              const isOpen = expandedId === job.id;

              return (
                <tbody key={job.id}>
                  <tr
                    onClick={() => toggle(job.id)}
                    className={`border-t border-slate-100 cursor-pointer transition-colors ${
                      isOpen ? "bg-blue-50/40" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <JobStatusChanger job={job} onChanged={handleStatusChanged} />
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
                    <td className="px-4 py-3 text-right">
                      <EditablePrice jobId={job.id} initialPrice={job.price} size="md" />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {job.driver_pay != null ? money(job.driver_pay) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DeleteJobButton jobId={job.id} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <JobDetail job={job} onStatusChanged={handleStatusChanged} />
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      </div>
    </>
  );
}
