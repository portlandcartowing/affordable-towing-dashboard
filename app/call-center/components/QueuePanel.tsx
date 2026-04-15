"use client";

import StatusBadge from "./StatusBadge";
import type { CallCenterCall } from "../types";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function QueuePanel({
  calls,
  selectedId,
  onSelect,
}: {
  calls: CallCenterCall[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const live = calls.filter((c) => c.status === "live" || c.status === "new_call");
  const rest = calls.filter((c) => c.status !== "live" && c.status !== "new_call");

  return (
    <div className="flex flex-col h-full min-h-0 bg-white border-r border-slate-200/70">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Call Queue</h2>
          <p className="text-[11px] text-slate-500">
            {live.length} active · {calls.length} total
          </p>
        </div>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {live.length > 0 && (
          <div>
            <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Active
            </div>
            <ul>
              {live.map((call) => (
                <QueueItem
                  key={call.id}
                  call={call}
                  selected={call.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </div>
        )}
        <div>
          <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Recent
          </div>
          <ul>
            {rest.map((call) => (
              <QueueItem
                key={call.id}
                call={call}
                selected={call.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function QueueItem({
  call,
  selected,
  onSelect,
}: {
  call: CallCenterCall;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        onClick={() => onSelect(call.id)}
        className={`w-full text-left px-4 py-3 border-l-2 transition-colors ${
          selected
            ? "bg-blue-50/60 border-blue-600"
            : "border-transparent hover:bg-slate-50"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-sm text-slate-900 tabular-nums truncate">
            {call.caller_phone}
          </div>
          <StatusBadge status={call.status} pulse={call.status === "live"} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
          <span>{formatClock(call.started_at)}</span>
          <span>{formatDuration(call.duration_seconds)}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-slate-400 truncate">
          {call.dispatcher ? `${call.dispatcher} · ${call.source}` : call.source}
        </div>
      </button>
    </li>
  );
}
