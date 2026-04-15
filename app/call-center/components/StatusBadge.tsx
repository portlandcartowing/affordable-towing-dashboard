"use client";

import { STATUS_LABEL, STATUS_STYLE, type CallCenterStatus } from "../types";

export default function StatusBadge({
  status,
  pulse = false,
  size = "sm",
}: {
  status: CallCenterStatus;
  pulse?: boolean;
  size?: "sm" | "md";
}) {
  const s = STATUS_STYLE[status];
  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${pad} ${s.pill}`}
    >
      <span className={`relative w-1.5 h-1.5 rounded-full ${s.dot}`}>
        {pulse && (
          <span className={`absolute inset-0 rounded-full ${s.dot} animate-ping opacity-75`} />
        )}
      </span>
      {STATUS_LABEL[status]}
    </span>
  );
}
