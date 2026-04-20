"use client";

import { useState } from "react";
import { resolveDispute } from "./actions";

type Dispute = {
  id: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  job_id: string;
  driver_id: string;
  jobs: any;
  drivers: any;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
};

export default function DisputesPanel({ initialDisputes }: { initialDisputes: Dispute[] }) {
  const [disputes] = useState<Dispute[]>(initialDisputes);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  const handleResolve = async (disputeId: string, status: "approved" | "rejected") => {
    setResolving(true);
    try {
      await resolveDispute(disputeId, status, adminNotes);
      setExpandedId(null);
      setAdminNotes("");
      window.location.reload();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setResolving(false);
  };

  return (
    <div className="space-y-3">
      {disputes.length === 0 && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 p-12 text-center text-slate-400">
          No disputes filed yet.
        </div>
      )}

      {disputes.map((dispute) => {
        const expanded = expandedId === dispute.id;
        return (
          <div
            key={dispute.id}
            className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden"
          >
            {/* Header Row */}
            <button
              onClick={() => setExpandedId(expanded ? null : dispute.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold capitalize ${STATUS_STYLES[dispute.status] || ""}`}
                >
                  {dispute.status}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">
                    {dispute.drivers?.name || "Unknown Driver"} — {dispute.jobs?.customer || "Unknown Job"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(dispute.created_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              {dispute.jobs?.price != null && (
                <span className="text-emerald-600 font-bold text-sm ml-4">
                  ${Number(dispute.jobs.price).toFixed(0)}
                </span>
              )}
            </button>

            {/* Expanded Details */}
            {expanded && (
              <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                {/* Dispute Reason */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Dispute Reason
                  </p>
                  <p className="text-sm text-slate-700 bg-red-50 rounded-xl p-3 border-l-3 border-red-400">
                    {dispute.reason}
                  </p>
                </div>

                {/* Job Info */}
                {dispute.jobs && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Job Info
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-slate-400">Customer:</span> <span className="text-slate-900 font-medium">{dispute.jobs.customer || "—"}</span></div>
                      <div><span className="text-slate-400">Phone:</span> <span className="text-slate-900 font-medium">{dispute.jobs.phone || "—"}</span></div>
                      <div><span className="text-slate-400">Route:</span> <span className="text-slate-900 font-medium">{dispute.jobs.pickup_city || "—"} → {dispute.jobs.dropoff_city || "—"}</span></div>
                      <div><span className="text-slate-400">Job Status:</span> <span className="text-slate-900 font-medium capitalize">{dispute.jobs.status.replace(/_/g, " ")}</span></div>
                    </div>
                  </div>
                )}

                {/* Driver Info */}
                {dispute.drivers && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Driver
                    </p>
                    <p className="text-sm text-slate-700">
                      {dispute.drivers.name} · {dispute.drivers.email} · {dispute.drivers.phone || "—"}
                    </p>
                  </div>
                )}

                {/* Admin Notes (if already resolved) */}
                {dispute.admin_notes && dispute.status !== "pending" && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Admin Notes
                    </p>
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
                      {dispute.admin_notes}
                    </p>
                  </div>
                )}

                {/* Resolution Actions */}
                {dispute.status === "pending" && (
                  <div className="space-y-3 pt-2">
                    <textarea
                      placeholder="Admin notes (optional)..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-sm resize-none h-20 outline-none focus:ring-blue-400"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleResolve(dispute.id, "approved")}
                        disabled={resolving}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {resolving ? "..." : "Approve (Cancel Job)"}
                      </button>
                      <button
                        onClick={() => handleResolve(dispute.id, "rejected")}
                        disabled={resolving}
                        className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {resolving ? "..." : "Reject (Keep Job)"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
