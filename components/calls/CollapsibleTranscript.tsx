"use client";

import { useState } from "react";

export default function CollapsibleTranscript({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 280;

  return (
    <div className="text-slate-700 bg-white rounded-lg ring-1 ring-slate-200/70 text-xs leading-relaxed">
      <div
        className={`whitespace-pre-wrap px-3 py-2 ${
          !expanded && isLong
            ? "max-h-32 overflow-hidden relative"
            : "max-h-[600px] overflow-y-auto"
        }`}
      >
        {text}
        {!expanded && isLong && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full border-t border-slate-100 px-3 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-slate-50 transition-colors"
        >
          {expanded ? "Minimize transcript" : "Expand full transcript"}
        </button>
      )}
    </div>
  );
}
