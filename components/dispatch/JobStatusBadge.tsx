import { JOB_STATUS_COLORS, JOB_STATUS_LABELS, type JobStatus } from "@/lib/types";

export default function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${JOB_STATUS_COLORS[status]}`}
    >
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
