import EmptyState from "@/components/dashboard/EmptyState";
import CreateLeadButton from "./CreateLeadButton";
import type { Call } from "@/lib/types";

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

export default function CallsTable({
  calls,
  leadIdsWithJobs,
}: {
  calls: Call[];
  leadIdsWithJobs: Set<string>;
}) {
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
          return (
            <li
              key={call.id}
              className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={call.caller_phone ? `tel:${call.caller_phone}` : undefined}
                    className="font-semibold text-blue-600 truncate block text-base"
                  >
                    {call.caller_phone || "Unknown"}
                  </a>
                  <div className="text-[11px] uppercase text-slate-400 mt-0.5">
                    {formatTime(call.started_at || call.created_at)}
                  </div>
                </div>
                <ConvertedPill value={call.converted_to_job} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-400">Source</div>
                  <div className="text-slate-800 truncate">{call.source || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-400">Tracking #</div>
                  <div className="text-slate-800 truncate">{call.tracking_number || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-400">Duration</div>
                  <div className="text-slate-800">{formatDuration(call.duration_seconds)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Linked</div>
                  <div className="text-slate-800 truncate">
                    {call.lead_id ? call.lead_id.slice(0, 8) : "—"}
                  </div>
                </div>
              </div>

              {call.transcript && (
                <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2">
                  {truncate(call.transcript, 120)}
                </div>
              )}
              {call.notes && (
                <div className="mt-2 text-xs text-slate-500 italic">{call.notes}</div>
              )}

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end">
                <LinkStatus call={call} leadHasJob={leadHasJob} />
              </div>
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
                <th className="text-left px-4 py-3">Tracking #</th>
                <th className="text-left px-4 py-3">Duration</th>
                <th className="text-left px-4 py-3">Transcript</th>
                <th className="text-left px-4 py-3">Converted</th>
                <th className="text-left px-4 py-3">Notes</th>
                <th className="text-right px-4 py-3">Link</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const leadHasJob = !!(call.lead_id && leadIdsWithJobs.has(call.lead_id));
                return (
                <tr key={call.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatTime(call.started_at || call.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    <a
                      href={call.caller_phone ? `tel:${call.caller_phone}` : undefined}
                      className="text-blue-600"
                    >
                      {call.caller_phone || "—"}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700">
                      {call.source || "unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {call.tracking_number || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDuration(call.duration_seconds)}
                  </td>
                  <td
                    className="px-4 py-3 text-slate-500 max-w-xs truncate"
                    title={call.transcript || ""}
                  >
                    {truncate(call.transcript)}
                  </td>
                  <td className="px-4 py-3">
                    <ConvertedPill value={call.converted_to_job} />
                  </td>
                  <td
                    className="px-4 py-3 text-slate-500 max-w-xs truncate"
                    title={call.notes || ""}
                  >
                    {call.notes || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <LinkStatus call={call} leadHasJob={leadHasJob} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
