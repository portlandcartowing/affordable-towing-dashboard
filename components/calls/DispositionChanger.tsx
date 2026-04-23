"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCallDisposition } from "@/app/calls/actions";
import { CALL_DISPOSITIONS } from "@/lib/types";
import type { CallDisposition } from "@/lib/types";

/**
 * Inline dropdown to set a call's disposition. Used on the Calls page,
 * the Call Center, and the customer-profile call history.
 *
 * The underlying server action (updateCallDisposition) also syncs the
 * linked lead and job — so flipping the disposition anywhere in the UI
 * propagates to every surface that reads from calls/leads/jobs.
 */
export default function DispositionChanger({
  callId,
  initialValue,
  onChanged,
  size = "md",
}: {
  callId: string;
  initialValue: CallDisposition | null;
  onChanged?: () => void;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [localValue, setLocalValue] = useState<string>(initialValue ?? "");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const newDisp = val === "" ? null : (val as CallDisposition);
    if (val === localValue) return;

    setLocalValue(val);

    startTransition(async () => {
      const result = await updateCallDisposition(callId, newDisp);
      if (result.ok) {
        setToast(`Changed to ${newDisp || "none"}`);
        setTimeout(() => setToast(null), 2000);
        onChanged?.();
        router.refresh();
      } else {
        setLocalValue(initialValue ?? "");
        setToast("Failed to update");
        setTimeout(() => setToast(null), 2000);
      }
    });
  };

  const sizeCls = size === "sm" ? "text-xs px-1.5 py-1" : "text-sm px-2 py-1.5";

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <select
        value={localValue}
        onChange={handleChange}
        disabled={isPending}
        className={`${sizeCls} font-medium rounded-lg ring-1 ring-slate-200 bg-white hover:ring-blue-300 focus:ring-blue-400 focus:outline-none disabled:opacity-50 cursor-pointer`}
      >
        <option value="">— None —</option>
        {CALL_DISPOSITIONS.map((d) => (
          <option key={d} value={d}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </option>
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
