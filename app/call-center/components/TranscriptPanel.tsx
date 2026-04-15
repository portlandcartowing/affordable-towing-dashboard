"use client";

import { useEffect, useRef } from "react";
import type { TranscriptChunk, CallCenterStatus } from "../types";

export default function TranscriptPanel({
  chunks,
  status,
}: {
  chunks: TranscriptChunk[];
  status: CallCenterStatus;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new chunks.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chunks.length]);

  const isLive = status === "live";

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Live Transcript</h3>
          {isLive && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-blue-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              streaming
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400 tabular-nums">
          {chunks.length} {chunks.length === 1 ? "line" : "lines"}
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {chunks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            {status === "new_call"
              ? "Waiting for call to connect…"
              : "No transcript for this call."}
          </div>
        ) : (
          chunks.map((c) => <TranscriptLine key={c.id} chunk={c} />)
        )}
      </div>
    </div>
  );
}

function TranscriptLine({ chunk }: { chunk: TranscriptChunk }) {
  const isCaller = chunk.speaker === "caller";
  return (
    <div className="flex gap-2">
      <div
        className={`shrink-0 mt-0.5 w-[70px] text-[10px] font-semibold uppercase tracking-wider ${
          isCaller ? "text-slate-500" : "text-blue-600"
        }`}
      >
        {isCaller ? "Caller" : "Dispatcher"}
      </div>
      <div
        className={`flex-1 rounded-xl px-3 py-2 text-sm leading-snug ${
          isCaller
            ? "bg-slate-100 text-slate-800"
            : "bg-blue-50 text-blue-900 border border-blue-100"
        }`}
      >
        {chunk.text}
      </div>
    </div>
  );
}
