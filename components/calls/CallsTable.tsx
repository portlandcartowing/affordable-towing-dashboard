"use client";

import { useState } from "react";
import EmptyState from "@/components/dashboard/EmptyState";
import CreateLeadButton from "./CreateLeadButton";
import type { Call, CallDisposition } from "@/lib/types";

function formatTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function truncate(text: string | null, max = 60) {
  if (!text) return "—";
  return text.length > max ? text.slice(0, max).trim() + "…" : text;
}

const DISPOSITION_STYLES: Record<CallDisposition, { bg: string; text: string }> = {
  booked:   { bg: "bg-emerald-50", text: "text-emerald-700" },
  standby:  { bg: "bg-amber-50",   text: "text-amber-700" },
  lost:     { bg: "bg-rose-50",    text: "text-rose-700" },
  callback: { bg: "bg-blue-50",    text: "text-blue-700" },
  spam:     { bg: "bg-slate-100",  text: "text-slate-500" },
};

function DispositionBadge({ disposition }: { disposition: CallDisposition | null }) {
  if (!disposition) return <span className="text-xs text-slate-400">—</span>;
  const s = DISPOSITION_STYLES[disposition];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text} capitalize`}>
      {disposition}
    </span>
  );
}

function ConvertedPill({ value }: { value: boolean | null }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">
        Converted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
      Not yet
    </span>
  );
}

function LinkStatus({
  call,
  leadHasJob,
}: {
  call: Call;
  leadHasJob: boolean;
}) {
  if (!call.lead_id) {
    return <CreateLeadButton callId={call.id} />;
  }
  if (leadHasJob) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 whitespace-nowrap">
        ✓ In Job
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 whitespace-nowrap">
      Linked
    </span>
  );
}

/* ── Expanded detail panel shown when a row is clicked ── */
function CallDetail({ call }: { call: Call }) {
  return (
    <div className="px-5 py-4 bg-slate-50/60 space-y-4 text-sm border-t border-slate-100">
      {/* Top row: key fields */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Disposition</div>
          <div className="mt-0.5"><DispositionBadge disposition={call.disposition} /></div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Quoted Price</div>
          <div className="mt-0.5 font-semibold text-slate-900">
            {call.quoted_price != null ? `$${call.quoted_price.toFixed(2)}` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Dispatcher</div>
          <div className="mt-0.5 text-slate-700">{call.dispatcher || "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Duration</div>
          <div className="mt-0.5 text-slate-700">{formatDuration(call.duration_seconds)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Source</div>
          <div className="mt-0.5">
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
              {call.source || "unknown"}
            </span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Tracking #</div>
          <div className="mt-0.5 text-slate-700">{call.tracking_number || "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Lost Reason</div>
          <div className="mt-0.5 text-slate-700">{call.lost_reason || "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Callback At</div>
          <div className="mt-0.5 text-slate-700">{call.callback_at ? formatTime(call.callback_at) : "—"}</div>
        </div>
      </div>

      {/* AI Summary */}
      {call.ai_summary && (
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">AI Summary</div>
          <div className="text-slate-700 bg-white rounded-lg px-3 py-2 ring-1 ring-slate-200/70">
            {call.ai_summary}
          </div>
        </div>
      )}

      {/* Full transcript */}
      {call.transcript && (
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Transcript</div>
          <div className="text-slate-700 bg-white rounded-lg px-3 py-2 ring-1 ring-slate-200/70 whitespace-pre-wrap max-h-48 overflow-y-auto text-xs leading-relaxed">
            {call.transcript}
          </div>
        </div>
      )}

      {/* Notes */}
      {call.notes && (
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Notes</div>
          <div className="text-slate-700 bg-white rounded-lg px-3 py-2 ring-1 ring-slate-200/70">
            {call.notes}
          </div>
        </div>
      )}

      {/* Recording */}
      {call.recording_url && (
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Recording</div>
          <audio controls className="w-full max-w-md" preload="none">
            <source src={call.recording_url} />
          </audio>
        </div>
      )}
    </div>
  );
}

export default function CallsTable({
  calls,
  leadIdsWithJobs: leadIdsArr,
}: {
  calls: Call[];
  leadIdsWithJobs: string[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const leadIdsWithJobs = new Set(leadIdsArr);

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  if (calls.length === 0) {
    return (
      <EmptyState
        icon="☎"
        title="No calls tracked yet"
        description="Connect CallRail or Twilio in Settings to start logging inbound calls automatically."
      />
    );
  }

  return (
    <>
      {/* Mobile — stacked cards */}
      <ul className="md:hidden space-y-3">
        {calls.map((call) => {
          const leadHasJob = !!(call.lead_id && leadIdsWithJobs.has(call.lead_id));
          const isOpen = expandedId === call.id;
          return (
            <li
              key={call.id}
              className={`bg-white rounded-2xl ring-1 shadow-sm overflow-hidden transition-all ${
                isOpen ? "ring-blue-300 shadow-md" : "ring-slate-200/70"
              }`}
            >
              <button
                onClick={() => toggle(call.id)}
                className="w-full text-left p-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-blue-600 truncate block text-base">
                      {call.caller_phone || "Unknown"}
                    </span>
                    <div className="text-[11px] uppercase text-slate-400 mt-0.5">
                      {formatTime(call.started_at || call.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ConvertedPill value={call.converted_to_job} />
                    <span className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                      ▾
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-slate-400">Source</div>
                    <div className="text-slate-800 truncate">{call.source || "—"}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Duration</div>
                    <div className="text-slate-800">{formatDuration(call.duration_seconds)}</div>
                  </div>
                </div>

                {!isOpen && call.transcript && (
                  <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2">
                    {truncate(call.transcript, 120)}
                  </div>
                )}
              </button>

              {isOpen && (
                <>
                  <CallDetail call={call} />
                  <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                    {call.caller_phone && (
                      <a
                        href={`tel:${call.caller_phone}`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Call Back
                      </a>
                    )}
                    <LinkStatus call={call} leadHasJob={leadHasJob} />
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {/* Desktop / tablet — full table */}
      <div className="hidden md:block bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 whitespace-nowrap">Date / Time</th>
                <th className="text-left px-4 py-3">Caller</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-left px-4 py-3">Duration</th>
                <th className="text-left px-4 py-3">Disposition</th>
                <th className="text-left px-4 py-3">Transcript</th>
                <th className="text-left px-4 py-3">Converted</th>
                <th className="text-right px-4 py-3">Link</th>
              </tr>
            </thead>
            {calls.map((call) => {
              const leadHasJob = !!(call.lead_id && leadIdsWithJobs.has(call.lead_id));
              const isOpen = expandedId === call.id;
              return (
                <tbody key={call.id}>
                  <tr
                    onClick={() => toggle(call.id)}
                    className={`border-t border-slate-100 cursor-pointer transition-colors ${
                      isOpen ? "bg-blue-50/40" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatTime(call.started_at || call.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      <span className="text-blue-600">{call.caller_phone || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700">
                        {call.source || "unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDuration(call.duration_seconds)}
                    </td>
                    <td className="px-4 py-3">
                      <DispositionBadge disposition={call.disposition} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {truncate(call.transcript)}
                    </td>
                    <td className="px-4 py-3">
                      <ConvertedPill value={call.converted_to_job} />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <LinkStatus call={call} leadHasJob={leadHasJob} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <CallDetail call={call} />
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      </div>
    </>
  );
}
