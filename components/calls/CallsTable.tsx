"use client";

import { useState, useMemo } from "react";
import EmptyState from "@/components/dashboard/EmptyState";
import CreateLeadButton from "./CreateLeadButton";
import DeleteCallButton from "./DeleteCallButton";
import BulkDeleteButton from "./BulkDeleteButton";
import type { Call, CallDisposition } from "@/lib/types";

function formatTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(sec: number | null) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function truncate(text: string | null, max = 60) {
  if (!text) return "—";
  return text.length > max ? text.slice(0, max).trim() + "…" : text;
}

const DISP_STYLES: Record<CallDisposition, { bg: string; text: string }> = {
  booked: { bg: "bg-emerald-50", text: "text-emerald-700" },
  standby: { bg: "bg-amber-50", text: "text-amber-700" },
  lost: { bg: "bg-rose-50", text: "text-rose-700" },
  callback: { bg: "bg-blue-50", text: "text-blue-700" },
  spam: { bg: "bg-slate-100", text: "text-slate-500" },
};

function DispositionBadge({ d }: { d: CallDisposition | null }) {
  if (!d) return <span className="text-xs text-slate-400">—</span>;
  const s = DISP_STYLES[d];
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${s.bg} ${s.text}`}>{d}</span>;
}

function LinkStatus({ call, leadHasJob }: { call: Call; leadHasJob: boolean }) {
  if (!call.lead_id) return <CreateLeadButton callId={call.id} />;
  if (leadHasJob) return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">✓ In Job</span>;
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">Linked</span>;
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------
type SortKey = "time" | "caller" | "source" | "duration" | "disposition";
type SortDir = "asc" | "desc";

function sortCalls(calls: Call[], key: SortKey, dir: SortDir): Call[] {
  return [...calls].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "time": cmp = (a.started_at || a.created_at).localeCompare(b.started_at || b.created_at); break;
      case "caller": cmp = (a.caller_phone || "").localeCompare(b.caller_phone || ""); break;
      case "source": cmp = (a.source || "").localeCompare(b.source || ""); break;
      case "duration": cmp = (a.duration_seconds || 0) - (b.duration_seconds || 0); break;
      case "disposition": cmp = (a.disposition || "").localeCompare(b.disposition || ""); break;
    }
    return dir === "desc" ? -cmp : cmp;
  });
}

// ---------------------------------------------------------------------------
// CallDetail — expanded panel
// ---------------------------------------------------------------------------
function CallDetail({ call }: { call: Call }) {
  return (
    <div className="px-5 py-4 bg-slate-50/60 space-y-4 text-sm border-t border-slate-100">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Disposition</div>
          <div className="mt-0.5"><DispositionBadge d={call.disposition} /></div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Quoted Price</div>
          <div className="mt-0.5 font-semibold text-slate-900">{call.quoted_price != null ? `$${call.quoted_price}` : "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Source</div>
          <div className="mt-0.5"><span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">{call.source || "unknown"}</span></div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Duration</div>
          <div className="mt-0.5 text-slate-700">{formatDuration(call.duration_seconds)}</div>
        </div>
      </div>

      {call.ai_summary && (
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">AI Summary</div>
          <div className="text-slate-700 bg-white rounded-lg px-3 py-2 ring-1 ring-slate-200/70">{call.ai_summary}</div>
        </div>
      )}

      {call.transcript && (
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Transcript</div>
          <div className="text-slate-700 bg-white rounded-lg px-3 py-2 ring-1 ring-slate-200/70 whitespace-pre-wrap max-h-48 overflow-y-auto text-xs leading-relaxed">{call.transcript}</div>
        </div>
      )}

      {call.recording_url && (
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Recording</div>
          <audio controls className="w-full max-w-md" preload="none">
            <source src={call.recording_url} />
          </audio>
        </div>
      )}

      {call.notes && (
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Notes</div>
          <div className="text-slate-700 bg-white rounded-lg px-3 py-2 ring-1 ring-slate-200/70">{call.notes}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main table component
// ---------------------------------------------------------------------------
export default function CallsTable({
  calls,
  leadIdsWithJobs: leadIdsArr,
}: {
  calls: Call[];
  leadIdsWithJobs: string[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const leadIdsWithJobs = new Set(leadIdsArr);

  const sorted = useMemo(() => sortCalls(calls, sortKey, sortDir), [calls, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((c) => c.id)));
  };

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span className="text-slate-300 ml-0.5">↕</span>;
    return <span className="text-blue-500 ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  if (calls.length === 0) {
    return <EmptyState icon="☎" title="No calls tracked yet" description="Calls will appear here automatically when customers call your Twilio number." />;
  }

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-slate-100 rounded-xl px-4 py-2.5">
          <span className="text-xs text-slate-600 font-medium">{selected.size} selected</span>
          <BulkDeleteButton callIds={[...selected]} onDone={() => setSelected(new Set())} />
          <button onClick={() => setSelected(new Set())} className="text-xs text-slate-400 hover:text-slate-600 ml-auto">Clear</button>
        </div>
      )}

      {/* Mobile cards */}
      <ul className="md:hidden space-y-3">
        {sorted.map((call) => {
          const leadHasJob = !!(call.lead_id && leadIdsWithJobs.has(call.lead_id));
          const isOpen = expandedId === call.id;
          const isSelected = selected.has(call.id);
          return (
            <li key={call.id} className={`bg-white rounded-2xl ring-1 shadow-sm overflow-hidden transition-all ${isOpen ? "ring-blue-300 shadow-md" : isSelected ? "ring-blue-400" : "ring-slate-200/70"}`}>
              <div className="flex items-start gap-3 p-4">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(call.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 shrink-0"
                />
                <button onClick={() => toggle(call.id)} className="flex-1 text-left min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-blue-600 truncate block">{call.caller_phone || "Unknown"}</span>
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatTime(call.started_at || call.created_at)}</div>
                    </div>
                    <DispositionBadge d={call.disposition} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-400">Source: </span><span className="text-slate-700">{call.source || "—"}</span></div>
                    <div><span className="text-slate-400">Duration: </span><span className="text-slate-700">{formatDuration(call.duration_seconds)}</span></div>
                  </div>
                  {!isOpen && call.transcript && (
                    <div className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2">{truncate(call.transcript, 100)}</div>
                  )}
                </button>
              </div>
              {isOpen && (
                <>
                  <CallDetail call={call} />
                  <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                    <DeleteCallButton callId={call.id} />
                    <LinkStatus call={call} leadHasJob={leadHasJob} />
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selected.size === sorted.length && sorted.length > 0} onChange={toggleAll} className="h-4 w-4 rounded border-slate-300" />
                </th>
                <th className="text-left px-4 py-3 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("time")}>Date / Time {sortArrow("time")}</th>
                <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("caller")}>Caller {sortArrow("caller")}</th>
                <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("source")}>Source {sortArrow("source")}</th>
                <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("duration")}>Duration {sortArrow("duration")}</th>
                <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("disposition")}>Disposition {sortArrow("disposition")}</th>
                <th className="text-left px-4 py-3">Transcript</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((call) => {
                const leadHasJob = !!(call.lead_id && leadIdsWithJobs.has(call.lead_id));
                const isOpen = expandedId === call.id;
                const isSelected = selected.has(call.id);
                return (
                  <tbody key={call.id}>
                    <tr
                      className={`border-t border-slate-100 cursor-pointer transition-colors ${isOpen ? "bg-blue-50/40" : isSelected ? "bg-blue-50/20" : "hover:bg-slate-50/50"}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(call.id)} className="h-4 w-4 rounded border-slate-300" />
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap" onClick={() => toggle(call.id)}>{formatTime(call.started_at || call.created_at)}</td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap" onClick={() => toggle(call.id)}><span className="text-blue-600">{call.caller_phone || "—"}</span></td>
                      <td className="px-4 py-3" onClick={() => toggle(call.id)}><span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700">{call.source || "unknown"}</span></td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums" onClick={() => toggle(call.id)}>{formatDuration(call.duration_seconds)}</td>
                      <td className="px-4 py-3" onClick={() => toggle(call.id)}><DispositionBadge d={call.disposition} /></td>
                      <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate" onClick={() => toggle(call.id)}>{truncate(call.transcript, 50)}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <DeleteCallButton callId={call.id} />
                          <LinkStatus call={call} leadHasJob={leadHasJob} />
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr><td colSpan={8} className="p-0"><CallDetail call={call} /></td></tr>
                    )}
                  </tbody>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
