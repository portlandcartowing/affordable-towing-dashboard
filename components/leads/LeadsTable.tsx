"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CreateJobButton from "./CreateJobButton";
import DeleteLeadButton from "./DeleteLeadButton";
import EmptyState from "@/components/dashboard/EmptyState";
import { updateLeadStatus } from "@/app/leads/actions";
import type { Lead } from "@/lib/types";

export type { Lead };

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(price: number | null) {
  if (price == null) return "—";
  return `$${price.toFixed(2)}`;
}

/* ── Lead status dropdown — mirrors call dispositions ── */
const LEAD_STATUSES = [
  { value: "new_lead", label: "New Lead" },
  { value: "booked", label: "Booked" },
  { value: "standby", label: "Standby" },
  { value: "lost", label: "Lost" },
  { value: "callback", label: "Callback" },
  { value: "spam", label: "Spam" },
] as const;

function deriveLeadStatus(lead: Lead, callDisp?: string | null): string {
  // If linked call has a disposition, use that as the source of truth
  if (callDisp) return callDisp;
  if (lead.booked) return "booked";
  return "new_lead";
}

function LeadStatusChanger({ lead, onChanged, callDisposition }: { lead: Lead; onChanged?: () => void; callDisposition?: string | null }) {
  const [localValue, setLocalValue] = useState(() => deriveLeadStatus(lead, callDisposition));
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === localValue) return;
    setLocalValue(val);

    startTransition(async () => {
      const result = await updateLeadStatus(lead.id, val);
      if (result.ok) {
        setToast(LEAD_STATUSES.find(s => s.value === val)?.label || val);
        setTimeout(() => setToast(null), 2000);
        onChanged?.();
      } else {
        setLocalValue(deriveLeadStatus(lead));
        setToast("Failed");
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
        {LEAD_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
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

/* ── Expanded detail panel ── */
function LeadDetail({ lead, hasJob, onStatusChanged, callDisposition }: { lead: Lead; hasJob: boolean; onStatusChanged?: () => void; callDisposition?: string | null }) {
  return (
    <div className="px-5 py-4 bg-slate-50/60 space-y-4 text-sm border-t border-slate-100">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Customer</div>
          <div className="mt-0.5 font-semibold text-slate-900">{lead.customer || "Unknown"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Phone</div>
          <div className="mt-0.5">
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">{lead.phone}</a>
            ) : "—"}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Service</div>
          <div className="mt-0.5 text-slate-700">{lead.service || "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">City</div>
          <div className="mt-0.5 text-slate-700">{lead.city || "—"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Source</div>
          <div className="mt-0.5">
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
              {lead.source || "—"}
            </span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Price</div>
          <div className="mt-0.5 font-semibold text-slate-900">{formatPrice(lead.price)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Status</div>
          <LeadStatusChanger lead={lead} onChanged={onStatusChanged} callDisposition={callDisposition} />
        </div>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium">Created</div>
          <div className="mt-0.5 text-slate-700">{formatTime(lead.created_at)}</div>
        </div>
      </div>

      {lead.notes && (
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-medium mb-1">Notes</div>
          <div className="text-slate-700 bg-white rounded-lg px-3 py-2 ring-1 ring-slate-200/70">
            {lead.notes}
          </div>
        </div>
      )}

      {lead.call_id && (
        <div className="text-xs text-slate-500">
          Linked to call <span className="font-mono">{lead.call_id.slice(0, 8)}…</span>
        </div>
      )}
      {lead.proposal_id && (
        <div className="text-xs text-slate-500">
          Linked to proposal <span className="font-mono">{lead.proposal_id.slice(0, 8)}…</span>
        </div>
      )}
    </div>
  );
}

export default function LeadsTable({
  leads,
  leadIdsWithJobs: leadIdsArr,
  callDispositions = {},
}: {
  leads: Lead[];
  leadIdsWithJobs: string[];
  callDispositions?: Record<string, string>;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const leadIdsWithJobs = new Set(leadIdsArr);

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const handleStatusChanged = () => router.refresh();

  if (leads.length === 0) {
    return (
      <EmptyState
        icon="◉"
        title="No leads yet"
        description="Tap Add Lead to create one, or wait for an inbound call to convert."
      />
    );
  }

  return (
    <>
      {/* Mobile card list */}
      <ul className="md:hidden space-y-3">
        {leads.map((lead) => {
          const hasJob = leadIdsWithJobs.has(lead.id);
          const isOpen = expandedId === lead.id;
          return (
            <li
              key={lead.id}
              className={`bg-white rounded-2xl ring-1 shadow-sm overflow-hidden transition-all ${
                isOpen ? "ring-blue-300 shadow-md" : "ring-slate-200/70"
              }`}
            >
              <button
                onClick={() => toggle(lead.id)}
                className="w-full text-left p-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {lead.customer || "Unknown"}
                    </div>
                    <div className="text-sm text-slate-500 truncate">
                      {lead.service || "—"} · {lead.city || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <LeadStatusChanger lead={lead} onChanged={handleStatusChanged} callDisposition={lead.call_id ? callDispositions[lead.call_id] : null} />
                    <span className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                      ▾
                    </span>
                  </div>
                </div>
              </button>

              {isOpen && (
                <>
                  <LeadDetail lead={lead} hasJob={hasJob} onStatusChanged={handleStatusChanged} callDisposition={lead.call_id ? callDispositions[lead.call_id] : null} />
                  <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <DeleteLeadButton leadId={lead.id} />
                    </div>
                    <CreateJobButton
                      leadId={lead.id}
                      hasJob={hasJob}
                      booked={!!lead.booked}
                      size="md"
                    />
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {/* Desktop / tablet table */}
      <div className="hidden md:block bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 whitespace-nowrap">Time</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">City</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Price</th>
                <th className="text-right px-4 py-3">Job</th>
              </tr>
            </thead>
            {leads.map((lead) => {
              const hasJob = leadIdsWithJobs.has(lead.id);
              const isOpen = expandedId === lead.id;
              return (
                <tbody key={lead.id}>
                  <tr
                    onClick={() => toggle(lead.id)}
                    className={`border-t border-slate-100 cursor-pointer transition-colors ${
                      isOpen ? "bg-blue-50/40" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatTime(lead.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{lead.customer || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {lead.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{lead.service || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.city || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700">
                        {lead.source || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <LeadStatusChanger lead={lead} onChanged={handleStatusChanged} callDisposition={lead.call_id ? callDispositions[lead.call_id] : null} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {formatPrice(lead.price)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <DeleteLeadButton leadId={lead.id} />
                        <CreateJobButton
                          leadId={lead.id}
                          hasJob={hasJob}
                          booked={!!lead.booked}
                        />
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <LeadDetail lead={lead} hasJob={hasJob} onStatusChanged={handleStatusChanged} callDisposition={lead.call_id ? callDispositions[lead.call_id] : null} />
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
