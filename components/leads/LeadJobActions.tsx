"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createJobFromLead } from "@/app/leads/actions";
import { updateJobStatus } from "@/app/jobs/jobActions";
import { deleteLead } from "@/app/leads/deleteActions";

/**
 * Combined Job-column actions on the Leads table: Convert to Job,
 * Mark Complete (triggers auto-review SMS), or Delete.
 *
 * Contextually shows the relevant actions for the lead's state:
 *   - no job yet   → Convert + Delete
 *   - job exists   → Mark Complete + Delete
 *   - completed    → "✓ Completed" badge + Delete
 */
export default function LeadJobActions({
  leadId,
  jobId,
  jobStatus,
  booked,
}: {
  leadId: string;
  jobId: string | null;
  jobStatus: string | null;
  booked: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const runConvert = () => {
    setErr(null);
    startTransition(async () => {
      const res = await createJobFromLead(leadId);
      if (res.ok) router.refresh();
      else setErr(res.error);
    });
  };

  const runComplete = () => {
    if (!jobId) return;
    if (!confirm("Mark job as completed? This sends the customer a Google review link automatically.")) return;
    setErr(null);
    startTransition(async () => {
      const res = await updateJobStatus(jobId, "completed");
      if (res.ok) router.refresh();
      else setErr(res.error ?? "Failed");
    });
  };

  const runDelete = () => {
    if (!confirm("Delete this lead? This removes the lead row but leaves the call record intact.")) return;
    setErr(null);
    startTransition(async () => {
      const res = await deleteLead(leadId);
      if (res.ok) router.refresh();
      else setErr(res.error ?? "Failed");
    });
  };

  const isCompleted = jobStatus === "completed";
  const hasJob = !!jobId;

  return (
    <div className="flex items-center justify-end gap-2">
      {isCompleted ? (
        <span className="px-2 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
          ✓ Completed
        </span>
      ) : hasJob ? (
        <button
          type="button"
          onClick={runComplete}
          disabled={isPending}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          title="Marks job completed and auto-sends Google review SMS"
        >
          Mark Complete
        </button>
      ) : (
        <button
          type="button"
          onClick={runConvert}
          disabled={isPending || !booked}
          title={!booked ? "Mark lead as booked first" : undefined}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            isPending || !booked
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          Convert to Job
        </button>
      )}
      <button
        type="button"
        onClick={runDelete}
        disabled={isPending}
        className="px-2 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50 transition-colors"
        title="Delete lead"
      >
        Delete
      </button>
      {err && <span className="text-[10px] text-rose-600 ml-1">{err}</span>}
    </div>
  );
}
