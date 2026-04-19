"use client";

import { useState, useTransition } from "react";
import { deleteCall } from "@/app/calls/actions";

export default function BulkDeleteButton({ callIds, onDone }: { callIds: string[]; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (callIds.length === 0) return null;

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
      >
        Delete {callIds.length} selected
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          startTransition(async () => {
            for (const id of callIds) {
              await deleteCall(id);
            }
            setConfirm(false);
            onDone();
          });
        }}
        disabled={isPending}
        className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-60"
      >
        {isPending ? `Deleting ${callIds.length}…` : `Confirm delete ${callIds.length}`}
      </button>
      <button
        onClick={() => setConfirm(false)}
        className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
      >
        Cancel
      </button>
    </div>
  );
}
