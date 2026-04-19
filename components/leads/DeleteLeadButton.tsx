"use client";

import { useState, useTransition } from "react";
import { deleteLead } from "@/app/leads/deleteActions";

export default function DeleteLeadButton({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => startTransition(async () => { await deleteLead(leadId); })}
        disabled={isPending}
        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
      >
        {isPending ? "Deleting…" : "Confirm"}
      </button>
      <button
        onClick={() => setConfirm(false)}
        className="text-[11px] text-slate-400"
      >
        Cancel
      </button>
    </div>
  );
}
