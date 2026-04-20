"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/dashboard/EmptyState";
import CreateLeadButton from "./CreateLeadButton";
import DeleteCallButton from "./DeleteCallButton";
import BulkDeleteButton from "./BulkDeleteButton";
import { updateCallDisposition } from "@/app/calls/actions";
import type { Call, CallDisposition } from "@/lib/types";
import { CALL_DISPOSITIONS } from "@/lib/types";

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
// Disposition changer dropdown
// ---------------------------------------------------------------------------
function DispositionChanger({ call, onChanged }: { call: Call; onChanged?: () => void }) {
  const [localValue, setLocalValue] = useState<string>(call.disposition || "");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const newDisp = val === "" ? null : (val as CallDisposition);
    if (val === localValue) return;

    setLocalValue(val);

    startTransition(async () => {
      const result = await updateCallDisposition(call.id, newDisp);
      if (result.ok) {
        setToast(`Changed to ${newDisp || "none"}`);
        setTimeout(() => setToast(null), 2000);
        onChanged?.();
      } else {
        setLocalValue(call.disposition || "");
        setToast("Failed to update");
        setTimeout(() => setToast(null), 2000);
      }
    });
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <select
        value={localValue}
        onChange={handleChange}
        disabled={isPending}
        className="text-sm font-medium rounded-lg px-2 py-1.5 ring-1 ring-slate-200 bg-white hover:ring-blue-300 focus:ring-blue-400 focus:outline-none disabled:opacity-50 cursor-pointer"
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

// ---------------------------------------------------------------------------
// CallDetail — expanded panel
// ---------------------------------------------------------------------------
function CallDetail({ call, onDispositionChanged }: { call: Call; onDispositionChanged?: () => void }) {
  return (
    <div className="px-5 py-4 bg-slate-50/60 space-y-4 text-sm border-t border-slate-100">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Disposition</div>
          <DispositionChanger call={call} onChanged={onDispositionChanged} />
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
  leadNames = {},
}: {
  calls: Call[];
  leadIdsWithJobs: string[];
  leadNames?: Record<string, string>;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const leadIdsWithJobs = new Set(leadIdsArr);

  const handleDispositionChanged = () => {
    // Force re-fetch so all linked data (leads, jobs) syncs
    router.refresh();
  };

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
                      {call.lead_id && leadNames[call.lead_id] && (
                        <div className="text-xs text-slate-900 font-medium truncate">{leadNames[call.lead_id]}</div>
                      )}
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatTime(call.started_at || call.created_at)}</div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DispositionChanger call={call} onChanged={handleDispositionChanged} />
                    </div>
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
                  <CallDetail call={call} onDispositionChanged={handleDispositionChanged} />
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
          <table className="w-full text-sm" style={{ minWidth: "900px" }}>
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5">
                  <input type="checkbox" checked={selected.size === sorted.length && sorted.length > 0} onChange={toggleAll} className="h-3.5 w-3.5 rounded border-slate-300" />
                </th>
                <th className="text-left px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleSort("time")}>Date / Time {sortArrow("time")}</th>
                <th className="text-left px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleSort("caller")}>Caller {sortArrow("caller")}</th>
                <th className="text-left px-3 py-2.5">Customer</th>
                <th className="text-left px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleSort("source")}>Source {sortArrow("source")}</th>
                <th className="text-left px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleSort("duration")}>Dur. {sortArrow("duration")}</th>
                <th className="text-left px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleSort("disposition")}>Status {sortArrow("disposition")}</th>
                <th className="text-left px-3 py-2.5">Transcript</th>
                <th className="text-right px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((call) => {
                const leadHasJob = !!(call.lead_id && leadIdsWithJobs.has(call.lead_id));
                const isOpen = expandedId === call.id;
                const isSelected = selected.has(call.id);
                return (
                  <React.Fragment key={call.id}>
                    <tr
                      className={`border-t border-slate-100 cursor-pointer transition-colors ${isOpen ? "bg-blue-50/40" : isSelected ? "bg-blue-50/20" : "hover:bg-slate-50/50"}`}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(call.id)} className="h-3.5 w-3.5 rounded border-slate-300" />
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap" onClick={() => toggle(call.id)}>{formatTime(call.started_at || call.created_at)}</td>
                      <td className="px-3 py-2.5 font-medium text-xs whitespace-nowrap" onClick={() => toggle(call.id)}><span className="text-blue-600">{call.caller_phone || "—"}</span></td>
                      <td className="px-3 py-2.5 text-slate-900 text-xs" onClick={() => toggle(call.id)}>{(call.lead_id && leadNames[call.lead_id]) || "—"}</td>
                      <td className="px-3 py-2.5" onClick={() => toggle(call.id)}><span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-700 font-medium">{call.source || "?"}</span></td>
                      <td className="px-3 py-2.5 text-slate-600 text-xs whitespace-nowrap tabular-nums" onClick={() => toggle(call.id)}>{formatDuration(call.duration_seconds)}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><DispositionChanger call={call} onChanged={handleDispositionChanged} /></td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs truncate" onClick={() => toggle(call.id)}>{truncate(call.transcript, 40)}</td>
                      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <DeleteCallButton callId={call.id} />
                          <LinkStatus call={call} leadHasJob={leadHasJob} />
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${call.id}-detail`}><td colSpan={9} className="p-0" onClick={(e) => e.stopPropagation()}><CallDetail call={call} onDispositionChanged={handleDispositionChanged} /></td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
