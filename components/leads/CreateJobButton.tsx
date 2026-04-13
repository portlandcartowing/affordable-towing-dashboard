"use client";

import { useState, useTransition } from "react";
import { createJobFromLead } from "@/app/leads/actions";

export default function CreateJobButton({
  leadId,
  hasJob,
  booked,
  size = "sm",
}: {
  leadId: string;
  hasJob: boolean;
  booked: boolean;
  size?: "sm" | "md";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (hasJob) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 whitespace-nowrap">
        ✓ In Job
      </span>
    );
  }

  const disabled = !booked || isPending;
  const base = size === "md" ? "px-3 py-2 text-sm" : "px-2.5 py-1.5 text-xs";
  const title = !booked ? "Mark lead as booked first" : undefined;

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await createJobFromLead(leadId);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`${base} font-medium rounded-lg whitespace-nowrap transition-colors ${
          disabled
            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {isPending ? "Creating…" : "+ Create Job"}
      </button>
      {error && <span className="text-[10px] text-rose-600 max-w-[140px] text-right">{error}</span>}
    </div>
  );
}
