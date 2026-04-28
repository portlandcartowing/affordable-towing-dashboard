"use client";

import { useState } from "react";
import CollapsibleTranscript from "@/components/calls/CollapsibleTranscript";

export default function CallHistoryItem({
  transcript,
  aiSummary,
  children,
}: {
  transcript: string | null;
  aiSummary: string | null;
  children: (toggle: {
    expanded: boolean;
    onToggle: () => void;
  }) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasTranscript = !!(transcript && transcript.trim().length > 0);

  return (
    <>
      {children({ expanded, onToggle: () => setExpanded((v) => !v) })}
      {expanded && (
        <div className="mt-2">
          {hasTranscript ? (
            <CollapsibleTranscript text={transcript!} />
          ) : (
            <div className="rounded-lg ring-1 ring-slate-200/70 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {aiSummary || "No transcript available for this call."}
            </div>
          )}
        </div>
      )}
    </>
  );
}
