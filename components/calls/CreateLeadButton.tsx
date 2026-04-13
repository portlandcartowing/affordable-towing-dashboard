"use client";

import { useState, useTransition } from "react";
import { createLeadFromCall } from "@/app/calls/actions";

export default function CreateLeadButton({
  callId,
  size = "sm",
}: {
  callId: string;
  size?: "sm" | "md";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await createLeadFromCall(callId);
      if (!res.ok) setError(res.error);
    });
  };

  const base =
    size === "md"
      ? "px-3 py-2 text-sm"
      : "px-2.5 py-1.5 text-xs";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={`${base} font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap`}
      >
        {isPending ? "Creating…" : "+ Create Lead"}
      </button>
      {error && <span className="text-[10px] text-rose-600 max-w-[140px] text-right">{error}</span>}
    </div>
  );
}
